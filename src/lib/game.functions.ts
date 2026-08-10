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
    const { playableCardIds } = await import("@/game/rules");
    const hand = state.hands[player.id] ?? [];
    const playable = state.currentPlayerId === player.id ? playableCardIds(state, hand) : [];
    return { hand, playable, gameId: game.id as string };
  });

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    if (!player.is_host) throw new Error("HOST_ONLY");
    const game = await s.startNewGame(db, player.room_id);
    return { gameId: game.id as string };
  });

export const playCardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    identity
      .extend({
        cardId: z.string().min(1).max(64),
        color: z.enum(["red", "yellow", "green", "blue"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const engine = await import("@/game/gameEngine");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    const game = await s.currentGame(db, player.room_id);
    if (!game) throw new Error("NO_GAME");
    const { state } = await s.loadState(db, game.id);
    const result = engine.playCard(state, player.id, data.cardId, data.color);
    await s.saveState(db, game.id, player.room_id, result.state);
    await s.logEvents(db, player.room_id, game.id, result.events);
    return { ok: true };
  });

export const drawCardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const engine = await import("@/game/gameEngine");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    const game = await s.currentGame(db, player.room_id);
    if (!game) throw new Error("NO_GAME");
    const { state } = await s.loadState(db, game.id);
    const result = engine.drawCard(state, player.id);
    await s.saveState(db, game.id, player.room_id, result.state);
    await s.logEvents(db, player.room_id, game.id, result.events);
    return { ok: true };
  });

/** Anyone in the room may ask the server to enforce an expired turn. */
export const enforceTimeout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identity.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./game.server");
    const engine = await import("@/game/gameEngine");
    const { db, player } = await s.authPlayer(data.playerId, data.secret);
    const game = await s.currentGame(db, player.room_id);
    if (!game || game.status !== "playing" || !game.current_player_id) return { ok: false };
    const elapsed = Date.now() - new Date(game.turn_started_at).getTime();
    if (elapsed < 36000) return { ok: false };
    const { state } = await s.loadState(db, game.id);
    const result = engine.drawCard(state, game.current_player_id);
    await s.saveState(db, game.id, player.room_id, result.state);
    await s.logEvents(db, player.room_id, game.id, [
      { type: "timeout", playerId: game.current_player_id },
      ...result.events,
    ]);
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
