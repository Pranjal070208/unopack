import { motion } from "framer-motion";
import { GameCard } from "./Card";
import type { Card } from "@/game/gameTypes";

const DECOR: Card[] = [
  { id: "d1", color: "red", type: "number", value: 7 },
  { id: "d2", color: "yellow", type: "skip" },
  { id: "d3", color: "blue", type: "draw2" },
  { id: "d4", color: "green", type: "number", value: 4 },
  { id: "d5", color: "wild", type: "wilddraw10" },
  { id: "d6", color: "red", type: "reverse" },
  { id: "d7", color: "blue", type: "number", value: 9 },
  { id: "d8", color: "wild", type: "wildroulette" },
];


const POSITIONS = [
  { left: "6%", top: "14%", r: -18, s: 1 },
  { left: "82%", top: "10%", r: 14, s: 0.9 },
  { left: "14%", top: "68%", r: 12, s: 1.1 },
  { left: "76%", top: "62%", r: -14, s: 1 },
  { left: "45%", top: "6%", r: 8, s: 0.75 },
  { left: "30%", top: "84%", r: -8, s: 0.8 },
  { left: "60%", top: "80%", r: 20, s: 0.9 },
  { left: "92%", top: "38%", r: -22, s: 0.7 },
];

export function FloatingCards() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {DECOR.map((card, i) => {
        const p = POSITIONS[i]!;
        return (
          <motion.div
            key={card.id}
            className="absolute opacity-40 blur-[0.4px]"
            style={{ left: p.left, top: p.top, scale: p.s }}
            initial={{ y: 0, rotate: p.r }}
            animate={{ y: [0, -28, 0], rotate: [p.r, p.r + 8, p.r] }}
            transition={{ duration: 7 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          >
            <GameCard card={card} size="lg" disabled className="!opacity-100 !grayscale-0" />
          </motion.div>
        );
      })}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
    </div>
  );
}
