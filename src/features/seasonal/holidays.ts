import { HolidayId } from "../../types/pet";

interface HolidayMeta {
  id: HolidayId;
  name: string;
  emoji: string;
  /** Extra line injected into the chat system instruction. */
  chatInstruction?: string;
  /** Festive greeting the dog uses when the chat opens. */
  chatGreeting?: string;
}

const HOLIDAYS: Record<Exclude<HolidayId, "none">, HolidayMeta> = {
  halloween: {
    id: "halloween",
    name: "Halloween",
    emoji: "🎃",
    chatInstruction:
      "Today is HALLOWEEN! Start your reply with a playful 'Trick or treat!' and mention spooky pumpkin fun.",
    chatGreeting:
      "*bounces excitedly in a tiny pumpkin-orange bandana* Trick or treat! 🎃 Woof! Happy Halloween, best friend! Got any yummy treats for a very good spooky pup?",
  },
  christmas: {
    id: "christmas",
    name: "Christmas",
    emoji: "🎄",
    chatInstruction:
      "Today is CHRISTMAS! You are wearing a little Santa hat. Wish the owner a merry Christmas and mention presents or cookies.",
    chatGreeting:
      "*wiggles happily, a tiny Santa hat bobbing on your head* Woof woof! Merry Christmas! 🎄🎅 I've been such a good boy this year — present time?",
  },
  july4: {
    id: "july4",
    name: "4th of July",
    emoji: "🇺🇸",
    chatInstruction:
      "Today is the 4TH OF JULY! Your cooking cauldron is dressed up as an American flag. Celebrate with fireworks and hot dog jokes.",
    chatGreeting:
      "*tail wags like a flag in the wind* Woof! Happy 4th of July! 🇺🇸✨ Fireworks tonight — I'll pretend I'm not scared of the loud booms!",
  },
  valentines: {
    id: "valentines",
    name: "Valentine's Day",
    emoji: "💝",
    chatInstruction:
      "Today is VALENTINE'S DAY! Be extra lovey-dovey and mention hearts and cuddles.",
    chatGreeting:
      "*brings you a little heart-shaped cookie* Happy Valentine's Day! 💝 You're my favorite human in the whole wide world, woof!",
  },
  newyear: {
    id: "newyear",
    name: "New Year",
    emoji: "🎊",
    chatInstruction:
      "Today is NEW YEAR'S! Celebrate with a happy howl and wish the owner a great year ahead.",
    chatGreeting:
      "*howls a joyful midnight awoo* Happy New Year, best friend! 🎊 New year, same me — still your goodest boy!",
  },
};

/** Detect the active holiday from a date (Easter-egg season windows). */
export function getCurrentHoliday(date: Date = new Date()): HolidayId {
  const m = date.getMonth(); // 0-11
  const d = date.getDate();

  // Halloween season: Oct 20 – Oct 31
  if (m === 9 && d >= 20) return "halloween";
  // Christmas season: Dec 15 – Dec 31
  if (m === 11 && d >= 15) return "christmas";
  // 4th of July season: Jun 28 – Jul 7
  if ((m === 5 && d >= 28) || (m === 6 && d <= 7)) return "july4";
  // Valentine's: Feb 12 – 15
  if (m === 1 && d >= 12 && d <= 15) return "valentines";
  // New Year: Dec 31 – Jan 3
  if ((m === 11 && d === 31) || (m === 0 && d <= 3)) return "newyear";

  return "none";
}

export function getHolidayMeta(holiday: HolidayId): HolidayMeta | null {
  if (holiday === "none") return null;
  return HOLIDAYS[holiday] ?? null;
}

export function holidayBlurb(holiday: HolidayId): string {
  const meta = getHolidayMeta(holiday);
  if (!meta) return "";
  return `${meta.emoji} ${meta.name} season is here — look around for festive surprises!`;
}

export type Season = "spring" | "summer" | "fall" | "winter";

/** Astronomical-ish season for ambient world particles (leaves/pollen/snow). */
export function getCurrentSeason(date: Date = new Date()): Season {
  const m = date.getMonth(); // 0-11
  if (m >= 2 && m <= 4) return "spring"; // Mar-May
  if (m >= 5 && m <= 7) return "summer"; // Jun-Aug
  if (m >= 8 && m <= 10) return "fall"; // Sep-Nov
  return "winter"; // Dec-Feb
}
