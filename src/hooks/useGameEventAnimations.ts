import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Announcement, AnnouncementTone } from "@/components/GameAnnouncement";
import type { EventRow, PlayerRow } from "@/hooks/useRoom";
import { playSound, type SoundName } from "@/hooks/useSound";
import { triggerScreenShake } from "@/lib/fx";

export interface FeedItem {
  id: number;
  text: string;
  major: boolean;
}

interface Options {
  events: EventRow[];
  players: PlayerRow[];
  myId: string | null;
}

interface Mapped {
  announcement?: { text: string; sub?: string; tone: AnnouncementTone; priority: number; ms: number } | undefined;
  feed?: { text: string; major?: boolean } | undefined;
  sound?: SoundName | undefined;
  shake?: [number, number] | undefined;
}

const PLAY_TEXT: Record<string, { text: string; tone: AnnouncementTone; priority: number; ms: number }> = {
  skip: { text: "SKIPPED!", tone: "yellow", priority: 40, ms: 900 },
  reverse: { text: "REVERSE", tone: "yellow", priority: 40, ms: 900 },
  draw2: { text: "DRAW 2", tone: "yellow", priority: 50, ms: 900 },
  draw4: { text: "DRAW 4", tone: "red", priority: 60, ms: 1000 },
  skipall: { text: "EVERYONE SKIPPED!", tone: "yellow", priority: 65, ms: 1200 },
  discardall: { text: "DISCARD ALL", tone: "green", priority: 60, ms: 1100 },
  wildreversedraw4: { text: "REVERSE +4", tone: "red", priority: 75, ms: 1300 },
  wilddraw6: { text: "DRAW 6", tone: "red", priority: 70, ms: 1100 },
  wilddraw10: { text: "DRAW 10", tone: "red", priority: 80, ms: 1400 },
  wildroulette: { text: "COLOR ROULETTE", tone: "violet", priority: 85, ms: 1400 },
};

/**
 * Translates authoritative game events into announcements, sounds, feed lines
 * and screen shake. Events are processed exactly once, in sequence order —
 * animations never drive state, they only react to it.
 */
