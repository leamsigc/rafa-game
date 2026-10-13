import type { DogAction } from "../../types/pet";

/**
 * A minor ailment. Nothing here is serious on purpose: sniffles, coughs and
 * sore paws are the kind of thing a real pup shakes off with rest + medicine.
 */
export interface IllnessDef {
  id: string;
  name: string;
  emoji: string;
  /** Relative likelihood weight. Converted to a % chance by `illnessChance`. */
  weight: number;
  /** Health points lost per metabolism tick while sick. */
  healthDrain: number;
  /** Extra energy lost per metabolism tick while sick. */
  energyDrain: number;
  /** Happiness drag applied per tick. */
  joyDrain: number;
  /** Tricks that are too much for a pup with this ailment. */
  blockedActions: DogAction[];
  blurb: string;
}

export const ILLNESSES: IllnessDef[] = [
  {
    id: "sneeze",
    name: "Sneezy Nose",
    emoji: "🤧",
    weight: 26,
    healthDrain: 1.2,
    energyDrain: 1,
    joyDrain: 1,
    blockedActions: [],
    blurb: "Tiny dust bunny in his nose. Aaachoo!",
  },
  {
    id: "cough",
    name: "Little Cough",
    emoji: "😷",
    weight: 20,
    healthDrain: 1.5,
    energyDrain: 1,
    joyDrain: 1,
    blockedActions: ["zoomies"],
    blurb: "A soft, scratchy cough after too much zoomies.",
  },
  {
    id: "runny_nose",
    name: "Runny Nose",
    emoji: "💧",
    weight: 16,
    healthDrain: 1.1,
    energyDrain: 1,
    joyDrain: 1,
    blockedActions: [],
    blurb: "Drip drip drop. Tissues everywhere.",
  },
  {
    id: "itchy_eyes",
    name: "Itchy Eyes",
    emoji: "👁️",
    weight: 12,
    healthDrain: 0.9,
    energyDrain: 1,
    joyDrain: 1,
    blockedActions: [],
    blurb: "Paw, paw — scratchy peepers.",
  },
  {
    id: "hiccups",
    name: "Hiccups",
    emoji: "😮‍💨",
    weight: 9,
    healthDrain: 0.6,
    energyDrain: 0,
    joyDrain: 2,
    blockedActions: [],
    blurb: "Hic! ...Hic! Very rude, very loud.",
  },
  {
    id: "sore_paws",
    name: "Sore Paws",
    emoji: "🐾",
    weight: 8,
    healthDrain: 1.3,
    energyDrain: 2,
    joyDrain: 1,
    blockedActions: ["run", "fetch", "zoomies"],
    blurb: "Hot pavement got him. Walk soft and slow.",
  },
  {
    id: "tummy_ache",
    name: "Tummy Ache",
    emoji: "🤢",
    weight: 7,
    healthDrain: 1.6,
    energyDrain: 1,
    joyDrain: 2,
    blockedActions: ["run", "zoomies", "backflip"],
    blurb: "Something from the snack box didn't agree.",
  },
  {
    id: "shivers",
    name: "The Shivers",
    emoji: "🥶",
    weight: 5,
    healthDrain: 1.4,
    energyDrain: 2,
    joyDrain: 1,
    blockedActions: ["run"],
    blurb: "A chilly night. Blanket time, please.",
  },
  {
    id: "droopy_ears",
    name: "Droopy Ears",
    emoji: "😔",
    weight: 4,
    healthDrain: 0.8,
    energyDrain: 1,
    joyDrain: 1,
    blockedActions: [],
    blurb: "Ears hanging low. He needs a soft pillow.",
  },
  {
    id: "sore_throat",
    name: "Sore Throat",
    emoji: "🗣️",
    weight: 3,
    healthDrain: 1.2,
    energyDrain: 1,
    joyDrain: 1,
    blockedActions: ["bark", "howl"],
    blurb: "Barking hurts. Only whispers for a while.",
  },
];

const TOTAL_WEIGHT = ILLNESSES.reduce((sum, i) => sum + i.weight, 0);

export function getIllness(id: string | undefined): IllnessDef | null {
  if (!id) return null;
  return ILLNESSES.find((i) => i.id === id) ?? null;
}

