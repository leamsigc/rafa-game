import { PetStats, SkillNode } from "../../types/pet";
import { SKILL_NODES } from "../skills/skillTreeData";

/**
 * Badge Case — permanent cosmetic badges awarded for skill-tree milestones.
 *
 * Unlike the lifetime Achievements (which track the whole adventure), every
 * badge here is derived from the Canine Skill Tree: how many nodes a trainer
 * has unlocked, which categories they completed, whether they reached the
 * tier-3 summit, and how much they have invested. A badge, once earned, is
 * kept forever in `stats.earnedBadges` and can be pinned as the trainer's
 * showcase emblem.
 */
export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  rarity: BadgeRarity;
  /** Short flavour line describing what the badge represents. */
  description: string;
  /** The skill-tree milestone the trainer must complete. */
  requirement: string;
  /** Skill node ids that satisfy this badge (used for progress + grouping). */
  milestoneSkills: string[];
  /** Returns how far along the trainer is (current / goal). */
  progress: (stats: PetStats) => { current: number; goal: number };
  /** True once every `milestoneSkills` entry is unlocked (or a custom rule holds). */
  earned: (stats: PetStats) => boolean;
}

export const BADGE_RARITY_META: Record<
  BadgeRarity,
  { label: string; ring: string; chip: string; glow: string; text: string }
> = {
  common: {
    label: "Common",
    ring: "border-slate-300",
    chip: "bg-slate-100 text-slate-600 border-slate-300",
    glow: "shadow-slate-300/50",
    text: "text-slate-600",
  },
  uncommon: {
    label: "Uncommon",
    ring: "border-emerald-400",
    chip: "bg-emerald-100 text-emerald-700 border-emerald-300",
    glow: "shadow-emerald-400/50",
    text: "text-emerald-700",
  },
  rare: {
    label: "Rare",
    ring: "border-sky-400",
    chip: "bg-sky-100 text-sky-700 border-sky-300",
    glow: "shadow-sky-400/50",
    text: "text-sky-700",
  },
  epic: {
    label: "Epic",
    ring: "border-violet-400",
    chip: "bg-violet-100 text-violet-700 border-violet-300",
    glow: "shadow-violet-400/50",
    text: "text-violet-700",
  },
  legendary: {
    label: "Legendary",
    ring: "border-amber-400",
    chip: "bg-gradient-to-r from-amber-200 to-yellow-100 text-amber-800 border-amber-400",
    glow: "shadow-amber-400/60",
    text: "text-amber-700",
  },
};

const TRICKS = SKILL_NODES.filter((n) => n.category === "tricks").map((n) => n.id);
const AFFECTION = SKILL_NODES.filter((n) => n.category === "affection").map((n) => n.id);
const VITALITY = SKILL_NODES.filter((n) => n.category === "vitality").map((n) => n.id);
const ALL_IDS = SKILL_NODES.map((n) => n.id);
const PASSIVES = SKILL_NODES.filter((n) => n.isPassive).map((n) => n.id);
const TIER3 = SKILL_NODES.filter((n) => n.tier === 3).map((n) => n.id);

const TOTAL_SKILL_COST = SKILL_NODES.reduce((sum, n) => sum + n.cost, 0);

const unlocked = (stats: PetStats) => new Set(stats.unlockedSkills || []);
const countUnlocked = (stats: PetStats, ids: string[]) => {
  const set = unlocked(stats);
  return ids.filter((id) => set.has(id)).length;
};
const allUnlocked = (stats: PetStats, ids: string[]) => countUnlocked(stats, ids) === ids.length;

/** Coins invested in the tree so far (sum of the costs of unlocked nodes). */
function coinsInvested(stats: PetStats): number {
  const set = unlocked(stats);
  return SKILL_NODES.filter((n) => set.has(n.id)).reduce((sum, n) => sum + n.cost, 0);
}

function badgeForSkills(
  id: string,
  name: string,
  icon: string,
  rarity: BadgeRarity,
  description: string,
  requirement: string,
  ids: string[]
): BadgeDef {
  return {
    id,
    name,
    icon,
    rarity,
    description,
    requirement,
    milestoneSkills: ids,
    progress: (stats) => ({ current: countUnlocked(stats, ids), goal: ids.length }),
    earned: (stats) => allUnlocked(stats, ids),
  };
}

