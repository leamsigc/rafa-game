import React, { useEffect, useState } from "react";
import { Check, Coins, Gift, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import {
  claimMission,
  getDailyMissions,
  getMissionProgress,
  type MissionDef,
} from "./dailyMissions";

interface DailyMissionsHudProps {
  /** Award the claimed reward to the trainer's stats (also fires the confetti). */
  onClaim: (mission: MissionDef, reward: { coins: number; xp: number }) => void;
}

/**
 * The always-on "Daily Missions" HUD — a compact card that shows today's
 * three randomly generated tasks with a live progress bar and a Claim button
 * once a task is complete. It shares the same daily state as the notice-board
 * paper, so claiming here or there stays in sync.
 */
export const DailyMissionsHud: React.FC<DailyMissionsHudProps> = ({ onClaim }) => {
  const [, setNonce] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const { defs, claimed } = getDailyMissions();
  const claimedSet = new Set(claimed);
  const doneCount = defs.filter((d) => getMissionProgress(d).current >= d.goal).length;

  // Keep live progress fresh as the player plays (counters tick during play).
  useEffect(() => {
    const id = window.setInterval(() => setNonce((n) => n + 1), 4000);
    return () => window.clearInterval(id);
  }, []);

  const handleClaim = (mission: MissionDef) => {
    const reward = claimMission(mission.id);
    if (reward) {
      onClaim(mission, reward);
      setNonce((n) => n + 1);
    }
  };

  return (
    <div className="pointer-events-auto w-[262px] max-w-[76vw] select-none">
      <div className="rounded-2xl bg-[#F2E8CF]/95 backdrop-blur-md border border-[#386641]/25 shadow-xl shadow-[#386641]/15 overflow-hidden text-[#386641]">
        {/* Header */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-[#166534] to-[#386641] text-[#F2E8CF] cursor-pointer"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
            <span className="text-sm">📋</span> Daily Missions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-white/20">
              {doneCount}/{defs.length}
            </span>
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {!collapsed && (
          <div className="p-2 space-y-1.5 max-h-[42vh] overflow-y-auto">
            {defs.map((m) => {
              const prog = getMissionProgress(m);
              const pct = Math.min(100, Math.round((prog.current / Math.max(1, prog.goal)) * 100));
              const complete = prog.current >= prog.goal;
              const isClaimed = claimedSet.has(m.id);
              return (
                <div
                  key={m.id}
                  className={`rounded-xl border p-2 ${
                    isClaimed
                      ? "bg-white/50 border-[#386641]/12"
                      : complete
                      ? "bg-gradient-to-br from-amber-50 to-[#A7C957]/25 border-amber-400 shadow-sm"
                      : "bg-white/80 border-[#386641]/12"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-base ${isClaimed ? "opacity-50" : ""}`}>{m.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-black leading-tight truncate">
                        {m.title}
                      </span>
                      <span className="block text-[9px] font-bold text-[#386641]/55 leading-tight truncate">
                        {m.description}
                      </span>
                    </span>
                    {isClaimed ? (
                      <span className="shrink-0 text-[9px] font-black text-[#6A994E] flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Done
                      </span>
                    ) : (
                      <button
                        onClick={() => handleClaim(m)}
                        disabled={!complete}
                        className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-0.5 transition-all cursor-pointer ${
                          complete
                            ? "bg-[#6A994E] hover:bg-[#5a8342] text-[#F2E8CF] shadow active:scale-95"
                            : "bg-[#386641]/10 text-[#386641]/45 cursor-not-allowed"
                        }`}
                      >
                        {complete ? (
                          <>
                            <Gift className="w-3 h-3" /> Claim
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" /> {prog.current}/{prog.goal}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {!isClaimed && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#386641]/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#6A994E] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {complete && (
                        <span className="text-[9px] font-black text-amber-700 flex items-center gap-0.5 shrink-0">
                          <Coins className="w-2.5 h-2.5" /> {m.coins}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