/** Displayed likelihood of an ailment, e.g. 26.0%. */
export function illnessChance(def: IllnessDef): number {
  return (def.weight / TOTAL_WEIGHT) * 100;
}

export function illnessChanceLabel(def: IllnessDef): string {
  return `${illnessChance(def).toFixed(1)}%`;
}

/** Pick a random ailment, weighted by `weight`. */
export function rollIllness(random: () => number = Math.random): IllnessDef | null {
  let ticket = random() * TOTAL_WEIGHT;
  for (const illness of ILLNESSES) {
    ticket -= illness.weight;
    if (ticket <= 0) return illness;
  }
  return ILLNESSES[0];
}

// ---------------------------------------------------------------------------
// Medicine
// ---------------------------------------------------------------------------

export interface MedicineDef {
  id: string;
  name: string;
  emoji: string;
  /** Illness ids this medicine cures outright. */
  cures: string[];
  /** Health points restored on top of curing. */
  healthRestore: number;
  /** Energy given back. */
  energyRestore: number;
  cost: number;
  blurb: string;
}

export const MEDICINES: MedicineDef[] = [
  {
    id: "tissue_box",
    name: "Tissue Box",
    emoji: "🧻",
    cures: ["sneeze", "runny_nose"],
    healthRestore: 8,
    energyRestore: 4,
    cost: 18,
    blurb: "Soft, gentle, and solves sniffles right away.",
  },
  {
    id: "warm_honey_syrup",
    name: "Warm Honey Syrup",
    emoji: "🍯",
    cures: ["cough", "sore_throat"],
    healthRestore: 10,
    energyRestore: 6,
    cost: 24,
    blurb: "Warm and soothing. Coats a scratchy throat.",
  },
  {
    id: "eye_drops",
    name: "Cool Eye Drops",
    emoji: "💧",
    cures: ["itchy_eyes", "droopy_ears"],
    healthRestore: 7,
    energyRestore: 4,
    cost: 20,
    blurb: "One blink and the peepers stop itching.",
  },
  {
    id: "bone_broth",
    name: "Warm Bone Broth",
    emoji: "🍲",
    cures: ["tummy_ache"],
    healthRestore: 12,
    energyRestore: 10,
    cost: 32,
    blurb: "The classic upset-stomach cure. Tastes better than it sounds.",
  },
  {
    id: "paw_salve",
    name: "Paw Salve",
    emoji: "🩹",
    cures: ["sore_paws"],
    healthRestore: 9,
    energyRestore: 5,
    cost: 28,
    blurb: "Cooling balm for hot, tender paw pads.",
  },
  {
    id: "vitamin_bones",
    name: "Vitamin Bones",
    emoji: "💊",
    cures: ["shivers", "hiccups"],
    healthRestore: 14,
    energyRestore: 8,
    cost: 45,
    blurb: "The all-rounder. Chills, hiccups, and a general top-up.",
  },
];

export function getMedicine(id: string | undefined): MedicineDef | null {
  if (!id) return null;
  return MEDICINES.find((m) => m.id === id) ?? null;
}

export function medicineForIllness(illnessId: string): MedicineDef | null {
  return MEDICINES.find((m) => m.cures.includes(illnessId)) ?? null;
}

// ---------------------------------------------------------------------------
// Health helpers
// ---------------------------------------------------------------------------

export type HealthBand = "healthy" | "fair" | "low" | "critical";

export function healthBand(health: number): HealthBand {
  if (health >= 75) return "healthy";
  if (health >= 45) return "fair";
  if (health >= 20) return "low";
  return "critical";
}

export function healthBandColor(health: number): string {
  const band = healthBand(health);
  if (band === "healthy") return "#6A994E";
  if (band === "fair") return "#D4A373";
  if (band === "low") return "#BC4749";
  return "#BC4749";
}

export const HEALTH_BAND_KEY: Record<HealthBand, string> = {
  healthy: "healthHealthy",
  fair: "healthFair",
  low: "healthLow",
  critical: "healthCritical",
};

export function clampHealth(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Health a pup slowly regains on their own while well-fed and rested. */
export const NATURAL_HEAL_RATE = 0.6;

export const MAX_MEDICINES = 99;
