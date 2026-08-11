import { AnimatePresence, motion } from "framer-motion";

export interface Burst {
  id: number;
  nickname: string;
  emoji: string;
}

/** Floating emote bubbles shown to everyone in the room, lobby or table. */
export function ReactionBursts({ bursts }: { bursts: Burst[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2">
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 30, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 1.2 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="panel flex items-center gap-2 px-3 py-1.5"
          >
            <span className="text-2xl" aria-hidden>
              {b.emoji}
            </span>
            <span className="font-display text-[10px] uppercase tracking-widest text-[var(--ono-yellow)]">
              {b.nickname}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
