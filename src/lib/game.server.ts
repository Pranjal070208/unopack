import type { Card, GameState } from "@/game/gameTypes";
import { dealCards } from "@/game/gameEngine";

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
      event_data: e.data ?? {},
    })),
  );
}

export async function loadState(db: any, gameId: string): Promise<{ game: Row; state: GameState }> {
  const { data: game } = await db.from("games").select("*").eq("id", gameId).maybeSingle();
  if (!game) throw new Error("GAME_NOT_FOUND");
  const { data: priv } = await db.from("game_private").select("*").eq("game_id", gameId).maybeSingle();
  const { data: players } = await db.from("players").select("*").eq("room_id", game.room_id).order("seat");

  const state: GameState = {
    players: (players ?? []).map((p: Row) => ({
      id: p.id,
      seat: p.seat,
      eliminated: p.eliminated,
      finishedRank: p.finished_rank,
    })),
    hands: (priv?.hands ?? {}) as Record<string, Card[]>,
    deck: (priv?.deck ?? []) as Card[],
    pile: (priv?.pile ?? []) as Card[],
    discardTop: game.discard_top as Card | null,
    activeColor: game.active_color,
    currentPlayerId: game.current_player_id,
    direction: game.direction === -1 ? -1 : 1,
    pendingDraw: game.pending_draw,
    turnCount: game.turn_count,
    winnerId: game.winner_id,
    status: game.status === "finished" ? "finished" : "playing",
  };
  return { game, state };
}

export async function saveState(db: any, gameId: string, roomId: string, state: GameState) {
  await db
    .from("games")
    .update({
      status: state.status,
      current_player_id: state.currentPlayerId,
      direction: state.direction,
      pending_draw: state.pendingDraw,
      discard_top: state.discardTop,
      active_color: state.activeColor,
      turn_count: state.turnCount,
      winner_id: state.winnerId,
      turn_started_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  await db.from("game_private").update({ deck: state.deck, pile: state.pile, hands: state.hands }).eq("game_id", gameId);

  // Rank finishers, then sync public per-player counters.
  const ranked = state.players
    .filter((p) => p.finishedRank !== null)
    .sort((a, b) => (a.finishedRank ?? 0) - (b.finishedRank ?? 0)).length;
  let nextRank = ranked + 1;
  for (const p of state.players) {
    const count = state.hands[p.id]?.length ?? 0;
    let rank = p.finishedRank;
    if (rank === null && count === 0 && state.status === "finished") {
      rank = nextRank;
      nextRank += 1;
    }
    await db
      .from("players")
      .update({ card_count: count, eliminated: p.eliminated, finished_rank: rank })
      .eq("id", p.id);
  }

  if (state.status === "finished") {
    await db.from("rooms").update({ status: "finished" }).eq("id", roomId);
  }
}

export async function startNewGame(db: any, roomId: string) {
  const { data: players } = await db
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at");
  const list = (players ?? []) as Row[];
  if (list.length < 2) throw new Error("NEED_MORE_PLAYERS");

  for (let i = 0; i < list.length; i++) {
    await db
      .from("players")
      .update({ seat: i, eliminated: false, finished_rank: null })
      .eq("id", list[i]!.id);
  }

  const state = dealCards(
    list.map((p, i) => ({ id: p.id, seat: i, eliminated: false, finishedRank: null })),
  );

  const { data: game } = await db
    .from("games")
    .insert({
      room_id: roomId,
      status: "playing",
      current_player_id: state.currentPlayerId,
      direction: 1,
      pending_draw: 0,
      discard_top: state.discardTop,
      active_color: state.activeColor,
      turn_count: 0,
    })
    .select()
    .single();

  await db.from("game_private").insert({
    game_id: game.id,
    deck: state.deck,
    pile: state.pile,
    hands: state.hands,
  });

  for (const p of state.players) {
    await db.from("players").update({ card_count: state.hands[p.id]?.length ?? 0 }).eq("id", p.id);
  }

  await db.from("rooms").update({ status: "playing" }).eq("id", roomId);
  await logEvents(db, roomId, game.id, [{ type: "game_start" }]);
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
