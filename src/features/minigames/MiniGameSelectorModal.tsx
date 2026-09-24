import React from "react";
import { X, Play, Trophy, Sparkles, Store } from "lucide-react";
import { MiniGameType } from "../../types/pet";

interface MiniGameSelectorModalProps {
  dogName: string;
  boneBalance: number;
  onSelectGame: (game: MiniGameType) => void;
  onOpenBoneRushStore: () => void;
  onOpenGalaxyArcade: () => void;
  onClose: () => void;
}

interface GameCard {
  type: MiniGameType;
  icon: string;
  title: string;
  blurb: string;
  perk: string;
  perkIcon: React.ReactNode;
  buttonLabel: string;
  buttonClass: string;
}

const GAMES: GameCard[] = [
  {
    type: "boneRush",
    icon: "🦴",
    title: "Subway Pup: Bone Rush",
    blurb: `Slide ${"{dog}"} back and forth across three lanes — grab bones, dodge crates! Every bone banks into your wallet. 10 score = 1 Treat Coin!`,
    perk: "Banked bones spend in the Bone Rush Store",
    perkIcon: <Store className="w-3 h-3 text-amber-500" />,
    buttonLabel: "Run!",
    buttonClass: "bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF]",
  },
  {
    type: "fetch",
    icon: "🎾",
    title: "Bone Rush Fetch",
    blurb: "Aim & throw the bone — your dog sprints, grabs and returns it in full 3D physics!",
    perk: "🎾 Bone physics • tired pups run slower!",
    perkIcon: <Trophy className="w-3 h-3 text-[#D4A373]" />,
    buttonLabel: "Throw",
    buttonClass: "bg-[#A7C957] hover:bg-[#97b949] text-[#386641]",
  },
  {
    type: "agility",
    icon: "🏃‍♂️",
    title: "Agility Park Dash",
    blurb: "Leap over hurdles and hoops in an obstacle course!",
    perk: "Win up to 100+ Treat Coins",
    perkIcon: <Trophy className="w-3 h-3 text-[#D4A373]" />,
    buttonLabel: "Play",
    buttonClass: "bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF]",
  },
  {
    type: "treatCatch",
    icon: "🍖",
    title: "Treat Catch Frenzy",
    blurb: `Steer ${"{dog}"} to catch delicious flying snacks!`,
    perk: "Restores energy + rewards",
    perkIcon: <Sparkles className="w-3 h-3 text-[#BC4749]" />,
    buttonLabel: "Play",
    buttonClass: "bg-[#6A994E] hover:bg-[#5b8543] text-[#F2E8CF]",
  },
  {
    type: "pawShuffle",
    icon: "🥣",
    title: "Paw Shuffle",
    blurb: `A treat hides under wooden bowls that shuffle & swap! Watch closely, use Sniff Hint to eliminate an empty bowl, and ride your streak.`,
    perk: "Combo streaks pay Treat Coins + XP",
    perkIcon: <Sparkles className="w-3 h-3 text-[#BC4749]" />,
    buttonLabel: "Play",
    buttonClass: "bg-[#BC4749] hover:bg-[#a63a3c] text-white",
  },
  {
    type: "backyardDigger",
    icon: "⛏️",
    title: "Backyard Digger",
    blurb: `Send ${"{dog}"} digging through the 5x5 garden! Golden bones, squeaky toys, tennis balls (restore stamina), rare 🦕 fossils & treasure chests. Empty patches sniff out 👃 neighboring loot.`,
    perk: "Complete haul pays into coins, XP & happiness",
    perkIcon: <Trophy className="w-3 h-3 text-[#D4A373]" />,
    buttonLabel: "Dig",
    buttonClass: "bg-[#6b4423] hover:bg-[#5a3a1f] text-[#F2E8CF]",
  },
];

export const MiniGameSelectorModal: React.FC<MiniGameSelectorModalProps> = ({
  dogName,
  boneBalance,
  onSelectGame,
  onOpenBoneRushStore,
  onOpenGalaxyArcade,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#A7C957] flex items-center justify-center text-[#386641] font-bold text-lg shadow-xs">
              🎮
            </div>
            <div>
              <h3 className="text-base font-black text-white">Park Mini-Games</h3>
              <p className="text-xs text-[#F2E8CF]/80">Play together with {dogName} to earn coins & boosts!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Games list */}
        <div className="p-5 space-y-3.5 overflow-y-auto">
          {/* Galaxy Arcade launcher — a whole other dimension of arcade games */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-700 via-indigo-700 to-slate-900 border-2 border-violet-400 flex items-center justify-between gap-4 shadow-lg relative overflow-hidden">
            <span className="absolute -right-2 -top-3 text-6xl opacity-20">🌌</span>
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-2xl shrink-0">
                🕹️
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white">Galaxy Arcade</h4>
                <p className="text-xs text-violet-200/90 mt-0.5">
                  Teleport to a neon galaxy world — arcade machines with real playable games!
                  (Also reachable from the bedroom arcade machine 🌌)
                </p>
              </div>
            </div>
            <button
              onClick={onOpenGalaxyArcade}
              className="px-4 py-2 rounded-xl bg-white text-violet-800 hover:bg-violet-100 font-black text-xs shadow transition-transform active:scale-95 shrink-0 cursor-pointer"
            >
              Teleport 🌌
            </button>
          </div>
          {GAMES.map((g) => (
            <div
              key={g.type}
              className={`p-4 rounded-2xl border border-[#386641]/15 flex items-center justify-between gap-4 transition-all shadow-sm ${
                g.type === "boneRush"
                  ? "bg-gradient-to-r from-white to-amber-50 border-2 border-amber-400"
                  : "bg-white/85 hover:bg-white"
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#F2E8CF] border border-[#386641]/15 flex items-center justify-center text-2xl shrink-0">
                  {g.icon}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-[#386641]">{g.title}</h4>
                  <p className="text-xs text-[#386641]/75 mt-0.5">{g.blurb.replace("{dog}", dogName)}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6A994E] mt-1">
                    {g.perkIcon} {g.perk}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onSelectGame(g.type)}
                className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 shadow transition-transform active:scale-95 cursor-pointer ${g.buttonClass}`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {g.buttonLabel}
              </button>
            </div>
          ))}

          {/* Bone Rush store launcher with live balance */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 border border-amber-300 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/25 flex items-center justify-center text-2xl shrink-0">
                🛍️
              </div>
              <div>
                <h4 className="text-sm font-black text-white">Bone Rush Store</h4>
                <p className="text-xs text-white/85">
                  Bone designs, trail effects & runner costumes — 💰 {boneBalance} bones banked
                </p>
              </div>
            </div>
            <button
              onClick={onOpenBoneRushStore}
              className="px-4 py-2 bg-white text-amber-700 hover:bg-amber-50 font-black text-xs rounded-xl flex items-center gap-1.5 shrink-0 shadow transition-transform active:scale-95 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5" /> Store
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
