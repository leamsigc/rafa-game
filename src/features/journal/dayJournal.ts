/**
 * Day Journal — tracks everything the player does with their dog today.
 * Powers the Voice Journal recap (Gemini summarizes these events) and
 * lifetime counters used by the Achievements system.
 */

const JOURNAL_KEY = "doghouse_journal_v1";

export interface DayJournal {
  date: string; // YYYY-MM-DD
  counts: Record<string, number>;
  /** Short highlight strings, e.g. "Won Bone Rush with a 92 point score". */
  notable: string[];
}

export interface JournalStore {
  today: DayJournal;
  lifetime: Record<string, number>;
}

const DAY_KEYS = [
  "feeds",
  "fetches",
  "miniGames",
  "wins",
  "trainingSessions",
  "pets",
  "chatMessages",
  "tricksPerformed",
  "photosTaken",
  "journalListens",
  "secretCodes",
  "carRides",
  "sleeps",
  "supermarketTrips",
  "gymSessions",
  "digs",
] as const;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyDay(): DayJournal {
  return { date: todayKey(), counts: {}, notable: [] };
}

function loadStore(): JournalStore {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as JournalStore;
      const today = parsed.today?.date === todayKey() ? parsed.today : emptyDay();
      return { today, lifetime: parsed.lifetime || {} };
    }
  } catch {
    // ignore corrupted data
  }
  return { today: emptyDay(), lifetime: {} };
}

let store: JournalStore = typeof window !== "undefined" ? loadStore() : { today: emptyDay(), lifetime: {} };

function save() {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(store));
  } catch {
    // ignore quota issues
  }
}

/** Log a counted day event (and a matching lifetime counter of the same name). */
export function logDayEvent(kind: (typeof DAY_KEYS)[number] | string, detail?: string) {
  if (store.today.date !== todayKey()) store.today = emptyDay();
  store.today.counts[kind] = (store.today.counts[kind] || 0) + 1;
  store.lifetime[kind] = (store.lifetime[kind] || 0) + 1;
  if (detail && store.today.notable.length < 20) {
    store.today.notable.push(detail);
  }
  save();
}

/** Bump a lifetime-only counter (e.g. lifetimeCoinsEarned, lifetimeXpEarned). */
export function bumpLifetime(key: string, amount: number) {
  store.lifetime[key] = (store.lifetime[key] || 0) + amount;
  save();
}

/** Keep a lifetime "high score" (e.g. best streak) — only rises. */
export function setLifetimeMax(key: string, value: number) {
  if (value > (store.lifetime[key] || 0)) {
    store.lifetime[key] = value;
    save();
  }
}

export function getLifetime(): Record<string, number> {
  return store.lifetime;
}

export function getToday(): DayJournal {
  if (store.today.date !== todayKey()) {
    store.today = emptyDay();
    save();
  }
  return store.today;
}

/** Human-readable digest of the day, shown next to the recap player. */
export function todaySummaryText(dogName: string): string {
  const day = getToday();
  const c = day.counts;
  const bits: string[] = [];
  if (c.feeds) bits.push(`${c.feeds} treat${c.feeds > 1 ? "s" : ""} eaten`);
  if (c.fetches) bits.push(`${c.fetches} fetch ball${c.fetches > 1 ? "s" : ""} thrown`);
  if (c.miniGames) bits.push(`${c.miniGames} mini-game${c.miniGames > 1 ? "s" : ""} played`);
  if (c.trainingSessions) bits.push(`${c.trainingSessions} training session${c.trainingSessions > 1 ? "s" : ""}`);
  if (c.pets) bits.push(`${c.pets} cuddle${c.pets > 1 ? "s" : ""}`);
  if (c.chatMessages) bits.push(`${c.chatMessages} chat message${c.chatMessages > 1 ? "s" : ""}`);
  if (c.photosTaken) bits.push(`${c.photosTaken} photo${c.photosTaken > 1 ? "s" : ""} taken`);
  if (c.carRides) bits.push(`${c.carRides} car ride${c.carRides > 1 ? "s" : ""}`);
  if (c.sleeps) bits.push(`${c.sleeps} nap${c.sleeps > 1 ? "s" : ""}`);
  if (!bits.length) return `The day is still young — nothing logged yet. Play with ${dogName} and come back tonight! 🐾`;
  return `Today so far: ${bits.join(" • ")}.`;
}

/** Structured payload for the Gemini journal endpoint. */
export function journalPayload() {
  const day = getToday();
  return {
    counts: day.counts,
    notable: day.notable,
  };
}
