import { AnimatePresence, motion } from "framer-motion";

export type AnnouncementTone = "red" | "yellow" | "green" | "blue" | "violet";

export interface Announcement {
  key: string;
  text: string;
  sub?: string | null;
  tone: AnnouncementTone;
  /** Higher wins when two announcements compete for the screen. */
  priority: number;
  ms: number;
}

/**
 * Single, non-stacking announcement surface. Text only — never a game gate.
 */
export function GameAnnouncement({ announcement }: { announcement: Announcement | null }) {
  return (
    <AnimatePresence mode="wait">
      {announcement ? (
        <motion.div
          key={announcement.key}
          initial={{ opacity: 0, scale: 2.4, filter: "blur(14px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 1.25, y: -30, filter: "blur(6px)" }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
          className="pointer-events-none fixed inset-x-0 top-1/2 z-40 -translate-y-1/2 px-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <span
              className="text-stroke-black font-display text-[13vw] uppercase leading-[0.9] sm:text-7xl"
              style={{
                color: `var(--ono-${announcement.tone})`,
                textShadow: "0 12px 44px oklch(0 0 0 / 0.85)",
              }}
            >
              {announcement.text}
            </span>
            {announcement.sub ? (
              <span className="font-display text-xs uppercase tracking-[0.35em] text-white/80 sm:text-sm">
                {announcement.sub}
              </span>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
