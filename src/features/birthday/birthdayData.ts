/**
 * Birthday Cake Salon data: the player saves the day (month + day, no year)
 * of Happy's birthday. On that exact day the city throws a party — Happy
 * wears his special striped cone hat and every dog in the park celebrates.
 */

export interface BirthdayDate {
  /** 0 = January … 11 = December */
  month: number;
  /** 1 – 31 */
  day: number;
}

const BIRTHDAY_STORAGE_KEY = "doghouse_birthday_v1";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Days in a month for the picker (February gets 29 so the 29th is saveable). */
export function daysInMonth(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] ?? 31;
}

export function formatBirthday(b: BirthdayDate): string {
  return `${MONTH_NAMES[b.month]} ${b.day}`;
}

export function loadBirthday(): BirthdayDate | null {
  try {
    const raw = localStorage.getItem(BIRTHDAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BirthdayDate>;
    if (
      typeof parsed.month === "number" && parsed.month >= 0 && parsed.month <= 11 &&
      typeof parsed.day === "number" && parsed.day >= 1 && parsed.day <= 31
    ) {
      return { month: parsed.month, day: parsed.day };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveBirthday(b: BirthdayDate): void {
  try {
    localStorage.setItem(BIRTHDAY_STORAGE_KEY, JSON.stringify(b));
  } catch {
    // Private mode / storage disabled — the party just won't persist.
  }
}

/** True when the given saved date matches today's calendar day. */
export function isBirthdayToday(b: BirthdayDate | null): boolean {
  if (!b) return false;
  const now = new Date();
  return now.getMonth() === b.month && now.getDate() === b.day;
}

export function todayBirthday(): BirthdayDate {
  const now = new Date();
  return { month: now.getMonth(), day: now.getDate() };
}
