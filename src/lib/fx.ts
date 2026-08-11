/**
 * Lightweight visual-effect bus: screen shake + reduced-motion awareness.
 * Effects are cosmetic only and never gate gameplay state.
 */
import { useEffect, useState } from "react";

type ShakeListener = (intensity: number, duration: number) => void;

const listeners = new Set<ShakeListener>();

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** intensity: 1 (subtle) – 3 (major event). */
export function triggerScreenShake(intensity = 1, duration = 380) {
  if (prefersReducedMotion()) return;
  for (const l of listeners) {
    try {
      l(Math.min(3, Math.max(0.5, intensity)), duration);
    } catch {
      /* an effect must never break gameplay */
    }
  }
}

export function useScreenShake() {
  const [shake, setShake] = useState<{ intensity: number; key: number } | null>(null);

  useEffect(() => {
    const listener: ShakeListener = (intensity, duration) => {
      setShake({ intensity, key: Date.now() });
      window.setTimeout(() => setShake(null), duration);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return shake;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
