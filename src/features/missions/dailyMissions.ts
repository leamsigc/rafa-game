import { getToday } from "../journal/dayJournal";

/**
 * Daily Missions — five rotating quests pinned to the notice board.
 *
 * Progress is measured from the Day Journal's *today* counters, so missions
 * naturally reset every day. Which five missions you get is seeded from the
 * date, so the board stays the same all day but changes tomorrow.
 */
export interface MissionDef {
  id: string;
  icon: string;
  title: string;
  /** Day-journal counter this mission tracks. */
  key: string;
  goal: number;
  description: string;
  coins: number;
  xp: number;
}

export const MISSION_POOL: MissionDef[] = [
  { id: "feed3", icon: "🦴", title: "Snack Time", key: "feeds", goal: 3, description: "Feed your dog 3 treats", coins: 20, xp: 15 },
  { id: "fetch2", icon: "🎾", title: "Ball Chaser", key: "fetches", goal: 2, description: "Play fetch twice", coins: 25, xp: 18 },
  { id: "win1", icon: "🏆", title: "Winner", key: "wins", goal: 1, description: "Win a mini-game", coins: 30, xp: 25 },
  { id: "train1", icon: "🎓", title: "Good Student", key: "trainingSessions", goal: 1, description: "Complete a training session", coins: 25, xp: 20 },
  { id: "pet5", icon: "❤️", title: "Cuddle Buddy", key: "pets", goal: 5, description: "Give 5 pets & cuddles", coins: 20, xp: 15 },
  { id: "chat3", icon: "💬", title: "Chatty Pup", key: "chatMessages", goal: 3, description: "Chat with your dog 3 times", coins: 20, xp: 15 },
  { id: "tricks5", icon: "🤸", title: "Trick Show", key: "tricksPerformed", goal: 5, description: "Perform 5 tricks", coins: 25, xp: 20 },
  { id: "photo1", icon: "📸", title: "Paw-parazzi", key: "photosTaken", goal: 1, description: "Take a photo in Photo Mode", coins: 25, xp: 18 },
  { id: "journal1", icon: "🎙️", title: "Storyteller", key: "journalListens", goal: 1, description: "Listen to the Voice Journal", coins: 25, xp: 18 },
  { id: "car1", icon: "🚗", title: "Road Trip", key: "carRides", goal: 1, description: "Take a drive in the little car", coins: 30, xp: 22 },
  { id: "sleep1", icon: "💤", title: "Beauty Sleep", key: "sleeps", goal: 1, description: "Put your dog to bed for a nap", coins: 20, xp: 15 },
  { id: "gym1", icon: "🏋️", title: "Gym Pup", key: "gymSessions", goal: 1, description: "Work out at the City Gym", coins: 30, xp: 22 },
  { id: "dig1", icon: "⛏️", title: "Digger", key: "digs", goal: 1, description: "Dig in Backyard Digger", coins: 25, xp: 18 },
  { id: "market1", icon: "🛒", title: "Errand Run", key: "supermarketTrips", goal: 1, description: "Go shopping at the supermarket", coins: 30, xp: 22 },
  { id: "miniGames3", icon: "🕹️", title: "Arcade Regular", key: "miniGames", goal: 3, description: "Play 3 mini-games of any kind", coins: 35, xp: 28 },
  { id: "secret1", icon: "🕵️", title: "Code Cracker", key: "secretCodes", goal: 1, description: "Discover a secret chat code", coins: 40, xp: 30 },
];

const STORAGE_KEY = "doghouse_dailymissions_v1";
const MISSIONS_PER_DAY = 3;

export interface DailyMissionState {
  date: string;
  ids: string[];
  claimed: string[];
}

function dateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic, date-seeded selection of today's missions. */
function pickIds(seed: string, count: number): string[] {
  let h = hashStr(seed);
  const pool = [...MISSION_POOL];
  const out: string[] = [];
  while (out.length < count && pool.length > 0) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const idx = h % pool.length;
    out.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return out;
}

function load(): DailyMissionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyMissionState;
      if (
        parsed &&
        parsed.date === dateKey() &&
        Array.isArray(parsed.ids) &&
        parsed.ids.length === MISSIONS_PER_DAY
      ) {
        return { date: parsed.date, ids: parsed.ids, claimed: parsed.claimed || [] };
      }
    }
  } catch {
    // ignore
  }
  return { date: dateKey(), ids: pickIds(dateKey(), MISSIONS_PER_DAY), claimed: [] };
}

function save(state: DailyMissionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

let state: DailyMissionState = typeof window !== "undefined" ? load() : { date: dateKey(), ids: [], claimed: [] };
// Persist a freshly seeded day (e.g. after the missions-per-day count changed).
if (typeof window !== "undefined") save(state);

function ensureToday() {
  if (state.date !== dateKey() || state.ids.length !== MISSIONS_PER_DAY) {
    state = { date: dateKey(), ids: pickIds(dateKey(), MISSIONS_PER_DAY), claimed: [] };
    save(state);
  }
}

export function getDailyMissions(): { defs: MissionDef[]; claimed: string[] } {
  ensureToday();
  const defs = state.ids
    .map((id) => MISSION_POOL.find((m) => m.id === id))
    .filter((m): m is MissionDef => !!m);
  return { defs, claimed: [...state.claimed] };
}

export function getMissionProgress(def: MissionDef): { current: number; goal: number } {
  const counts = getToday().counts || {};
  const current = Math.min(def.goal, counts[def.key] || 0);
  return { current, goal: def.goal };
}

export function isMissionComplete(def: MissionDef): boolean {
  return getMissionProgress(def).current >= def.goal;
}

/** Claim a finished mission's reward. Returns null if not claimable. */
export function claimMission(id: string): { coins: number; xp: number } | null {
  ensureToday();
  const def = MISSION_POOL.find((m) => m.id === id);
  if (!def) return null;
  if (state.claimed.includes(id)) return null;
  if (!isMissionComplete(def)) return null;
  state.claimed.push(id);
  save(state);
  return { coins: def.coins, xp: def.xp };
}

/** How many of today's missions are done + claimed (for badges/counters). */
export function dailyMissionSummary(): { done: number; total: number; allClaimed: boolean } {
  const { defs, claimed } = getDailyMissions();
  const done = defs.filter((d) => isMissionComplete(d)).length;
  return { done, total: defs.length, allClaimed: defs.length > 0 && claimed.length >= defs.length };
}
