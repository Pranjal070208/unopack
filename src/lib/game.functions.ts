import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Card } from "@/game/gameTypes";

const identity = z.object({ playerId: z.string().uuid(), secret: z.string().min(8) });
const profile = z.object({
  nickname: z.string().trim().min(1).max(16),
  avatar: z.string().trim().min(1).max(24),
  sessionId: z.string().min(8).max(128),
});

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => profile.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const db = await s.admin();
    let code = s.makeCode();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await db.from("rooms").select("id").eq("code", code).maybeSingle();
      if (!existing) break;
      code = s.makeCode();
    }
    const { data: room, error } = await db.from("rooms").insert({ code, status: "lobby" }).select().single();
    if (error) throw new Error("ROOM_CREATE_FAILED");

    const sessionHash = await s.hashSession(data.sessionId);
    const { data: player, error: playerError } = await db
      .from("players")
      .insert({
        room_id: room.id,
        session_id: sessionHash,
        nickname: data.nickname,
        avatar: data.avatar,
        is_host: true,
        seat: 0,
      })
      .select()
      .single();
    if (playerError) throw new Error("JOIN_FAILED");

    const secret = crypto.randomUUID();
    await db.from("player_secrets").insert({ player_id: player.id, secret });
    await db.from("rooms").update({ host_player_id: player.id }).eq("id", room.id);
    await s.logEvents(db, room.id, null, [
      { type: "player_join", playerId: player.id, data: { nickname: data.nickname } },
    ]);

    return { code: room.code as string, roomId: room.id as string, playerId: player.id as string, secret };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => profile.extend({ code: z.string().trim().length(5) }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const db = await s.admin();
    const code = data.code.toUpperCase();
    const { data: room } = await db.from("rooms").select("*").eq("code", code).maybeSingle();
    if (!room) throw new Error("ROOM_NOT_FOUND");

    const sessionHash = await s.hashSession(data.sessionId);
    const { data: existing } = await db
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .eq("session_id", sessionHash)
      .maybeSingle();

    if (existing) {
      await db
        .from("players")
        .update({ nickname: data.nickname, avatar: data.avatar, is_connected: true, last_seen: new Date().toISOString() })
        .eq("id", existing.id);
      const { data: sec } = await db.from("player_secrets").select("secret").eq("player_id", existing.id).maybeSingle();
      await s.logEvents(db, room.id, null, [{ type: "player_reconnect", playerId: existing.id }]);
      return { roomId: room.id as string, code, playerId: existing.id as string, secret: sec!.secret as string };
    }

    const { count } = await db.from("players").select("id", { count: "exact", head: true }).eq("room_id", room.id);
    if ((count ?? 0) >= room.max_players) throw new Error("ROOM_FULL");
    if (room.status !== "lobby") throw new Error("GAME_IN_PROGRESS");

    const { data: player, error } = await db
      .from("players")
      .insert({
        room_id: room.id,
        session_id: sessionHash,
        nickname: data.nickname,
        avatar: data.avatar,
        is_host: false,
        seat: count ?? 0,
      })
      .select()
      .single();
    if (error) throw new Error("JOIN_FAILED");

    const secret = crypto.randomUUID();
    await db.from("player_secrets").insert({ player_id: player.id, secret });
    await s.logEvents(db, room.id, null, [
      { type: "player_join", playerId: player.id, data: { nickname: data.nickname } },
    ]);
    return { roomId: room.id as string, code, playerId: player.id as string, secret };
  });

export const getMyHand = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    const game = await s.currentGame(db, player.room_id);
    if (!game) return { hand: [] as Card[], playable: [] as string[], gameId: null as string | null };
    const { state } = await s.loadState(db, game.id);
    const { playableCardIds } = await import("@/game/playability");
    const hand = state.hands[player.id] ?? [];
    const playable = playableCardIds(state, player.id);
    return { hand, playable, gameId: game.id as string };
  });

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    if (!player.is_host) throw new Error("HOST_ONLY");
    const game = await s.startNewGame(db, player.room_id);
    const { runBots } = await import("./bots.server");
    await runBots(db, player.room_id);
    return { gameId: game.id as string };
  });

