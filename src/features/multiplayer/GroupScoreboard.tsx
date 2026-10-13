import React from "react";
import { X, Crown, Swords } from "lucide-react";
import { MpScore } from "./mpClient";

interface GroupScoreboardProps {
  scores: MpScore[];
  myId: string;
  onClose: () => void;
}

/**
 * Group Scoreboard — auto-created the moment you're in a multiplayer group.
 * Everyone starts fresh at 1 XP, then it ranks every pup in the expedition
 * live. When the group dissolves, banked XP returns to each trainer's
 * own single-player account.
 */
export const GroupScoreboard: React.FC<GroupScoreboardProps> = ({ scores, myId, onClose }) => {
  const sorted = [...scores].sort((a, b) => b.xp - a.xp);
  return (
    <div className="absolute right-3 top-20 z-30 w-72 max-w-[85vw] rounded-2xl bg-slate-900/90 border border-white/15 shadow-2xl backdrop-blur-md text-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 font-bold">
          <Swords className="w-5 h-5 text-amber-300" />
          Group Scoreboard
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close scoreboard">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
        {sorted.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
              s.id === myId ? "bg-sky-500/25" : i % 2 === 0 ? "bg-white/5" : ""
            }`}
          >
            <span className="w-6 text-center font-black text-sm text-slate-400">#{i + 1}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold truncate">
                {s.name} {i === 0 && sorted.length > 1 && <Crown className="inline w-3.5 h-3.5 text-amber-300 -mt-0.5" />}
              </span>
              <span className="block text-xs text-slate-400 truncate">& {s.dogName}</span>
            </span>
            <span className="text-sm font-bold text-emerald-300">{s.xp} XP</span>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-center text-sm text-slate-400 py-4">Waiting for players...</p>}
      </div>
      <p className="px-4 py-2 text-[11px] text-slate-500 border-t border-white/10">
        Started fresh at 1 XP. Banked XP returns to your account when the group ends.
      </p>
    </div>
  );
};
