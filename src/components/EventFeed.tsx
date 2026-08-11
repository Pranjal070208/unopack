import { AnimatePresence, motion } from "framer-motion";
import type { FeedItem } from "@/hooks/useGameEventAnimations";
import { cn } from "@/lib/utils";

/** Compact running commentary of authoritative events. */
export function EventFeed({ items, className }: { items: FeedItem[]; className?: string }) {
  return (
    <div className={cn("pointer-events-none flex flex-col items-start gap-1", className)} aria-live="polite">
      <AnimatePresence initial={false}>
        {items.slice(-4).map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: -24, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -16, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={cn(
              "rounded-lg border px-2 py-1 font-display text-[9px] uppercase tracking-widest backdrop-blur-sm",
              item.major
                ? "border-[var(--ono-yellow)]/60 bg-black/60 text-[var(--ono-yellow)]"
                : "border-border bg-black/40 text-muted-foreground",
            )}
          >
            {item.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