/** Host-only: seat a computer opponent (max 3 per room). */
export const addBot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    identity.extend({ difficulty: z.enum(["easy", "normal", "hard"]).default("normal") }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { BOT_AVATARS, BOT_NAMES } = await import("@/game/bot");
    const { GAME_CONFIG } = await import("@/game/config");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    if (!player.is_host) throw new Error("HOST_ONLY");

    const { data: room } = await db.from("rooms").select("*").eq("id", player.room_id).maybeSingle();
    if (!room || room.status !== "lobby") throw new Error("GAME_IN_PROGRESS");

    const { data: seated } = await db.from("players").select("id, nickname, is_bot").eq("room_id", player.room_id);
    const list = seated ?? [];
    if (list.length >= Math.min(room.max_players, GAME_CONFIG.MAX_PLAYERS)) throw new Error("ROOM_FULL");
    if (list.filter((p: { is_bot?: boolean }) => p.is_bot).length >= 3) throw new Error("BOT_LIMIT");

    const taken = new Set(list.map((p: { nickname: string }) => p.nickname));
    const name = BOT_NAMES.find((n) => !taken.has(n)) ?? `BOT ${list.length + 1}`;
    const avatar = BOT_AVATARS[list.length % BOT_AVATARS.length]!;

    const { data: bot, error } = await db
      .from("players")
      .insert({
        room_id: player.room_id,
        session_id: `bot_${crypto.randomUUID()}`,
        nickname: name,
        avatar,
        is_host: false,
        is_connected: true,
        seat: list.length,
        is_bot: true,
        bot_difficulty: data.difficulty,
        bot_persona: name,
      })
      .select()
      .single();
    if (error) throw new Error("BOT_ADD_FAILED");

    await s.logEvents(db, player.room_id, null, [
      { type: "player_join", playerId: bot.id, data: { nickname: name, bot: true } },
    ]);
    return { ok: true, botId: bot.id as string };
  });

/** Host-only: remove a bot seat. */
export const removeBot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.extend({ targetId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    if (!player.is_host) throw new Error("HOST_ONLY");

    const query = db.from("players").select("*").eq("room_id", player.room_id).eq("is_bot", true);
    const { data: bots } = data.targetId ? await query.eq("id", data.targetId) : await query.order("seat");
    const target = (bots ?? [])[bots && bots.length ? bots.length - 1 : 0];
    if (!target) throw new Error("NO_BOT");

    await s.logEvents(db, player.room_id, null, [
      { type: "player_leave", playerId: target.id, data: { nickname: target.nickname, bot: true } },
    ]);
    await db.from("players").delete().eq("id", target.id);
    return { ok: true };
  });

/** Anyone may ask the server to advance any pending bot moves. */
export const nudgeBots = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { runBots } = await import("./bots.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    return await runBots(db, player.room_id);
  });

/** Host-only toggle for the optional 1000-point Score Mode. */
export const setScoreMode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.extend({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    if (!player.is_host) throw new Error("HOST_ONLY");
    await db.from("rooms").update({ score_mode: data.enabled }).eq("id", player.room_id);
    return { ok: true, enabled: data.enabled };
  });

const commandSchema = identity.extend({
  actionId: z.string().min(6).max(64),
  command: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("PLAY_CARD"),
      cardId: z.string().min(1).max(64),
      color: z.enum(["red", "yellow", "green", "blue"]).optional(),
      targetId: z.string().uuid().optional(),
    }),
    z.object({ type: z.literal("DRAW_CARD") }),
    z.object({ type: z.literal("CHOOSE_COLOR"), color: z.enum(["red", "yellow", "green", "blue"]) }),
    z.object({ type: z.literal("CHOOSE_ROULETTE_COLOR"), color: z.enum(["red", "yellow", "green", "blue"]) }),
    z.object({ type: z.literal("CHOOSE_SWAP_TARGET"), targetId: z.string().uuid() }),
    z.object({ type: z.literal("CALL_UNO") }),
    z.object({ type: z.literal("CATCH_UNO"), targetId: z.string().uuid() }),
  ]),
});

