import type { GameState } from "@/game/gameTypes";
import { createGame, toPublicState } from "@/game/engine";
import { makeSeed } from "@/game/rng";
import { GAME_CONFIG } from "@/game/config";

type Row = any;

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function hashSession(sessionId: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeCode(len = 5): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export async function authPlayer(playerId: string, secret: string) {
  const db = await admin();
  const { data: sec } = await db.from("player_secrets").select("secret").eq("player_id", playerId).maybeSingle();
  if (!sec || sec.secret !== secret) throw new Error("NOT_AUTHORIZED");
  const { data: player } = await db.from("players").select("*").eq("id", playerId).maybeSingle();
  if (!player) throw new Error("PLAYER_NOT_FOUND");
  return { db, player: player as Row };
}

export async function logEvents(
  db: any,
  roomId: string,
  gameId: string | null,
  events: { type: string; playerId?: string | null; data?: Record<string, unknown> }[],
) {
  if (events.length === 0) return;
  await db.from("game_events").insert(
    events.map((e) => ({
      room_id: roomId,
      game_id: gameId,
      player_id: e.playerId ?? null,
      event_type: e.type,
      event_data: (e.data ?? {}) as Record<string, unknown>,
    })),
  );
}

/** Load the full authoritative state. Only ever runs on the server. */
export async function loadState(db: any, gameId: string): Promise<{ game: Row; state: GameState }> {
  const { data: game } = await db.from("games").select("*").eq("id", gameId).maybeSingle();
  if (!game) throw new Error("GAME_NOT_FOUND");
  const { data: priv } = await db.from("game_private").select("full_state").eq("game_id", gameId).maybeSingle();
  const state = priv?.full_state as GameState | undefined;
  if (!state || !state.players) throw new Error("STATE_MISSING");
  return { game, state };
}

export async function saveState(db: any, gameId: string, roomId: string, state: GameState) {
  const pub = toPublicState(state);

  await db
    .from("games")
    .update({
      status: state.status,
      phase: state.phase,
      current_player_id: state.currentPlayerId,
      direction: state.direction,
      pending_draw: state.drawStack.totalPenalty,
      discard_top: state.discardTop,
      active_color: state.currentColor,
      turn_count: state.turnCount,
      winner_id: state.winnerId,
      public_state: pub,
      turn_started_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  await db.from("game_private").update({ full_state: state, hands: {}, deck: [], pile: [] }).eq("game_id", gameId);

  for (const p of state.players) {
    await db
      .from("players")
      .update({
        card_count: state.hands[p.id]?.length ?? 0,
        eliminated: p.eliminated,
        finished_rank: p.finishedRank,
      })
      .eq("id", p.id);
  }

  if (state.status === "finished") {
    await db.from("rooms").update({ status: "finished" }).eq("id", roomId);
  }
}

export async function startNewGame(db: any, roomId: string) {
  const { data: players } = await db.from("players").select("*").eq("room_id", roomId).order("joined_at");
  const list = (players ?? []) as Row[];
  if (list.length < GAME_CONFIG.MIN_PLAYERS) throw new Error("NEED_MORE_PLAYERS");
  if (list.length > GAME_CONFIG.MAX_PLAYERS) throw new Error("TOO_MANY_PLAYERS");

  for (let i = 0; i < list.length; i++) {
    await db
      .from("players")
      .update({ seat: i, eliminated: false, finished_rank: null })
      .eq("id", list[i]!.id);
  }

  const seed = makeSeed();
  const { state, events } = createGame(
    list.map((p) => p.id as string),
    seed,
  );
  const pub = toPublicState(state);

  const { data: game } = await db
    .from("games")
    .insert({
      room_id: roomId,
      status: state.status,
      phase: state.phase,
      seed,
      current_player_id: state.currentPlayerId,
      direction: state.direction,
      pending_draw: state.drawStack.totalPenalty,
      discard_top: state.discardTop,
      active_color: state.currentColor,
      turn_count: 0,
      public_state: pub,
    })
    .select()
    .single();

  await db.from("game_private").insert({
    game_id: game.id,
    deck: [],
    pile: [],
    hands: {},
    full_state: state,
  });

  for (const p of state.players) {
    await db
      .from("players")
      .update({ card_count: state.hands[p.id]?.length ?? 0 })
      .eq("id", p.id);
  }

  await db.from("rooms").update({ status: "playing" }).eq("id", roomId);
  await logEvents(db, roomId, game.id, events);
  return game as Row;
}

export async function currentGame(db: any, roomId: string): Promise<Row | null> {
  const { data } = await db
    .from("games")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Row) ?? null;
}
