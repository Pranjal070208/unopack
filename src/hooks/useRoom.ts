import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Card, PublicGameState } from "@/game/gameTypes";
import { getMyHand, heartbeat } from "@/lib/game.functions";
import type { RoomCreds } from "@/lib/session";

export interface RoomRow {
  id: string;
  code: string;
  status: string;
  host_player_id: string | null;
  max_players: number;
  score_mode?: boolean;
  match_winner_id?: string | null;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  nickname: string;
  avatar: string;
  is_host: boolean;
  is_connected: boolean;
  seat: number;
  card_count: number;
  eliminated: boolean;
  finished_rank: number | null;
  score: number;
  last_hand_points: number;
  joined_at: string;
  is_bot?: boolean;
  bot_difficulty?: string | null;
}

export interface GameRow {
  id: string;
  room_id: string;
  status: string;
  phase?: string | null;
  current_player_id: string | null;
  direction: number;
  pending_draw: number;
  discard_top: Card | null;
  active_color: string | null;
  turn_started_at: string;
  turn_count: number;
  winner_id: string | null;
  public_state?: PublicGameState | null;
}


export interface EventRow {
  id: number;
  room_id: string;
  game_id: string | null;
  player_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export type ConnectionState = "connecting" | "connected" | "lost";

export function useRoom(code: string, creds: RoomCreds | null) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [game, setGame] = useState<GameRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [playable, setPlayable] = useState<string[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [missing, setMissing] = useState(false);
  const roomIdRef = useRef<string | null>(null);

  const refreshAll = useCallback(async () => {
    const { data: r } = await supabase.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
    if (!r) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setRoom(r as RoomRow);
    roomIdRef.current = r.id;
    const [{ data: ps }, { data: gs }, { data: es }] = await Promise.all([
      supabase
        .from("players")
        .select(
          "id, room_id, nickname, avatar, is_host, is_connected, seat, card_count, eliminated, finished_rank, score, last_hand_points, last_seen, joined_at, is_bot, bot_difficulty",
        )
        .eq("room_id", r.id)
        .order("seat"),
      supabase.from("games").select("*").eq("room_id", r.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("game_events").select("*").eq("room_id", r.id).order("id", { ascending: false }).limit(40),
    ]);
    setPlayers((ps ?? []) as PlayerRow[]);
    setGame(((gs ?? [])[0] as GameRow) ?? null);
    setEvents(((es ?? []) as EventRow[]).slice().reverse());
  }, [code]);

  const refreshHand = useCallback(async () => {
    if (!creds) return;
    try {
      const res = await getMyHand({ data: creds });
      setHand(res.hand as Card[]);
      setPlayable(res.playable);
    } catch {
      /* not in a game yet */
    }
  }, [creds]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void refreshHand();
  }, [refreshHand, game?.turn_count, game?.id, game?.status]);

  // Realtime subscriptions for the whole room.
  useEffect(() => {
    if (!room?.id) return;
    const roomId = room.id;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (p) => {
        if (p.eventType === "DELETE") setMissing(true);
        else setRoom(p.new as RoomRow);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, (p) => {
        setPlayers((prev) => {
          if (p.eventType === "DELETE") return prev.filter((x) => x.id !== (p.old as PlayerRow).id);
          const row = p.new as PlayerRow;
          const next = prev.filter((x) => x.id !== row.id).concat(row);
          return next.sort((a, b) => a.seat - b.seat || a.joined_at.localeCompare(b.joined_at));
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `room_id=eq.${roomId}` }, (p) => {
        if (p.eventType !== "DELETE") setGame(p.new as GameRow);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events", filter: `room_id=eq.${roomId}` },
        (p) => {
          setEvents((prev) => prev.concat(p.new as EventRow).slice(-60));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("connected");
          void refreshAll();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("lost");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room?.id, refreshAll]);

  // Presence heartbeat + reconnect handling.
  useEffect(() => {
    if (!creds) return;
    const beat = () => void heartbeat({ data: { ...creds, connected: true } }).catch(() => undefined);
    beat();
    const interval = setInterval(beat, 20000);
    const onOnline = () => {
      setConnection("connected");
      void refreshAll();
      beat();
    };
    const onOffline = () => setConnection("lost");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [creds, refreshAll]);

  const me = creds ? (players.find((p) => p.id === creds.playerId) ?? null) : null;

  return {
    room,
    players,
    game,
    events,
    hand,
    playable,
    connection,
    missing,
    me,
    refreshAll,
    refreshHand,
  };
}
