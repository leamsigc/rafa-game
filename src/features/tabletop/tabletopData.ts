import { DogBreed } from "../../types/pet";

export type TabletopGameId = "chess" | "tictactoe" | "fourinarow";

export type GameResult = { kind: "you" | "happy" | "draw" };

export interface TabletopGameMeta {
  id: TabletopGameId;
  name: string;
  emoji: string;
  blurb: string;
  /** Emoji the human plays with. */
  youPiece: string;
  /** Emoji Happy plays with. */
  happyPiece: string;
  /** Tailwind-ready accent hex for highlights. */
  accent: string;
}

/** The three games, in the exact order the player named them. */
export const TABLETOP_GAMES: TabletopGameMeta[] = [
  {
    id: "chess",
    name: "Chess",
    emoji: "♟️",
    blurb: "Classic 8×8 strategy duel across the table.",
    youPiece: "♙",
    happyPiece: "♞",
    accent: "#e2e8f0",
  },
  {
    id: "tictactoe",
    name: "Tic-Tac-Toe",
    emoji: "❌",
    blurb: "Line up three in a row. Quick and sneaky.",
    youPiece: "🐾",
    happyPiece: "🦴",
    accent: "#f59e0b",
  },
  {
    id: "fourinarow",
    name: "Four Wins",
    emoji: "🔴",
    blurb: "Drop the tokens — they bounce — and line up four.",
    youPiece: "🔴",
    happyPiece: "🟡",
    accent: "#2563eb",
  },
];

export function gameMeta(id: TabletopGameId): TabletopGameMeta {
  return TABLETOP_GAMES.find((g) => g.id === id) ?? TABLETOP_GAMES[0];
}

/** The three physical packages on the table — shapes described by the player. */
export interface PackageMeta {
  id: TabletopGameId;
  name: string;
  /** width / height — chess & four-wins are rectangles, tic-tac-toe is a square. */
  aspect: number;
  color: string;
  trim: string;
  hint: string;
}

export const TABLETOP_PACKAGES: PackageMeta[] = [
  {
    id: "chess",
    name: "Chess",
    aspect: 132 / 88,
    color: "#334155",
    trim: "#e2e8f0",
    hint: "📦 rectangle box",
  },
  {
    id: "tictactoe",
    name: "Tic-Tac-Toe",
    aspect: 1,
    color: "#f59e0b",
    trim: "#fffbeb",
    hint: "📦 little square",
  },
  {
    id: "fourinarow",
    name: "Four Wins",
    aspect: 150 / 100,
    color: "#2563eb",
    trim: "#fde68a",
    hint: "📦 long rectangle",
  },
];

/** A cute dog face emoji standing in for each breed in previews. */
export const BREED_FACE: Record<DogBreed, string> = {
  golden: "🦮",
  chocolate: "🐕",
  husky: "🐺",
  dalmatian: "🐕‍🦺",
  corgi: "🦊",
};

/** Emoji shown on top of the dog for each owned head accessory. */
export const HAT_EMOJI: Record<string, string | null> = {
  none: null,
  bowtie: null, // neck, not a head hat — not shown on the head preview
  scarf: null,
  bell: null,
  sunglasses: "🕶️",
  tophat: "🎩",
  crown: "👑",
  witchhat: "🧙",
};

/** Small hat/head accessory list used by the wardrobe. */
export const HEAD_ACCESSORIES: { id: string; name: string; icon: string }[] = [
  { id: "sunglasses", name: "Cool Shades", icon: "🕶️" },
  { id: "tophat", name: "Top Hat", icon: "🎩" },
  { id: "crown", name: "Golden Crown", icon: "👑" },
  { id: "witchhat", name: "Witch Hat", icon: "🧙" },
];