/** The one authoritative mutation endpoint. Every rule is enforced here. */
export const sendCommand = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => commandSchema.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const engine = await import("@/game/engine");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    const game = await s.currentGame(db, player.room_id);
    if (!game) throw new Error("NO_GAME");
    const { state } = await s.loadState(db, game.id);

    const result = engine.applyCommand(state, {
      ...data.command,
      playerId: player.id,
      actionId: data.actionId,
    } as never);

    if (result.events.length === 0 && result.state === state) return { ok: true, duplicate: true };
    await s.saveState(db, game.id, player.room_id, result.state);
    await s.logEvents(db, player.room_id, game.id, result.events);
    const { runBots } = await import("./bots.server");
    await runBots(db, player.room_id);
    return { ok: true, duplicate: false };
  });

/** Anyone in the room may ask the server to enforce an expired turn. */
export const enforceTimeout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const engine = await import("@/game/engine");
    const { GAME_CONFIG } = await import("@/game/config");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    const game = await s.currentGame(db, player.room_id);
    if (!game || game.status !== "playing" || !game.current_player_id) return { ok: false };
    const elapsed = Date.now() - new Date(game.turn_started_at).getTime();
    if (elapsed < (GAME_CONFIG.TURN_SECONDS + 2) * 1000) return { ok: false };
    const { state } = await s.loadState(db, game.id);
    const result = engine.applyCommand(state, {
      type: "TIMEOUT",
      playerId: game.current_player_id,
      actionId: `timeout_${game.turn_count}`,
    });
    if (result.events.length === 0) return { ok: false };
    await s.saveState(db, game.id, player.room_id, result.state);
    await s.logEvents(db, player.room_id, game.id, result.events);
    const { runBots } = await import("./bots.server");
    await runBots(db, player.room_id);
    return { ok: true };
  });


export const sendRoomEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    identity
      .extend({
        type: z.enum(["reaction", "chat"]),
        payload: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    const game = await s.currentGame(db, player.room_id);
    await s.logEvents(db, player.room_id, game?.id ?? null, [
      { type: data.type, playerId: player.id, data: { text: data.payload, nickname: player.nickname } },
    ]);
    return { ok: true };
  });

export const heartbeat = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.extend({ connected: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    await db
      .from("players")
      .update({ is_connected: data.connected, last_seen: new Date().toISOString() })
      .eq("id", player.id);
    return { ok: true };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    await s.logEvents(db, player.room_id, null, [
      { type: "player_leave", playerId: player.id, data: { nickname: player.nickname } },
    ]);
    await db.from("players").delete().eq("id", player.id);
    const { data: rest } = await db.from("players").select("*").eq("room_id", player.room_id).order("joined_at");
    if (!rest || rest.length === 0) {
      await db.from("rooms").delete().eq("id", player.room_id);
    } else if (player.is_host) {
      await db.from("players").update({ is_host: true }).eq("id", rest[0].id);
      await db.from("rooms").update({ host_player_id: rest[0].id }).eq("id", player.room_id);
    }
    return { ok: true };
  });

export const kickPlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.extend({ targetId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    if (!player.is_host) throw new Error("HOST_ONLY");
    const { data: target } = await db.from("players").select("*").eq("id", data.targetId).maybeSingle();
    if (!target || target.room_id !== player.room_id || target.is_host) throw new Error("CANNOT_KICK");
    await s.logEvents(db, player.room_id, null, [
      { type: "player_kick", playerId: target.id, data: { nickname: target.nickname } },
    ]);
    await db.from("players").delete().eq("id", target.id);
    return { ok: true };
  });

export const playAgain = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    if (!player.is_host) throw new Error("HOST_ONLY");
    await s.startNewGame(db, player.room_id);
    const { runBots } = await import("./bots.server");
    await runBots(db, player.room_id);
    return { ok: true };
  });

export const returnToLobby = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    if (!player.is_host) throw new Error("HOST_ONLY");
    await db.from("rooms").update({ status: "lobby" }).eq("id", player.room_id);
    await db
      .from("players")
      .update({ card_count: 0, eliminated: false, finished_rank: null })
      .eq("room_id", player.room_id);
    return { ok: true };
  });
