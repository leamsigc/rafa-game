export type DogEmotion =
  | "excited"
  | "happy"
  | "playful"
  | "content"
  | "lonely"
  | "sad"
  | "tired"
  | "hungry"
  | "sleepy";

export interface EmotionMeta {
  emotion: DogEmotion;
  emoji: string;
  label: string;
  /** Tailwind classes for the HUD badge */
  badge: string;
  blurb: string;
}

export const EMOTION_META: Record<DogEmotion, EmotionMeta> = {
  excited: {
    emotion: "excited",
    emoji: "🤩",
    label: "Excited",
    badge: "bg-amber-100 text-amber-900 border-amber-300",
    blurb: "Bouncing off the walls and ready for anything!",
  },
  happy: {
    emotion: "happy",
    emoji: "😊",
    label: "Happy",
    badge: "bg-[#A7C957]/40 text-[#386641] border-[#6A994E]/30",
    blurb: "Tail wagging, heart full. Life is good!",
  },
  playful: {
    emotion: "playful",
    emoji: "😜",
    label: "Playful",
    badge: "bg-sky-100 text-sky-900 border-sky-300",
    blurb: "Full of beans — play bow incoming!",
  },
  content: {
    emotion: "content",
    emoji: "😌",
    label: "Content",
    badge: "bg-stone-100 text-stone-700 border-stone-300",
    blurb: "Calm and cozy. All is well.",
  },
  lonely: {
    emotion: "lonely",
    emoji: "🥺",
    label: "Lonely",
    badge: "bg-indigo-100 text-indigo-900 border-indigo-300",
    blurb: "Misses you... come back and play!",
  },
  sad: {
    emotion: "sad",
    emoji: "😢",
    label: "Sad",
    badge: "bg-blue-100 text-blue-900 border-blue-300",
    blurb: "Droopy ears. Needs cuddles, quick!",
  },
  tired: {
    emotion: "tired",
    emoji: "😴",
    label: "Tired",
    badge: "bg-purple-100 text-purple-900 border-purple-300",
    blurb: "Pooped paws. Time for a nap or snack.",
  },
  hungry: {
    emotion: "hungry",
    emoji: "🤤",
    label: "Hungry",
    badge: "bg-orange-100 text-orange-900 border-orange-300",
    blurb: "Tummy rumbling... feed me!",
  },
  sleepy: {
    emotion: "sleepy",
    emoji: "💤",
    label: "Sleepy",
    badge: "bg-slate-200 text-slate-700 border-slate-300",
    blurb: "Eyes heavy. Bedtime soon.",
  },
};

/** Ms without interaction before the dog starts feeling lonely. */
export const LONELY_AFTER_MS = 3 * 60 * 1000;

export interface EmotionInputs {
  energy: number;
  happiness: number;
  hunger: number;
  /** Timestamp of the last feed/play/train/pet/chat interaction. */
  lastInteractionAt: number;
  isSleeping: boolean;
}

/**
 * Derives the dog's current emotion from vitals + attention.
 * Priority: sleeping > exhausted > starving > miserable > neglected >
 * thrilled > cheerful > energetic > calm.
 */
export function deriveEmotion(inputs: EmotionInputs, now: number = Date.now()): DogEmotion {
  const { energy, happiness, hunger, lastInteractionAt, isSleeping } = inputs;
  if (isSleeping || energy <= 5) return "sleepy";
  if (energy <= 15) return "tired";
  if (hunger >= 80) return "hungry";
  if (happiness <= 30) return "sad";
  if (now - lastInteractionAt > LONELY_AFTER_MS) return "lonely";
  if (happiness >= 85 && energy >= 55) return "excited";
  if (happiness >= 65) return "happy";
  if (energy >= 55) return "playful";
  return "content";
}

export function getEmotionMeta(emotion: DogEmotion): EmotionMeta {
  return EMOTION_META[emotion];
}
