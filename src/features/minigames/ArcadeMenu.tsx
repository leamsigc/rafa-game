import React from "react";
import { Gamepad2, X, Home } from "lucide-react";

export interface ArcadeGameEntry {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
}

/** The five cabinets in the Galaxy Arcade, in ring order. */
export const ARCADE_GAMES: ArcadeGameEntry[] = [
  {
    id: "boneRush",
    title: "Subway Pup: Bone Rush",
    emoji: "🚇",
    blurb: "Outrun the ticket inspector. Bank the bones.",
  },
  {
    id: "pawShuffle",
    title: "Paw Shuffle",
    emoji: "🐾",
    blurb: "Match every paw before the clock runs out.",
  },
  {
    id: "backyardDigger",
    title: "Backyard Digger",
    emoji: "⛏️",
    blurb: "Dig up every buried bone. Watch the moles.",
  },
  {
    id: "treatCatch",
    title: "Treat Catch Frenzy",
    emoji: "🦴",
    blurb: "Catch falling treats. Do not drop the good boy.",
  },
  {
    id: "agility",
    title: "Agility Park Dash",
    emoji: "🏅",
    blurb: "Jump, weave and vault the park course.",
  },
];

interface ArcadeMenuProps {
  onPlay: (gameId: string) => void;
  onExit: () => void;
  onClose: () => void;
}

/**
 * Always-available game list inside the Galaxy Arcade. Hitting a cabinet in
 * 3D is fiddly at a distance, so every game is one tap away here too.
 */
export const ArcadeMenu: React.FC<ArcadeMenuProps> = ({ onPlay, onExit, onClose }) => (
  <div className="absolute inset-0 z-40 flex flex-col pointer-events-none px-3 sm:px-4 pt-[104px] sm:pt-[120px] pb-[104px] sm:pb-[120px]">
    <div className="flex items-start justify-between gap-3">
      {/* Title plate */}
      <div className="pointer-events-auto shrink-0 px-4 py-2.5 rounded-2xl bg-[#1E1B4B]/90 border border-[#a78bfa]/40 backdrop-blur-md shadow-xl">
        <h3 className="flex items-center gap-2 text-sm font-black text-white tracking-wide">
          <Gamepad2 className="w-4 h-4 text-[#22d3ee]" />
          GALAXY ARCADE
        </h3>
        <p className="text-[10px] text-[#a78bfa] font-bold">Pick any game below</p>
      </div>

      <button
        onClick={onClose}
        className="pointer-events-auto shrink-0 p-2 rounded-xl bg-[#1E1B4B]/90 border border-white/15 text-white/80 hover:text-white hover:bg-[#1E1B4B] active:scale-95 transition-all cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    {/* Game grid — every cabinet reachable in one tap */}
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pointer-events-auto self-start w-full lg:max-w-3xl">
      {ARCADE_GAMES.map((game) => (
        <button
          key={game.id}
          onClick={() => onPlay(game.id)}
          className="group flex items-start gap-3 text-left px-3.5 py-3 rounded-2xl bg-[#1E1B4B]/92 border border-[#7c3aed]/40 hover:border-[#22d3ee] hover:bg-[#241f4d] active:scale-[0.97] backdrop-blur-md shadow-lg transition-all cursor-pointer"
        >
          <span className="text-2xl leading-none shrink-0 group-hover:scale-110 transition-transform">
            {game.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-black text-xs text-white leading-tight">
              {game.title}
            </span>
            <span className="block text-[10px] text-[#a78bfa] leading-tight mt-0.5">
              {game.blurb}
            </span>
          </span>
        </button>
      ))}
    </div>

    {/* Home button, so leaving never requires a precise 3D press either */}
    <div className="mt-auto flex justify-center">
      <button
        onClick={onExit}
        className="pointer-events-auto flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#f472b6] hover:bg-[#db2777] active:scale-95 text-white font-black text-sm shadow-xl shadow-[#db2777]/30 transition-all cursor-pointer"
      >
        <Home className="w-4 h-4" />
        🏠 HOME — leave the arcade
      </button>
    </div>
  </div>
);
