/** Deterministic RNG so a game can be replayed from its seed. */
export interface Rng {
  seed: number;
  counter: number;
}

export function nextFloat(rng: Rng): number {
  rng.counter += 1;
  let t = (rng.seed + rng.counter * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(nextFloat(rng) * maxExclusive);
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

export function makeSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
