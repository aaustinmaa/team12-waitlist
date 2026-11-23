// Small shared helpers for the engine: UTC day arithmetic, a seeded random
// number generator (same inputs, same range) and quantiles.

const DAY = 86_400_000;

export const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const toDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => toDay(new Date(toDate(s).getTime() + n * DAY));
export const daysBetween = (from: string, to: string) => Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY);
export const weeksBetween = (from: string, to: string) => daysBetween(from, to) / 7;

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function poisson(rand: () => number, mean: number) {
  if (mean <= 0) return 0;
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rand();
  while (p > limit) {
    k++;
    p *= rand();
  }
  return k;
}

/** Number of successes in n trials of probability p (exact for the small n a waitlist has). */
export function binomial(rand: () => number, n: number, p: number) {
  if (p <= 0 || n <= 0) return 0;
  let k = 0;
  for (let i = 0; i < n; i++) if (rand() < p) k++;
  return k;
}

/** Linear-interpolated quantile of an ascending array. */
export function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (!Number.isFinite(sorted[hi])) return sorted[hi];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export const median = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5);
