export type DogBreed = "golden" | "chocolate" | "husky" | "dalmatian" | "corgi";

export type DogAction =
  | "idle"
  | "sit"
  | "stay"
  | "bark"
  | "run"
  | "fetch"
  | "roll"
  | "spin"
  | "rest"
  | "eat"
  | "handshake"
  | "jump"
  | "dance"
  | "backflip"
  | "cuddle"
  | "zoomies"
  | "howl";

export interface BedColors {
  cushion: string; // Pillow / sleep surface color
  frame: string;   // Outer border / rim / frame color
  blanket: string; // Folded fleece throw blanket color
}

export interface PetAccessory {
  id: string;
  name: string;
  category: "head" | "neck" | "body";
  cost: number;
  icon: string;
  description: string;
}

export type HouseViewMode = "park" | "house" | "city" | "arcade" | "highway";

export type HouseRoom = "living" | "hallway" | "kitchen" | "upstairs";

/** Seasonal holiday detection (drives Easter eggs: hats, pumpkins, flags...). */
export type HolidayId = "none" | "halloween" | "christmas" | "july4" | "valentines" | "newyear";

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Progress label shown on locked badges, e.g. "3 / 10 wins". */
  progress: (ctx: AchievementContext) => { current: number; goal: number };
  unlocked: (ctx: AchievementContext) => boolean;
}

/** Everything achievements are evaluated against. */
export interface AchievementContext {
  stats: PetStats;
  lifetime: Record<string, number>;
  holiday: HolidayId;
}

export interface PetStats {
  name: string;
  breed: DogBreed;
  collarColor: string;
  energy: number; // 0 - 100
  happiness: number; // 0 - 100
  hunger: number; // 0 - 100 (0 is full, 100 is starving)
  level: number;
  xp: number;
  treatsInventory: Record<string, number>;
  coins: number;
  lastFed: number;
  /** Timestamp of the last meaningful interaction (feed/play/train/pet/chat). */
  lastInteractionAt: number;
  /** Trick proficiency 0-100 keyed by trick id (sit/stay/fetch). */
  trickProgress: Record<string, number>;
  unlockedSkills: string[];
  trainingPoints: number;
  bedColors: BedColors;
  ownedAccessories: string[];
  equippedAccessory?: string;
  houseToy: "bone" | "duck" | "bear" | "ball";
  unlockedBedStyles: string[];
  currentBedStyle: string;
  ingredientsInventory?: Record<string, number>;
  /** Owned tools (e.g. "axe" for chopping park trees). */
  ownedTools?: string[];
  /** Unlocked achievement badge ids. */
  unlockedAchievements?: string[];
  /** Secret chat codes discovered (exact code ids). */
  foundSecretCodes?: string[];
  /** Google-linked trainer account (name shown on the online scoreboard). */
  linkedAccount?: LinkedAccount;
  /** Bone Rush runner save: banked bones + unlocked/equipped cosmetics. */
  boneRush?: BoneRushSave;
}

/** A Google-linked (or locally linked) trainer account. */
export interface LinkedAccount {
  name: string;
  email?: string;
  googleVerified: boolean;
  linkedAt: number;
}

/** Subway Pup: Bone Rush persistent cosmetics wallet. */
export interface BoneRushSave {
  bones: number;
  unlocked: string[];
  equipped: { design: string; trail: string; costume: string };
}

/** A saved snapshot from the Memory Album gallery. */
export interface MemoryPhoto {
  id: string;
  dataUrl: string;
  timestamp: number;
  dogName: string;
  level: number;
  emotionLabel: string;
  favorite: boolean;
}

/** A timed cooking job: countdown from 2:00, then the house glows red. */
export interface CookingJob {
  recipeId: string;
  recipeName: string;
  recipeIcon: string;
  ingredients: string[];
  energyBoost: number;
  happinessBoost: number;
  hungerReduction: number;
  xp: number;
  description: string;
  endsAt: number;
  startedAt: number;
}

export interface IngredientItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
  description: string;
}

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  ingredients: string[];
  energyBoost: number;
  happinessBoost: number;
  hungerReduction: number;
  xp: number;
  description: string;
}

export type SkillCategory = "tricks" | "affection" | "vitality";

export interface SkillNode {
  id: string;
  name: string;
  icon: string;
  category: SkillCategory;
  tier: 1 | 2 | 3;
  cost: number;
  description: string;
  benefit: string;
  prerequisites: string[];
  actionUnlocked?: DogAction;
  isPassive?: boolean;
  passiveEffect?: string;
}

export interface TreatItem {
  id: string;
  name: string;
  icon: string;
  energyBoost: number;
  happinessBoost: number;
  hungerReduction: number;
  cost: number;
  description: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "dog";
  text: string;
  timestamp: number;
  actionTriggered?: DogAction;
}

export type MiniGameType =
  | "none"
  | "fetch"
  | "agility"
  | "treatCatch"
  | "pawShuffle"
  | "backyardDigger"
  | "supermarket"
  | "gym"
  | "boneRush";

export interface MiniGameScore {
  game: MiniGameType;
  score: number;
  bestScore: number;
}
