import { motion } from "framer-motion";
import { CardBack, GameCard } from "./Card";
import type { Card } from "@/game/gameTypes";
import { cn } from "@/lib/utils";

export function DrawPile({
  onDraw,
  disabled,
  pending,
  count,
}: {
  onDraw: () => void;
  disabled: boolean;
  pending: number;
  count?: number;
}) {
  return (
    <div className="relative flex flex-col items-center gap-2">
      <motion.button
        type="button"
        onClick={onDraw}
        disabled={disabled}
        whileHover={disabled ? {} : { y: -8, scale: 1.04 }}
        whileTap={disabled ? {} : { scale: 0.95 }}
        aria-label={pending > 0 ? `Take ${pending} cards` : "Draw a card"}
        className={cn("relative block", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}
      >
        <CardBack size="md" className="absolute -left-1.5 -top-1.5 rotate-[-6deg] opacity-70" />
        <CardBack size="md" className="absolute -left-0.5 -top-0.5 rotate-[-3deg] opacity-85" />
        <CardBack size="md" className={cn(!disabled && "glow-yellow")} />
      </motion.button>
      <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
        {pending > 0 ? (
          <span className="text-[var(--ono-red)]">TAKE {pending}</span>
        ) : (
          <span>DRAW{typeof count === "number" ? ` · ${count}` : ""}</span>
        )}
      </div>
    </div>
  );
}

export function DiscardPile({
  top,
  activeColor,
  direction,
}: {
  top: Card | null;
  activeColor: string | null;
  direction: number;
}) {
  return (
    <div className="relative flex flex-col items-center gap-2">
      <div
        className="absolute -inset-6 rounded-full blur-2xl"
        style={{ background: `color-mix(in oklab, var(--ono-${activeColor ?? "red"}) 32%, transparent)` }}
        aria-hidden
      />
      <div className="relative">
        {top ? (
          <motion.div
            key={top.id}
            initial={{ scale: 0.6, rotate: -25, y: -60, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 18 }}
          >
            <GameCard card={top} size="lg" disabled className="!opacity-100 !grayscale-0" />
          </motion.div>
        ) : (
          <CardBack size="lg" />
        )}
      </div>
      <div className="flex items-center gap-2 font-display text-[10px] uppercase tracking-widest">
        <span style={{ color: `var(--ono-${activeColor ?? "red"})` }}>{activeColor ?? "—"}</span>
        <motion.span
          animate={{ rotate: direction === 1 ? 0 : 180 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="text-muted-foreground"
        >
          ↻
        </motion.span>
      </div>
    </div>
  );
}
