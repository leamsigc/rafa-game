import React, { useState } from "react";
import { X, Check, Coins, Sparkles, Gift } from "lucide-react";
import {
  claimMission,
  getDailyMissions,
  getMissionProgress,
  type MissionDef,
} from "./dailyMissions";

interface DailyMissionsModalProps {
  /** Award the claimed reward to the trainer's stats. */
  onClaim: (mission: MissionDef, reward: { coins: number; xp: number }) => void;
  onClose: () => void;
}

/**
 * The "Daily Missions" paper — five quests pinned for today. Each shows live
 * progress from the Day Journal and a Claim button once it's complete.
 */
export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({ onClaim, onClose }) => {
  const [, setNonce] = useState(0);
  const { defs, claimed } = getDailyMissions();
  const claimedSet = new Set(claimed);
  const doneCount = defs.filter((d) => getMissionProgress(d).current >= d.goal).length;

  const handleClaim = (mission: MissionDef) => {
    const reward = claimMission(mission.id);
    if (reward) {
      onClaim(mission, reward);
      setNonce((n) => n + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[59] flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-[#166534]/25 bg-[#F2E8CF] text-[#386641] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#166534] to-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#A7C957] flex items-center justify-center text-xl shadow-sm">
              📋
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-none">Daily Missions</h3>
              <p className="text-[11px] text-[#F2E8CF]/80 mt-1">
                {doneCount}/{defs.length} complete today · resets each day at midnight
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close daily missions"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Missions */}
        <div className="p-4 space-y-2.5 overflow-y-auto">
          {defs.map((m) => {
            const prog = getMissionProgress(m);
            const pct = Math.min(100, Math.round((prog.current / Math.max(1, prog.goal)) * 100));
            const complete = prog.current >= prog.goal;
            const isClaimed = claimedSet.has(m.id);
            return (
              <div
                key={m.id}
                className={`rounded-2xl border p-3 flex items-center gap-3 transition-all ${
                  isClaimed
                    ? "bg-white/60 border-[#386641]/12"
                    : complete
                    ? "bg-gradient-to-br from-amber-50 to-[#A7C957]/20 border-amber-400 shadow-sm"
                    : "bg-white/80 border-[#386641]/12"
                }`}
              >
                <div
                  className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-xl border ${
                    complete ? "bg-white border-amber-300" : "bg-[#386641]/5 border-[#386641]/12"
                  }`}
                >
                  {m.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[13px] font-black text-[#386641] truncate">{m.title}</h4>
                    <span className="text-[10px] font-black text-amber-700 flex items-center gap-0.5">
                      <Coins className="w-3 h-3" /> {m.coins}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-[#386641]/65 leading-tight">{m.description}</p>
                  {!isClaimed && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#386641]/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#6A994E] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-[#386641]/60 whitespace-nowrap">
                        {prog.current}/{prog.goal}
                      </span>
                    </div>
                  )}
                </div>
                {isClaimed ? (
                  <span className="shrink-0 text-[11px] font-black text-[#6A994E] flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Done
                  </span>
                ) : (
                  <button
                    onClick={() => handleClaim(m)}
                    disabled={!complete}
                    className={`shrink-0 px-3.5 py-2 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      complete
                        ? "bg-[#6A994E] hover:bg-[#5a8342] text-[#F2E8CF] shadow-md active:scale-95"
                        : "bg-[#386641]/10 text-[#386641]/45 cursor-not-allowed"
                    }`}
                  >
                    {complete ? (
                      <>
                        <Gift className="w-3.5 h-3.5" /> Claim
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" /> In progress
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#386641]/15 bg-white/50 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold text-[#386641]/60">
            Come back every day for three new missions! 🐾
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
