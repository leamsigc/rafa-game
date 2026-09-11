export type DogBreed = "golden" | "chocolate" | "husky" | "dalmatian" | "corgi";

export type DogAction =
  | "idle"
  | "sit"
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

export type HouseViewMode = "park" | "house";

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
  unlockedSkills: string[];
  trainingPoints: number;
  bedColors: BedColors;
  ownedAccessories: string[];
  equippedAccessory?: string;
  houseToy: "bone" | "duck" | "bear" | "ball";
  unlockedBedStyles: string[];
  currentBedStyle: string;
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

export type MiniGameType = "none" | "fetch" | "agility" | "treatCatch";

export interface MiniGameScore {
  game: MiniGameType;
  score: number;
  bestScore: number;
}
