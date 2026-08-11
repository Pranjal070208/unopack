import { motion, AnimatePresence } from "framer-motion";
import { CardBack, GameCard } from "./Card";
import type { Card } from "@/game/gameTypes";
import { cn } from "@/lib/utils";

const COLOR_LABEL: Record<string, string> = {
  red: "RED",
  yellow: "YELLOW",
  green: "GREEN",
  blue: "BLUE",
};

interface Props {
  top: Card | null;
  activeColor: string | null;
  direction: number;
  pending: number;
  canStack: boolean;
  myTurn: boolean;
  deckCount?: number | undefined;
  onDraw: () => void;
  compact?: boolean;
}

/** Draw pile, discard pile, direction, colour and draw-stack readouts. */
export function CenterTable({
  top,
  activeColor,
  direction,
  pending,
  canStack,
  myTurn,
  deckCount,
  onDraw,
  compact,
}: Props) {
  const color = activeColor ?? "red";
  const cardSize = compact ? "md" : "lg";

  return (
    <div className="relative flex flex-col items-center gap-3">
      {/* Direction ring */}
      <motion.div
        aria-hidden
        animate={{ rotate: direction === 1 ? 360 : -360 }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        className={cn(
          "pointer-events-none absolute rounded-full border-2 border-dashed border-white/10",
          compact ? "-inset-8" : "-inset-14",
        )}
      />

      <AnimatePresence>
        {pending > 0 ? (
          <motion.div
            key="stack"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="panel flex flex-col items-center px-4 py-1.5"
            style={{ borderColor: "var(--ono-red)" }}
          >
            <span className="font-display text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              Draw stack
            </span>
            <motion.span
              key={pending}
              initial={{ scale: 1.8 }}
              animate={{ scale: 1 }}
              className="font-display text-2xl leading-none text-[var(--ono-red)]"
            >
              +{pending}
            </motion.span>
            {myTurn ? (
              <span className="font-display text-[9px] uppercase tracking-widest text-[var(--ono-yellow)]">
                {canStack ? `Play +${pending} or higher` : `Draw ${pending}`}
              </span>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className={cn("flex items-center justify-center", compact ? "gap-6" : "gap-12")}>
        {/* Draw pile with depth */}
        <div className="flex flex-col items-center gap-2">
          <motion.button
            type="button"
            onClick={onDraw}
            disabled={!myTurn}
            whileHover={myTurn ? { y: -8, scale: 1.05 } : {}}
            whileTap={myTurn ? { scale: 0.94 } : {}}
            aria-label={pending > 0 ? `Take ${pending} cards` : "Draw a card"}
            className={cn("relative block", myTurn ? "cursor-pointer" : "cursor-not-allowed opacity-70")}
            style={{ perspective: 900 }}
          >
            <CardBack size={cardSize} className="absolute -left-2 -top-2 rotate-[-7deg] opacity-60" />
            <CardBack size={cardSize} className="absolute -left-1 -top-1 rotate-[-3.5deg] opacity-80" />
            <CardBack size={cardSize} className={cn(myTurn && "glow-yellow")} />
          </motion.button>
          <span className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
            Draw{typeof deckCount === "number" ? ` · ${deckCount}` : ""}
          </span>
        </div>

        {/* Discard pile */}
        <div className="relative flex flex-col items-center gap-2">
          <motion.div
            key={color}
            initial={{ opacity: 0.2, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-none absolute -inset-8 rounded-full blur-2xl"
            style={{ background: `color-mix(in oklab, var(--ono-${color}) 34%, transparent)` }}
            aria-hidden
          />
          <div className="relative" style={{ perspective: 900 }}>
            <CardBack size={cardSize} className="absolute left-1.5 top-1 rotate-[8deg] opacity-40" />
            <CardBack size={cardSize} className="absolute -left-1 top-0.5 rotate-[-5deg] opacity-40" />
            <AnimatePresence mode="popLayout">
              {top ? (
                <motion.div
                  key={top.id}
                  initial={{ scale: 0.55, rotate: -28, y: -120, opacity: 0 }}
                  animate={{ scale: [1.12, 1], rotate: [4, 0], y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 17 }}
                  className="relative"
                >
                  <GameCard card={top} size={cardSize} disabled className="!opacity-100 !grayscale-0" />
                </motion.div>
              ) : (
                <CardBack size={cardSize} />
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 font-display text-[10px] uppercase tracking-widest">
            <span
              className="rounded-full border px-2 py-0.5"
              style={{ color: `var(--ono-${color})`, borderColor: `var(--ono-${color})` }}
            >
              {COLOR_LABEL[color] ?? "—"}
            </span>
            <motion.span
              key={direction}
              initial={{ rotate: direction === 1 ? -180 : 180, scale: 1.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="text-muted-foreground"
              aria-label={direction === 1 ? "Clockwise" : "Counter-clockwise"}
            >
              {direction === 1 ? "↻" : "↺"}
            </motion.span>
          </div>
        </div>
      </div>
    </div>
  );
}
