import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { GameCard } from "./Card";
import type { Card, CardColor } from "@/game/gameTypes";
import { playSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";

const COLORS: Exclude<CardColor, "wild">[] = ["red", "yellow", "green", "blue"];

interface Props {
  hand: Card[];
  playable: string[];
  myTurn: boolean;
  onPlay: (cardId: string, color?: Exclude<CardColor, "wild">) => void;
  hint: string | null;
}

export function PlayerHand({ hand, playable, myTurn, onPlay, hint }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [wildFor, setWildFor] = useState<string | null>(null);

  const handle = (card: Card) => {
    if (!myTurn || !playable.includes(card.id)) return;
    playSound("select");
    if (card.color === "wild") {
      setWildFor(card.id);
      return;
    }
    setSelected(card.id);
    onPlay(card.id);
    setTimeout(() => setSelected(null), 400);
  };

  return (
    <div className="relative w-full">
      <AnimatePresence>
        {wildFor ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/85 px-6"
          >
            <div className="w-full max-w-sm text-center">
              <motion.h2
                initial={{ scale: 0.7, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="font-display text-3xl uppercase text-[var(--ono-yellow)]"
              >
                Pick your poison
              </motion.h2>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {COLORS.map((c, i) => (
                  <motion.button
                    key={c}
                    type="button"
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.06, type: "spring", stiffness: 400, damping: 18 }}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      playSound("special");
                      onPlay(wildFor, c);
                      setWildFor(null);
                    }}
                    className="h-24 rounded-2xl border-2 border-white/80 font-display text-lg uppercase text-white noise"
                    style={{ background: `var(--ono-${c})` }}
                  >
                    {c}
                  </motion.button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setWildFor(null)}
                className="mt-5 font-display text-xs uppercase tracking-widest text-muted-foreground underline"
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

      <div className="hide-scrollbar flex w-full items-end justify-start gap-0 overflow-x-auto px-4 pb-3 pt-8 sm:justify-center">
        <AnimatePresence initial={false}>
          {hand.map((card, i) => {
            const ok = myTurn && playable.includes(card.id);
            return (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, y: 70, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -220, scale: 0.5, rotate: 25 }}
                transition={{ type: "spring", stiffness: 340, damping: 26, delay: Math.min(i * 0.02, 0.3) }}
                className={cn("-ml-5 first:ml-0 sm:-ml-4")}
                style={{ zIndex: i }}
              >
                <GameCard
                  card={card}
                  size="md"
                  disabled={!ok}
                  selected={selected === card.id}
                  onClick={() => handle(card)}
                  onHoverStart={() => ok && playSound("hover")}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
