import { motion } from "framer-motion";
import { useMemo } from "react";
import { GameButton } from "./GameButton";
import { PlayerAvatar } from "./PlayerAvatar";
import type { EventRow, PlayerRow } from "@/hooks/useRoom";

const MEDALS = ["🥇", "🥈", "🥉"];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ y: -40, x: `${(i * 37) % 100}%`, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2.4 + (i % 5) * 0.5, repeat: Infinity, delay: (i % 10) * 0.18 }}
          className="absolute h-3 w-2 rounded-sm"
          style={{
            background: ["var(--ono-red)", "var(--ono-yellow)", "var(--ono-green)", "var(--ono-blue)"][i % 4],
          }}
        />
      ))}
    </div>
  );
}

interface Props {
  players: PlayerRow[];
  winnerId: string | null;
  events: EventRow[];
  isHost: boolean;
  onPlayAgain: () => void;
  onLobby: () => void;
  onShare: () => void;
}

export function VictoryScreen({ players, winnerId, events, isHost, onPlayAgain, onLobby, onShare }: Props) {
  const winner = players.find((p) => p.id === winnerId);

  const stats = useMemo(() => {
    const plays = events.filter((e) => e.event_type === "CARD_PLAYED");
    const draws = events.filter((e) => e.event_type === "CARD_DRAWN" || e.event_type === "DRAW_STACK_RESOLVED");
    const specials = plays.filter((e) => {
      const card = (e.event_data as { card?: { type?: string } }).card;
      return !!card?.type && card.type !== "number";
    });

    const biggestDraw = draws.reduce((max, e) => Math.max(max, Number((e.event_data as { count?: number }).count ?? 0)), 0);
    const savage = specials.reduce<Record<string, number>>((acc, e) => {
      if (e.player_id) acc[e.player_id] = (acc[e.player_id] ?? 0) + 1;
      return acc;
    }, {});
    const savageId = Object.entries(savage).sort((a, b) => b[1] - a[1])[0]?.[0];
    const chaos = Math.min(99, Math.round((specials.length * 6 + biggestDraw * 3 + draws.length * 2) % 100) || 42);
    return {
      played: plays.length,
      drawn: draws.reduce((sum, e) => sum + Number((e.event_data as { count?: number }).count ?? 0), 0),
      specials: specials.length,
      biggestDraw,
      turns: plays.length + draws.length,
      chaos,
      savage: players.find((p) => p.id === savageId)?.nickname ?? "NOBODY",
    };
  }, [events, players]);

  const ranking = players
    .slice()
    .sort((a, b) => {
      if (a.id === winnerId) return -1;
      if (b.id === winnerId) return 1;
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return a.card_count - b.card_count;
    });

  return (
    <div className="relative min-h-[100dvh] overflow-hidden px-4 py-8">
      <Confetti />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.h1
          initial={{ scale: 3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="text-stroke-black font-display text-6xl uppercase leading-none text-[var(--ono-red)] sm:text-8xl"
        >
          No mercy.
        </motion.h1>
        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-3 font-display text-2xl uppercase text-[var(--ono-yellow)] sm:text-4xl"
        >
          {winner?.nickname ?? "NOBODY"} wins!
        </motion.p>

        <div className="panel mt-8 w-full p-5">
          <h2 className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">Final standings</h2>
          <ul className="mt-4 space-y-2">
            {ranking.map((p, i) => (
              <motion.li
                key={p.id}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-[var(--surface)] px-3 py-2"
              >
                <span className="w-7 text-lg">{MEDALS[i] ?? `#${i + 1}`}</span>
                <PlayerAvatar avatar={p.avatar} nickname={p.nickname} size="sm" />
                <span className="ml-auto font-display text-[11px] uppercase text-muted-foreground">
                  {p.id === winnerId ? "WINNER" : p.eliminated ? "ELIMINATED" : `${p.card_count} left`}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="panel mt-4 grid w-full grid-cols-2 gap-3 p-5 text-left sm:grid-cols-3">
          <Stat label="Chaos level" value={`${stats.chaos}%`} />
          <Stat label="Most savage" value={stats.savage} />
          <Stat label="Biggest draw" value={`${stats.biggestDraw} cards`} />
          <Stat label="Cards played" value={String(stats.played)} />
          <Stat label="Cards drawn" value={String(stats.drawn)} />
          <Stat label="Total turns" value={String(stats.turns)} />
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {isHost ? (
            <>
              <GameButton size="lg" pulse onClick={onPlayAgain}>
                Play again
              </GameButton>
              <GameButton size="lg" variant="ghost" onClick={onLobby}>
                Back to lobby
              </GameButton>
            </>
          ) : (
            <p className="font-display text-sm uppercase tracking-widest text-muted-foreground">
              Waiting for host to restart…
            </p>
          )}
          <GameButton size="lg" variant="secondary" onClick={onShare}>
            Share room
          </GameButton>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-lg text-[var(--ono-yellow)]">{value}</p>
    </div>
  );
}
