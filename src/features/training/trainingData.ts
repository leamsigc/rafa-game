import { DogAction } from "../../types/pet";

export type TrickId = "sit" | "stay" | "fetch";

export interface TrickDef {
  id: TrickId;
  name: string;
  icon: string;
  command: string;
  description: string;
  energyCost: number;
  xpReward: number;
  /** 3D animation played when the trick succeeds. */
  action: DogAction;
}

export const TRAINABLE_TRICKS: TrickDef[] = [
  {
    id: "sit",
    name: "Sit",
    icon: "🐾",
    command: "Sit!",
    description: "Plant that fluffy butt on the grass on command.",
    energyCost: 4,
    xpReward: 8,
    action: "sit",
  },
  {
    id: "stay",
    name: "Stay",
    icon: "✋",
    command: "Stay!",
    description: "Freeze like a statue — no matter how exciting things get.",
    energyCost: 6,
    xpReward: 12,
    action: "stay",
  },
  {
    id: "fetch",
    name: "Fetch",
    icon: "🎾",
    command: "Fetch!",
    description: "Sprint after the ball and bring it straight back.",
    energyCost: 10,
    xpReward: 15,
    action: "fetch",
  },
];

/** Proficiency (0-100) needed before the chatbot treats a trick as learned. */
export const TRICK_LEARNED_AT = 40;

export type TrickTier = "Untrained" | "Learning" | "Skilled" | "Mastered";

export function trickTierFor(proficiency: number): TrickTier {
  if (proficiency >= 80) return "Mastered";
  if (proficiency >= 40) return "Skilled";
  if (proficiency >= 1) return "Learning";
  return "Untrained";
}

export function isTrickLearned(proficiency: number): boolean {
  return proficiency >= TRICK_LEARNED_AT;
}

export interface TrainAttemptInput {
  proficiency: number;
  energy: number;
  happiness: number;
}

/**
 * Success odds grow with proficiency and current pep.
 * High energy + a skilled dog almost always nails it;
 * a tired beginner mostly just tilts its head.
 */
export function trainSuccessChance({ proficiency, energy, happiness }: TrainAttemptInput): number {
  const raw = 0.55 + proficiency / 250 + (energy - 50) / 200 + (happiness - 50) / 400;
  return Math.min(0.97, Math.max(0.15, raw));
}

/** Proficiency gain for one session — bigger wins when the dog is fresh. */
export function trainGain(success: boolean, energy: number): number {
  if (!success) return 2;
  return Math.round(9 + energy / 25);
}
