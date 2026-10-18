import React from "react";
import { X, Trophy, ClipboardList, Pin } from "lucide-react";

interface NoticeBoardModalProps {
  /** The banner on the board → achievements. */
  onOpenAchievements: () => void;
  /** The "Daily Missions" paper → today's five missions. */
  onOpenDailyMissions: () => void;
  onClose: () => void;
}

/**
 * The Notice Board — a full-screen corkboard view. Pinned to it are two notes
 * clipped over one another, a "Daily Missions" paper and a banner across the
 * top that opens your Achievements. Looks like the board out in the park.
 */
export const NoticeBoardModal: React.FC<NoticeBoardModalProps> = ({
  onOpenAchievements,
  onOpenDailyMissions,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border-8 border-[#5c3a1e]">
        {/* Corkboard face */}
        <div
          className="relative p-5 sm:p-7"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, #e0bf90 0%, #d3ad78 45%, #c69a63 100%)",
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-2 rounded-xl bg-black/25 hover:bg-black/40 text-white transition-colors cursor-pointer"
            aria-label="Close notice board"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Banner across the top → Achievements */}
          <button
            onClick={onOpenAchievements}
            title="Open the Achievements Hall of Fame"
            className="group w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-gradient-to-r from-[#b45309] to-[#7c2d12] border-2 border-[#5c3a1e] shadow-lg hover:from-[#c96a12] hover:to-[#8a3414] transition-colors cursor-pointer"
            style={{ transform: "rotate(-0.4deg)" }}
          >
            <Trophy className="w-6 h-6 text-[#fde68a]" />
            <span className="text-lg font-black tracking-wide text-[#fde68a]">
              ACHIEVEMENTS
            </span>
            <span className="text-[11px] font-bold text-[#fde68a]/80 hidden sm:inline">
              tap to look through what you did →
            </span>
          </button>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Stack of two notes clipped over one another */}
            <div className="relative h-56">
              <div
                className="absolute left-3 top-6 w-[86%] h-44 rounded-sm bg-[#f3ead2] shadow-md border border-black/10"
                style={{ transform: "rotate(3deg)" }}
              >
                <span className="absolute -top-2 left-4 text-lg">📌</span>
                <div className="p-4 pt-6">
                  <h4 className="text-sm font-black text-[#b45309]">WALK ROTA</h4>
                  <p className="mt-1 text-[11px] font-bold text-[#6b7280]">
                    Tue · Thu · Sat — mornings before the park gets busy.
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-[2px] bg-black/10 rounded-full" style={{ width: `${90 - i * 12}%` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div
                className="absolute left-8 top-0 w-[86%] h-44 rounded-sm bg-[#fffdf5] shadow-xl border border-black/10"
                style={{ transform: "rotate(-2deg)" }}
              >
                <span className="absolute -top-2 left-4 text-lg">📌</span>
                <div className="p-4 pt-6">
                  <h4 className="text-sm font-black text-[#386641]">PARK NOTICE</h4>
                  <p className="mt-1 text-[11px] font-bold text-[#6b7280]">
                    Bark softly after dark · always clean up the little things 🐾
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-[2px] bg-black/10 rounded-full" style={{ width: `${88 - i * 14}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* The Daily Missions paper */}
            <button
              onClick={onOpenDailyMissions}
              title="Open today's five Daily Missions"
              className="group relative h-56 rounded-sm bg-[#f0fdf4] shadow-md border border-black/10 text-left cursor-pointer hover:shadow-xl transition-shadow"
              style={{ transform: "rotate(1.4deg)" }}
            >
              <span className="absolute -top-2 left-4 text-lg">📌</span>
              <div className="p-5 pt-7 flex flex-col h-full">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-[#166534]" />
                  <h4 className="text-base font-black text-[#166534]">DAILY MISSIONS</h4>
                </div>
                <p className="mt-1 text-[11px] font-bold text-[#6b7280]">
                  Three fresh quests for {new Date().toLocaleDateString(undefined, { weekday: "long" })}. Reset every day.
                </p>
                <div className="mt-3 space-y-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border-2 border-[#166534]/40" />
                      <div className="h-[2px] bg-black/10 rounded-full flex-1" />
                    </div>
                  ))}
                </div>
                <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-black text-[#166534] group-hover:gap-2.5 transition-all">
                  <Pin className="w-3.5 h-3.5" /> Open the missions
                </span>
              </div>
            </button>
          </div>

          <p className="mt-5 text-center text-[10px] font-bold text-[#5c3a1e]/70">
            The park notice board · pinned notes, achievements & daily missions
          </p>
        </div>
      </div>
    </div>
  );
};
