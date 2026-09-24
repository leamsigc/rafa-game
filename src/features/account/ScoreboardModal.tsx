import React, { useEffect, useState } from "react";
import { X, Trophy, ShieldCheck, RefreshCw } from "lucide-react";
import { fetchScoreboard, ScoreboardEntry, submitScore } from "./AccountService";
import { sound } from "../../utils/audio";
import { discoveredBreeds } from "../journal/breedData";

interface ScoreboardModalProps {
  dogName: string;
  level: number;
  xp: number;
  accountName?: string;
  googleVerified?: boolean;
  onClose: () => void;
  onLinkAccount?: () => void;
}

/**
 * Online Scoreboard — ranks global trainers by level & XP, shows each
 * pup's name and discovered breed count, and flags Google-verified
 * accounts with a shield badge. Dynamic real-time sorting + refresh.
 */
export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({
  dogName,
  level,
  xp,
  accountName,
  googleVerified,
  onClose,
  onLinkAccount,
}) => {
  const [entries, setEntries] = useState<ScoreboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Auto-submit my own entry so the board always includes me
      await submitScore({
        trainerName: accountName || "You (unlinked)",
        pupName: dogName,
        level,
        xp,
        breeds: discoveredBreeds(level).length,
        googleVerified: !!googleVerified,
      });
      const board = await fetchScoreboard();
      if (!cancelled) {
        setEntries(board);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefresh]);

  // Dynamic real-time sorting: level first, then XP
  const sorted = [...entries].sort((a, b) => b.level - a.level || b.xp - a.xp);
  const myIndex = sorted.findIndex(
    (e) => e.pupName === dogName && (e.trainerName === (accountName || "You (unlinked)"))
  );

  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#386641]/20 bg-gradient-to-r from-violet-700 to-violet-500 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-white/15">
              <Trophy className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-black">Online Scoreboard</h3>
              <p className="text-[11px] text-white/85 font-medium">
                {loading ? "Syncing global trainers..." : `${sorted.length} trainers ranked`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { sound.playButtonTap(); setLastRefresh(Date.now()); setLoading(true); }}
              title="Refresh rankings"
              className="p-2 rounded-xl hover:bg-white/15 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/15 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto flex-1">
          {loading && (
            <div className="text-center py-8 text-sm font-bold text-[#386641]/60">Fetching trainers... 🐾</div>
          )}

          {!loading && sorted.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm font-bold text-[#386641]/70">No trainers on the board yet!</p>
              <p className="text-xs text-[#386641]/60">Play with your pup and refresh — you'll be #1. 🏆</p>
            </div>
          )}

          {sorted.map((e, i) => {
            const isMe = i === myIndex;
            return (
              <div
                key={`${e.trainerName}-${e.pupName}-${i}`}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  isMe
                    ? "bg-[#A7C957]/30 border-[#6A994E] shadow-sm scale-[1.02]"
                    : "bg-white/85 border-[#386641]/12"
                }`}
              >
                <span className={`w-7 text-center font-black text-sm ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-[#386641]/50"}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black truncate flex items-center gap-1">
                      {e.trainerName}
                      {e.googleVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-sky-600 fill-sky-200" title="Google Verified" />
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-[#386641]/65">
                    🐕 {e.pupName} • 🐾 Lv {e.level} • 📖 {e.breeds} breeds
                  </div>
                </div>
                <span className="text-[11px] font-black text-[#6A994E] tabular-nums">{e.xp} XP</span>
              </div>
            );
          })}

          {!loading && !googleVerified && onLinkAccount && (
            <div className="mt-3 bg-sky-50 border border-sky-200 rounded-2xl p-3.5 text-center">
              <p className="text-[11px] font-bold text-sky-800 mb-2">
                Link your Google account to claim your trainer name + verified shield! (+100 XP, +50 Coins)
              </p>
              <button
                onClick={() => { sound.playButtonTap(); onLinkAccount(); }}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[11px] shadow cursor-pointer active:scale-95 transition-transform"
              >
                Link Google Account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
