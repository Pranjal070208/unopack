import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { GameCard } from "./Card";
import type { Card, CardColor } from "@/game/gameTypes";
import { describeCard } from "@/game/cardTypes";
import { playSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";

const COLORS: Exclude<CardColor, "wild">[] = ["red", "yellow", "green", "blue"];

interface Props {
  hand: Card[];
  playable: string[];
  myTurn: boolean;
  onPlay: (cardId: string, color?: Exclude<CardColor, "wild">) => void;
  hint: string | null;
  /** Touch layout uses tap-to-select then confirm, avoiding misplays. */
  touch: boolean;
}

/** Card geometry adapts to hand size so 24 cards never destroy the layout. */
function layoutFor(count: number) {
  if (count <= 7) return { size: "md" as const, overlap: -14 };
  if (count <= 12) return { size: "md" as const, overlap: -34 };
  if (count <= 18) return { size: "sm" as const, overlap: -20 };
  return { size: "sm" as const, overlap: -28 };
}

export function PlayerHand({ hand, playable, myTurn, onPlay, hint, touch }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [wildFor, setWildFor] = useState<string | null>(null);
  const [flying, setFlying] = useState<string | null>(null);
  const { size, overlap } = layoutFor(hand.length);

  useEffect(() => {
    if (selected && !hand.some((c) => c.id === selected)) setSelected(null);
  }, [hand, selected]);

  const commit = (card: Card) => {
    if (card.color === "wild") {
      setWildFor(card.id);
      return;
    }
    setFlying(card.id);
    playSound("play");
    onPlay(card.id);
    window.setTimeout(() => setFlying(null), 500);
    setSelected(null);
  };

  const handle = (card: Card) => {
    if (!myTurn || !playable.includes(card.id)) return;
    if (touch && selected !== card.id) {
      playSound("select");
      setSelected(card.id);
      return;
    }
    playSound("select");
    commit(card);
  };

  const selectedCard = hand.find((c) => c.id === selected) ?? null;

  return (
    <div className="relative w-full">
      <AnimatePresence>
        {wildFor ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/88 px-6 backdrop-blur-sm"
          >
            <div className="w-full max-w-sm text-center">
              <motion.h2
                initial={{ scale: 0.6, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="font-display text-3xl uppercase text-[var(--ono-yellow)]"
              >
                Choose color
              </motion.h2>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {COLORS.map((c, i) => (
                  <motion.button
                    key={c}
                    type="button"
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.06, type: "spring", stiffness: 400, damping: 18 }}
                    whileHover={{ scale: 1.07, boxShadow: "var(--glow-yellow)" }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => {
                      playSound("special");
                      onPlay(wildFor, c);
                      setWildFor(null);
                      setSelected(null);
                    }}
                    className="grid h-24 min-h-11 place-items-center rounded-2xl border-2 border-white/80 font-display text-lg uppercase text-white noise"
                    style={{ background: `var(--ono-${c})` }}
                  >
                    {c}
                  </motion.button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setWildFor(null)}
                className="mt-5 min-h-11 font-display text-xs uppercase tracking-widest text-muted-foreground underline"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {hint ? (
        <div className="mb-1 text-center font-display text-[10px] uppercase tracking-widest text-[var(--ono-yellow)]">
          {hint}
        </div>
      ) : null}

      {/* Selected-card preview + explicit confirm on touch devices */}
      <AnimatePresence>
        {touch && selectedCard ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="mb-2 flex items-center justify-center gap-3"
          >
            <span className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
              {describeCard(selectedCard)}
            </span>
            <button
              type="button"
              onClick={() => commit(selectedCard)}
              className="min-h-11 rounded-full border-2 border-white/80 px-5 font-display text-sm uppercase tracking-widest text-white"
              style={{ background: "var(--ono-red)", boxShadow: "var(--shadow-card)" }}
            >
              Play card
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className="hide-scrollbar flex w-full items-end justify-start overflow-x-auto px-4 pb-3 pt-9 sm:justify-center"
        role="group"
        aria-label="Your hand"
      >
        <AnimatePresence initial={false}>
          {hand.map((card, i) => {
            const ok = myTurn && playable.includes(card.id);
            return (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, y: 80, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: flying === card.id ? -240 : 0,
                  scale: flying === card.id ? 0.6 : 1,
                  rotate: flying === card.id ? 22 : (i - (hand.length - 1) / 2) * (hand.length > 12 ? 0.8 : 1.8),
                }}
                exit={{ opacity: 0, y: -240, scale: 0.5, rotate: 24 }}
                transition={{ type: "spring", stiffness: 340, damping: 26, delay: Math.min(i * 0.015, 0.25) }}
                className="first:!ml-0"
                style={{ marginLeft: overlap, zIndex: selected === card.id ? 99 : i }}
              >
                <GameCard
                  card={card}
                  size={size}
                  disabled={!ok}
                  selected={selected === card.id}
                  onClick={() => handle(card)}
                  onHoverStart={() => ok && playSound("hover")}
                  className={cn(ok && !touch && "hover:z-50")}
                />
                {ok ? (
                  <span className="mt-0.5 block text-center font-display text-[7px] uppercase tracking-widest text-[var(--ono-green)]">
                    Playable
                  </span>
                ) : (
                  <span className="mt-0.5 block h-[9px]" aria-hidden />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
