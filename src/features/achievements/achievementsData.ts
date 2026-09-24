import { Achievement, AchievementContext } from "../../types/pet";

/**
 * Milestone badges tracked across the whole game. Evaluated after every
 * meaningful event; new unlocks toast in the HUD and land in the
 * Settings → Achievements tab.
 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "trick_master",
    name: "Master of Tricks",
    icon: "🎓",
    description: "Learn all three trainable tricks (Sit, Stay & Fetch) to proficiency.",
    progress: (ctx) => {
      const t = ctx.stats.trickProgress || {};
      const learned = ["sit", "stay", "fetch"].filter((k) => (t[k] || 0) >= 40).length;
      return { current: learned, goal: 3 };
    },
    unlocked: (ctx) => {
      const t = ctx.stats.trickProgress || {};
      return ["sit", "stay", "fetch"].every((k) => (t[k] || 0) >= 40);
    },
  },
  {
    id: "bone_collector",
    name: "Bone Collector",
    icon: "🦴",
    description: "Earn 500 Treat Coins over your whole adventure.",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.coinsEarned || 0, 500), goal: 500 }),
    unlocked: (ctx) => (ctx.lifetime.coinsEarned || 0) >= 500,
  },
  {
    id: "shutterbug",
    name: "Shutterbug",
    icon: "📸",
    description: "Capture your very first Photo Mode snapshot.",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.photoCaptures || 0, 1), goal: 1 }),
    unlocked: (ctx) => (ctx.lifetime.photoCaptures || 0) >= 1,
  },
  {
    id: "dear_diary",
    name: "Dear Diary",
    icon: "🎙️",
    description: "Listen to your first Voice Journal daily recap.",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.journalListens || 0, 1), goal: 1 }),
    unlocked: (ctx) => (ctx.lifetime.journalListens || 0) >= 1,
  },
  {
    id: "code_cracker",
    name: "Code Cracker",
    icon: "🔐",
    description: "Discover a secret chat code (they hide in capital letters, small letters and numbers...).",
    progress: (ctx) => {
      const found = (ctx.stats.foundSecretCodes || []).length;
      return { current: Math.min(found, 1), goal: 1 };
    },
    unlocked: (ctx) => (ctx.stats.foundSecretCodes || []).length >= 1,
  },
  {
    id: "master_of_secrets",
    name: "Master of Secrets",
    icon: "🕵️",
    description: "Find ALL three secret chat codes hidden in the kingdom.",
    progress: (ctx) => {
      const found = (ctx.stats.foundSecretCodes || []).length;
      return { current: Math.min(found, 3), goal: 3 };
    },
    unlocked: (ctx) => (ctx.stats.foundSecretCodes || []).length >= 3,
  },
  {
    id: "road_tripper",
    name: "Road Tripper",
    icon: "🚗",
    description: "Take the little car from home all the way to the City Park.",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.carRides || 0, 1), goal: 1 }),
    unlocked: (ctx) => (ctx.lifetime.carRides || 0) >= 1,
  },
  {
    id: "market_runner",
    name: "Market Runner",
    icon: "🛒",
    description: "Score at least 5/10 on the Supermarket shopping dash.",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.marketWins || 0, 1), goal: 1 }),
    unlocked: (ctx) => (ctx.lifetime.marketWins || 0) >= 1,
  },
  {
    id: "shuffle_master",
    name: "Shuffle Master",
    icon: "🥣",
    description: "Hit a 5-round win streak in Paw Shuffle (Find the Hidden Treat).",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.bestShuffleStreak || 0, 5), goal: 5 }),
    unlocked: (ctx) => (ctx.lifetime.bestShuffleStreak || 0) >= 5,
  },
  {
    id: "fossil_hunter",
    name: "Fossil Hunter",
    icon: "🦕",
    description: "Excavate a rare ancient dinosaur fossil in Backyard Digger.",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.fossilsFound || 0, 1), goal: 1 }),
    unlocked: (ctx) => (ctx.lifetime.fossilsFound || 0) >= 1,
  },
  {
    id: "champion",
    name: "Champion",
    icon: "🏆",
    description: "Win 10 mini-games of any kind.",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.wins || 0, 10), goal: 10 }),
    unlocked: (ctx) => (ctx.lifetime.wins || 0) >= 10,
  },
  {
    id: "best_friend",
    name: "Best Friend",
    icon: "❤️",
    description: "Give 25 pets & cuddles to your companion.",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.pets || 0, 25), goal: 25 }),
    unlocked: (ctx) => (ctx.lifetime.pets || 0) >= 25,
  },
  {
    id: "festival_pup",
    name: "Festival Pup",
    icon: "🎉",
    description: "Visit during a holiday season (Halloween, Christmas, 4th of July...) and spot the Easter eggs.",
    progress: (ctx) => ({ current: ctx.holiday !== "none" ? 1 : 0, goal: 1 }),
    unlocked: (ctx) => ctx.holiday !== "none",
  },
  {
    id: "gym_rat",
    name: "Gym Rat",
    icon: "🏋️",
    description: "Complete a full workout session at the City Gym.",
    progress: (ctx) => ({ current: Math.min(ctx.lifetime.gymSessions || 0, 1), goal: 1 }),
    unlocked: (ctx) => (ctx.lifetime.gymSessions || 0) >= 1,
  },
];

/** Returns the ids from `ACHIEVEMENTS` that are newly unlocked by this context. */
export function evaluateAchievements(ctx: AchievementContext, alreadyUnlocked: string[]): string[] {
  const have = new Set(alreadyUnlocked);
  const newly: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    try {
      if (a.unlocked(ctx)) newly.push(a.id);
    } catch {
      // never let a badge check crash the game
    }
  }
  return newly;
}
