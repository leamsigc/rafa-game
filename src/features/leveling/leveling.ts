/**
 * Happy's XP / level curve.
 *
 * Levelling is deliberately slow-burn: every level costs MORE XP than the one
 * before it, so you never get stuck needing a flat 100 XP forever. The early
 * levels are cheap (100, 300, 600, 1000…) and the curve keeps climbing until
 * the hard ceiling of `MAX_LEVEL`.
 *
 * Curve: XP needed to go from level L to L+1 is `50 * L * (L + 1)`.
 *   L1 → 2  = 100
 *   L2 → 3  = 300
 *   L3 → 4  = 600
 *   L4 → 5  = 1000
 *   L5 → 6  = 1500
 *   ...
 * The cumulative XP to reach level N (from level 1) is the neat closed form
 * `50 * n * (n + 1) * (n + 2) / 3` with `n = N - 1`.
 */

/** The absolute maximum level a pup can ever reach. */
export const MAX_LEVEL = 1000;

/** XP required to advance FROM `level` to `level + 1`. Always increasing. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  if (l >= MAX_LEVEL) return Number.POSITIVE_INFINITY;
  return 50 * l * (l + 1);
}

/** Total XP required to reach `level` starting from level 1 (level 1 = 0 XP). */
export function totalXpForLevel(level: number): number {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  const n = clamped - 1;
  // Σ 50·i·(i+1) = 50 · n(n+1)(n+2)/3
  return (50 * n * (n + 1) * (n + 2)) / 3;
}

export interface LevelInfo {
  /** Current level, 1 … MAX_LEVEL. */
  level: number;
  /** XP earned inside the current level (0 … xpForNext). */
  xpIntoLevel: number;
  /** XP required to finish the current level (Infinity at MAX_LEVEL). */
  xpForNext: number;
  /** XP still missing for the next level (Infinity at MAX_LEVEL). */
  xpToNext: number;
  /** Fill ratio 0 … 1 for the current level's bar. */
  progress: number;
  /** True once the pup has hit the MAX_LEVEL ceiling. */
  isMax: boolean;
}

/**
 * Turn a raw XP total into a full level readout. Uses a binary search so it
 * stays exact (and cheap) even at very large XP totals.
 */
export function getLevelInfo(xp: number): LevelInfo {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);

  // Largest level whose cumulative requirement still fits under `safeXp`.
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (totalXpForLevel(mid) <= safeXp) lo = mid;
    else hi = mid - 1;
  }
  const level = lo;

  if (level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL,
      xpIntoLevel: safeXp - totalXpForLevel(MAX_LEVEL),
      xpForNext: Number.POSITIVE_INFINITY,
      xpToNext: Number.POSITIVE_INFINITY,
      progress: 1,
      isMax: true,
    };
  }

  const base = totalXpForLevel(level);
  const xpForNext = xpForLevel(level);
  const xpIntoLevel = safeXp - base;
  return {
    level,
    xpIntoLevel,
    xpForNext,
    xpToNext: Math.max(0, xpForNext - xpIntoLevel),
    progress: Math.min(1, Math.max(0, xpIntoLevel / xpForNext)),
    isMax: false,
  };
}

/** Convenience: just the level for a raw XP total. */
export function levelFromXp(xp: number): number {
  return getLevelInfo(xp).level;
}