export const BADGE_CASE: BadgeDef[] = [
  {
    id: "badge_first_paw",
    name: "First Paw Forward",
    icon: "🐾",
    rarity: "common",
    description: "A trainer who has begun walking the Skill Tree path.",
    requirement: "Unlock any 3 skills in the Canine Skill Tree.",
    milestoneSkills: ALL_IDS,
    progress: (stats) => ({ current: Math.min(countUnlocked(stats, ALL_IDS), 3), goal: 3 }),
    earned: (stats) => countUnlocked(stats, ALL_IDS) >= 3,
  },
  badgeForSkills(
    "badge_trick_graduate",
    "Trick Graduate",
    "🎓",
    "rare",
    "Mastery of every trick and acrobatic feat.",
    "Unlock all 5 Tricks & Agility skills.",
    TRICKS
  ),
  badgeForSkills(
    "badge_heart_of_gold",
    "Heart of Gold",
    "💞",
    "rare",
    "A bond so deep it can never be untrained.",
    "Unlock all 4 Bond & Affection skills.",
    AFFECTION
  ),
  badgeForSkills(
    "badge_wild_instinct",
    "Wild Instinct",
    "🌿",
    "rare",
    "Vitality and instincts honed to a razor's edge.",
    "Unlock all 4 Vitality & Instincts skills.",
    VITALITY
  ),
  badgeForSkills(
    "badge_perk_collector",
    "Perk Collector",
    "⚙️",
    "epic",
    "Every passive perk in the tree, humming at once.",
    "Unlock all 4 passive perks.",
    PASSIVES
  ),
  {
    id: "badge_big_spender",
    name: "Skill Investor",
    icon: "💰",
    rarity: "uncommon",
    description: "Generously funded the dog's education.",
    requirement: "Invest 300 Treat Coins into the Skill Tree.",
    milestoneSkills: ALL_IDS,
    progress: (stats) => ({
      current: Math.min(coinsInvested(stats), 300),
      goal: 300,
    }),
    earned: (stats) => coinsInvested(stats) >= 300,
  },
  badgeForSkills(
    "badge_summit_climber",
    "Summit Climber",
    "⛰️",
    "legendary",
    "Reached the top tier of all three disciplines.",
    "Unlock every Tier 3 skill.",
    TIER3
  ),
  {
    id: "badge_tree_master",
    name: "Grand Skill Master",
    icon: "🌳",
    rarity: "legendary",
    description: "The complete Canine Skill Tree, fully mastered.",
    requirement: `Unlock every one of the ${SKILL_NODES.length} skills in the tree.`,
    milestoneSkills: ALL_IDS,
    progress: (stats) => ({ current: countUnlocked(stats, ALL_IDS), goal: ALL_IDS.length }),
    earned: (stats) => allUnlocked(stats, ALL_IDS),
  },
];

/** How many Treat Coins each badge pays out the moment it is earned. */
export const BADGE_COIN_REWARD: Record<BadgeRarity, number> = {
  common: 15,
  uncommon: 25,
  rare: 40,
  epic: 60,
  legendary: 100,
};

export function getBadge(id: string): BadgeDef | undefined {
  return BADGE_CASE.find((b) => b.id === id);
}

/** Skill node lookup, handy for naming the "next skill" hint on locked badges. */
export function skillName(id: string): string {
  return SKILL_NODES.find((n: SkillNode) => n.id === id)?.name ?? id;
}

/** Returns the ids of badges newly earned by this stats snapshot. */
export function evaluateBadges(stats: PetStats, alreadyEarned: string[]): string[] {
  const have = new Set(alreadyEarned);
  const newly: string[] = [];
  for (const badge of BADGE_CASE) {
    if (have.has(badge.id)) continue;
    try {
      if (badge.earned(stats)) newly.push(badge.id);
    } catch {
      // never let a badge check crash the game
    }
  }
  return newly;
}

export { TOTAL_SKILL_COST, ALL_IDS as ALL_SKILL_IDS };