export function useGameEventAnimations({ events, players, myId }: Options) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const queue = useRef<Announcement[]>([]);
  const busy = useRef(false);
  const lastSeq = useRef(0);
  const primed = useRef(false);

  const nameOf = useCallback(
    (id?: string | null) => players.find((p) => p.id === id)?.nickname ?? "SOMEONE",
    [players],
  );

  const pump = useRef<() => void>(() => undefined);
  pump.current = () => {
    if (busy.current || queue.current.length === 0) return;
    queue.current.sort((a, b) => b.priority - a.priority);
    const next = queue.current.shift()!;
    busy.current = true;
    setAnnouncement(next);
    window.setTimeout(() => {
      busy.current = false;
      setAnnouncement(null);
      window.setTimeout(() => pump.current(), 90);
    }, next.ms);
  };

  const announce = useCallback((a: Omit<Announcement, "key"> & { key?: string }) => {
    // Drop low-priority noise when something major is already queued.
    const topQueued = Math.max(0, ...queue.current.map((q) => q.priority));
    if (a.priority < topQueued - 40) return;
    queue.current.push({ key: a.key ?? `${Date.now()}_${Math.random()}`, ...a });
    if (queue.current.length > 4) {
      queue.current.sort((x, y) => y.priority - x.priority);
      queue.current = queue.current.slice(0, 4);
    }
    pump.current();
  }, []);

  const pushFeed = useCallback((id: number, text: string, major: boolean) => {
    setFeed((f) => [...f.slice(-6), { id, text, major }]);
    window.setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), major ? 4000 : 2200);
  }, []);

  const map = useCallback(
    (e: EventRow): Mapped | null => {
      const d = e.event_data as {
        card?: { type?: string; value?: number };
        count?: number;
        penalty?: number;
        total?: number;
        amount?: number;
        color?: string;
        targetId?: string;
        cards?: unknown[];
        nickname?: string;
      };
      const who = nameOf(e.player_id);
      const mine = !!myId && e.player_id === myId;

      switch (e.event_type) {
        case "GAME_STARTED":
          return {
            announcement: { text: "NO MERCY!", tone: "red", priority: 90, ms: 1300 },
            sound: "special",
            feed: { text: "GAME STARTED", major: true },
          };
        case "CARD_PLAYED": {
          const type = d.card?.type;
          if (type === "number" && d.card?.value === 7)
            return {
              announcement: { text: "HAND SWAP", tone: "green", priority: 65, ms: 1100 },
              sound: "swap",
              feed: { text: `${who} PLAYED 7`, major: true },
            };
          if (type === "number" && d.card?.value === 0)
            return {
              announcement: { text: "EVERYONE PASS!", tone: "green", priority: 65, ms: 1100 },
              sound: "swap",
              feed: { text: `${who} PLAYED 0`, major: true },
            };
          const fx = type ? PLAY_TEXT[type] : undefined;
          if (!fx) return { sound: "play", feed: { text: `${who} PLAYED A CARD` } };
          return {
            announcement: fx,
            sound:
              type === "reverse"
                ? "reverse"
                : type === "skip" || type === "skipall"
                  ? "skip"
                  : type === "wildroulette"
                    ? "roulette"
                    : "special",
            feed: { text: `${who} PLAYED ${fx.text}`, major: true },
            shake: type === "wilddraw10" || type === "wildreversedraw4" ? [2, 420] : undefined,
          };
        }
        case "DRAW_STACK_EXTENDED":
        case "DRAW_STACK_STARTED":
          return {
            sound: "stack",
            feed: { text: `${who} STACKED — NOW +${Number(d.total ?? d.amount ?? 0)}` },
          };
        case "DRAW_STACK_RESOLVED": {
          const n = Number(d.count ?? d.penalty ?? 0);
          return {
            announcement: {
              text: `DRAW ${n}`,
              sub: mine ? "TAKE THEM ALL" : who,
              tone: "red",
              priority: 78,
              ms: 1400,
            },
            sound: "draw",
            feed: { text: `${who} TOOK +${n}`, major: true },
            shake: n >= 10 ? [2.4, 460] : [1, 300],
          };
        }
        case "CARD_DRAWN":
          return { sound: "draw", feed: { text: `${who} DREW A CARD` } };
        case "DRAW_UNTIL_PLAYABLE":
          return { sound: "draw", feed: { text: `${who} DREW ${Number(d.count ?? 1)}` } };
        case "COLOR_SELECTED":
          return {
            announcement: {
              text: String(d.color ?? "").toUpperCase() || "COLOR",
              sub: "NEW COLOR",
              tone: (d.color as AnnouncementTone) ?? "yellow",
              priority: 35,
              ms: 800,
            },
            sound: "select",
            feed: { text: `COLOR IS NOW ${String(d.color ?? "").toUpperCase()}` },
          };
        case "DIRECTION_REVERSED":
          return { sound: "reverse", feed: { text: "DIRECTION REVERSED" } };
        case "PLAYER_SKIPPED":
          return { sound: "skip", feed: { text: `${who} WAS SKIPPED` } };
        case "EVERYONE_SKIPPED":
          return {
            announcement: { text: "EVERYONE SKIPPED!", tone: "yellow", priority: 66, ms: 1200 },
            sound: "skip",
            feed: { text: "EVERYONE SKIPPED", major: true },
          };
        case "HAND_SWAPPED":
          return {
            announcement: {
              text: "HANDS SWAPPED!",
              sub: `${who} ↔ ${nameOf(d.targetId)}`,
              tone: "green",
              priority: 68,
              ms: 1300,
            },
            sound: "swap",
            feed: { text: `${who} SWAPPED HANDS WITH ${nameOf(d.targetId)}`, major: true },
          };
        case "HANDS_ROTATED":
          return {
            announcement: { text: "EVERYONE PASS!", tone: "green", priority: 68, ms: 1200 },
            sound: "swap",
            feed: { text: "ALL HANDS ROTATED", major: true },
          };
        case "DISCARD_ALL_RESOLVED":
          return {
            announcement: {
              text: "DISCARD ALL",
              sub: `${Number(d.count ?? 0)} ${String(d.color ?? "").toUpperCase()} CARDS GONE`,
              tone: "green",
              priority: 62,
              ms: 1200,
            },
            sound: "special",
            feed: { text: `${who} DUMPED ${Number(d.count ?? 0)} CARDS`, major: true },
          };
        case "COLOR_ROULETTE_RESOLVED":
          return {
            announcement: {
              text: `TAKE ${Number(d.count ?? 0)}`,
              sub: `${String(d.color ?? "").toUpperCase()} FOUND`,
              tone: "violet",
              priority: 84,
              ms: 1500,
            },
            sound: "roulette",
            feed: { text: `ROULETTE — ${who} TOOK ${Number(d.count ?? 0)}`, major: true },
            shake: [1.6, 400],
          };
        case "UNO_CALLED":
          return {
            announcement: { text: "ONO!", sub: who, tone: "yellow", priority: 72, ms: 1100 },
            sound: "uno",
            feed: { text: `${who} CALLED ONO`, major: true },
          };
        case "UNO_CAUGHT":
          return {
            announcement: { text: "CAUGHT!", sub: `+${Number(d.penalty ?? 2)}`, tone: "red", priority: 82, ms: 1300 },
            sound: "uno",
            feed: { text: `${nameOf(d.targetId)} GOT CAUGHT`, major: true },
          };
        case "PLAYER_ELIMINATED":
          return {
            announcement: { text: "NO MERCY.", sub: `${who} ELIMINATED`, tone: "red", priority: 95, ms: 1900 },
            sound: "eliminate",
            feed: { text: `${who} WAS ELIMINATED`, major: true },
            shake: [2.6, 520],
          };
        case "TURN_TIMEOUT":
          return { sound: "leave", feed: { text: `${who} RAN OUT OF TIME` } };
        case "DECK_RESHUFFLED":
          return { feed: { text: "DECK RESHUFFLED" } };
        case "PLAYER_WON":
          return {
            announcement: { text: "WINNER", sub: who, tone: "yellow", priority: 100, ms: 2200 },
            sound: "win",
            feed: { text: `${who} WINS`, major: true },
            shake: [2, 500],
          };
        default:
          return null;
      }
    },
    [myId, nameOf],
  );

  useEffect(() => {
    const fresh = events.filter((e) => e.id > lastSeq.current);
    if (fresh.length === 0) return;
    lastSeq.current = events[events.length - 1]?.id ?? lastSeq.current;

    // A late join / reconnect must not replay history.
    if (!primed.current) {
      primed.current = true;
      return;
    }

    for (const e of fresh) {
      const data = e.event_data as { nickname?: string; text?: string };

      if (e.event_type === "reaction" && e.player_id) {
        const pid = e.player_id;
        setReactions((r) => ({ ...r, [pid]: String(data.text ?? "🔥") }));
        window.setTimeout(() => setReactions((r) => ({ ...r, [pid]: "" })), 2000);
        continue;
      }
      if (e.event_type === "player_join") {
        setNotice(`${data.nickname ?? "SOMEONE"} JOINED`);
        playSound("join");
        continue;
      }
      if (e.event_type === "player_leave" || e.event_type === "player_kick") {
        setNotice(`${data.nickname ?? "SOMEONE"} LEFT`);
        playSound("leave");
        continue;
      }
      if (e.event_type === "chat") continue;

      try {
        const m = map(e);
        if (!m) continue;
        if (m.sound) playSound(m.sound);
        if (m.shake) triggerScreenShake(m.shake[0], m.shake[1]);
        if (m.feed) pushFeed(e.id, m.feed.text, !!m.feed.major);
        if (m.announcement) announce({ key: `e${e.id}`, ...m.announcement });
      } catch {
        // Presentation failures must never stall the authoritative game.
      }
    }
  }, [events, map, announce, pushFeed]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(t);
  }, [notice]);

  const chat = useMemo(
    () =>
      events
        .filter((e) => e.event_type === "chat")
        .slice(-40)
        .map((e) => ({
          id: e.id,
          nickname: String((e.event_data as { nickname?: string }).nickname ?? "???"),
          text: String((e.event_data as { text?: string }).text ?? ""),
        })),
    [events],
  );

  return { announcement, feed, reactions, notice, chat, announce };
}
