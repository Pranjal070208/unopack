import { motion } from "framer-motion";
import { Crown, Skull, WifiOff } from "lucide-react";
import { avatarOf } from "@/lib/avatars";
import { GAME_CONFIG } from "@/game/config";
import type { PlayerRow } from "@/hooks/useRoom";
import { getPlayerSeatPosition, type TableSize } from "@/game/seats";
import { cn } from "@/lib/utils";

interface Props {
  players: PlayerRow[];
  meId: string | null;
  currentPlayerId: string | null;
  reactions: Record<string, string>;
  size: TableSize;
  /** Player currently in the UNO window, if any. */
  unoPlayerId?: string | null;
}

const MERCY = GAME_CONFIG.MERCY_LIMIT;

/**
 * Opponent seats. Desktop/tablet use the circular seat engine; mobile falls
 * back to a compact strip so the centre and the local hand stay unobstructed.
 */
export function TableSeats({ players, meId, currentPlayerId, reactions, size, unoPlayerId }: Props) {
  const localIndex = players.findIndex((p) => p.id === meId);
  const opponents = players.filter((p) => p.id !== meId);

  if (size === "mobile") {
    return (
      <div className="hide-scrollbar flex flex-wrap justify-center gap-1.5 px-2">
        {opponents.map((p) => (
          <Seat
            key={p.id}
            player={p}
            active={p.id === currentPlayerId}
            reaction={reactions[p.id] ?? null}
            uno={unoPlayerId === p.id}
            scale={opponents.length > 5 ? 0.78 : 0.92}
            compact
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {players.map((p, i) => {
        if (p.id === meId) return null;
        const pos = getPlayerSeatPosition(i, players.length, localIndex, size);
        return (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, left: `${pos.x}%`, top: `${pos.y}%`, rotate: pos.rotation, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <Seat
              player={p}
              active={p.id === currentPlayerId}
              reaction={reactions[p.id] ?? null}
              uno={unoPlayerId === p.id}
              scale={pos.scale}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function Seat({
  player,
  active,
  reaction,
  uno,
  scale,
  compact,
}: {
  player: PlayerRow;
  active: boolean;
  reaction: string | null;
  uno: boolean;
  scale: number;
  compact?: boolean;
}) {
  const def = avatarOf(player.avatar);
  const danger = player.card_count >= MERCY - 1 && !player.eliminated;

  return (
    <motion.div
      layout
      animate={{ scale: active ? scale * 1.1 : scale }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={cn(
        "panel relative flex flex-col items-center gap-1 px-2 py-1.5",
        compact ? "min-w-[62px]" : "min-w-[92px]",
        active && "border-[var(--ono-yellow)]",
        player.eliminated && "opacity-45 grayscale",
      )}
      style={{ boxShadow: active ? "var(--glow-yellow)" : "var(--shadow-card)" }}
    >
      {active ? (
        <motion.span
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "linear" }}
          className="pointer-events-none absolute -inset-1 rounded-[inherit] border-2 border-dashed border-[var(--ono-yellow)]/70"
        />
      ) : null}

      <div className="relative">
        <div
          className={cn(
            "grid place-items-center rounded-xl border-2 noise",
            compact ? "h-8 w-8 text-base" : "h-11 w-11 text-xl",
            active ? "border-[var(--ono-yellow)]" : "border-border",
          )}
          style={{ background: `color-mix(in oklab, ${def.hue} 26%, var(--surface))` }}
        >
          <span aria-hidden>{def.emoji}</span>
        </div>
        {player.is_host ? (
          <Crown className="absolute -right-2 -top-2 h-3.5 w-3.5 text-[var(--ono-yellow)]" aria-label="Host" />
        ) : null}
        {!player.is_connected ? (
          <span className="absolute -bottom-1 -left-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--ono-red)]">
            <WifiOff className="h-2.5 w-2.5 text-white" aria-label="Disconnected" />
          </span>
        ) : null}
        {player.eliminated ? (
          <Skull className="absolute -right-2 -bottom-2 h-4 w-4 text-[var(--ono-red)]" aria-label="Eliminated" />
        ) : null}
        {reaction ? (
          <motion.span
            key={reaction}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], y: -52, scale: 1.3 }}
            transition={{ duration: 1.8 }}
            className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 text-2xl"
          >
            {reaction}
          </motion.span>
        ) : null}
        {uno && !player.eliminated ? (
          <motion.span
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ duration: 0.7, repeat: Infinity }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--ono-yellow)] px-1.5 font-display text-[8px] uppercase text-black"
          >
            ONO
          </motion.span>
        ) : null}
      </div>

      <span
        className={cn(
          "max-w-[84px] truncate font-display uppercase tracking-wide",
          compact ? "text-[9px]" : "text-[10px]",
        )}
      >
        {player.nickname}
      </span>

      <span
        className={cn(
          "rounded-full border px-1.5 text-[9px] font-bold tabular-nums",
          player.eliminated
            ? "border-[var(--ono-red)] text-[var(--ono-red)]"
            : danger
              ? "animate-pulse border-[var(--ono-red)] text-[var(--ono-red)]"
              : "border-border text-muted-foreground",
        )}
      >
        {player.eliminated ? "OUT" : `${player.card_count}`}
      </span>

      {active ? (
        <span className="font-display text-[8px] uppercase tracking-[0.2em] text-[var(--ono-yellow)]">Turn</span>
      ) : null}
    </motion.div>
  );
}
