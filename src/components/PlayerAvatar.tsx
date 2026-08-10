import { motion } from "framer-motion";
import { Crown, WifiOff } from "lucide-react";
import { avatarOf } from "@/lib/avatars";
import { cn } from "@/lib/utils";

interface Props {
  avatar: string;
  nickname: string;
  isHost?: boolean;
  connected?: boolean;
  active?: boolean;
  eliminated?: boolean;
  cardCount?: number;
  size?: "sm" | "md" | "lg";
  reaction?: string | null;
  className?: string;
}

const SIZES = {
  sm: "h-10 w-10 text-lg",
  md: "h-14 w-14 text-2xl",
  lg: "h-20 w-20 text-4xl",
};

export function PlayerAvatar({
  avatar,
  nickname,
  isHost,
  connected = true,
  active,
  eliminated,
  cardCount,
  size = "md",
  reaction,
  className,
}: Props) {
  const def = avatarOf(avatar);
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative">
        <motion.div
          animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 1.2, repeat: active ? Infinity : 0 }}
          className={cn(
            "grid place-items-center rounded-2xl border-2 noise",
            SIZES[size],
            active ? "animate-turn-ring border-[var(--ono-yellow)]" : "border-border",
            eliminated ? "opacity-40 grayscale" : "",
          )}
          style={{ background: `color-mix(in oklab, ${def.hue} 26%, var(--surface))` }}
        >
          <span aria-hidden>{def.emoji}</span>
        </motion.div>
        {isHost ? (
          <Crown
            className="absolute -right-1.5 -top-2 h-4 w-4 text-[var(--ono-yellow)]"
            aria-label="Host"
          />
        ) : null}
        {!connected ? (
          <span className="absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--ono-red)]">
            <WifiOff className="h-3 w-3 text-white" aria-label="Disconnected" />
          </span>
        ) : null}
        {reaction ? (
          <motion.span
            key={reaction}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -58, scale: 1.4 }}
            transition={{ duration: 1.8 }}
            className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-3xl"
          >
            {reaction}
          </motion.span>
        ) : null}
      </div>
      <div className="max-w-[92px] truncate font-display text-[11px] uppercase tracking-wide">{nickname}</div>
      {typeof cardCount === "number" ? (
        <div
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
            cardCount >= 20
              ? "border-[var(--ono-red)] text-[var(--ono-red)]"
              : "border-border text-muted-foreground",
          )}
        >
          {eliminated ? "OUT" : `${cardCount} CARDS`}
        </div>
      ) : null}
    </div>
  );
}
