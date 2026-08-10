import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export interface Effect {
  id: string | number;
  text: string;
  tone?: "red" | "yellow" | "green" | "blue";
}

export function EffectLayer({ effect }: { effect: Effect | null }) {
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!effect) return;
    setShake(true);
    const t = setTimeout(() => setShake(false), 480);
    return () => clearTimeout(t);
  }, [effect]);

  return (
    <>
      <AnimatePresence>
        {effect ? (
          <motion.div
            key={effect.id}
            initial={{ opacity: 0, scale: 3, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: -4 }}
            exit={{ opacity: 0, scale: 1.4, y: -40 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="pointer-events-none fixed inset-0 z-40 grid place-items-center"
          >
            <span
              className="text-stroke-black px-6 text-center font-display text-5xl uppercase leading-none sm:text-7xl"
              style={{ color: `var(--ono-${effect.tone ?? "yellow"})`, textShadow: "0 10px 40px oklch(0 0 0 / 0.8)" }}
            >
              {effect.text}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {shake ? <div className="pointer-events-none fixed inset-0 z-30 animate-chaos-shake bg-white/5" /> : null}
    </>
  );
}

export function Particles({ trigger, color = "yellow" }: { trigger: number; color?: string }) {
  if (!trigger) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.span
          key={`${trigger}-${i}`}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{
            opacity: 0,
            x: Math.cos((i / 10) * Math.PI * 2) * 70,
            y: Math.sin((i / 10) * Math.PI * 2) * 70,
            scale: 0.2,
          }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
          style={{ background: `var(--ono-${color})` }}
        />
      ))}
    </div>
  );
}
