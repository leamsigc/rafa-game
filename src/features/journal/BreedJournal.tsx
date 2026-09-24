import React, { useState } from "react";
import { X, BookOpen, Lock, Trophy, ShieldCheck, RefreshCw, Link2 } from "lucide-react";
import { BREED_JOURNAL, discoveredBreeds } from "./breedData";
import { sound } from "../../utils/audio";

interface BreedJournalProps {
  dogName: string;
  dogBreed: string;
  level: number;
  accountName?: string;
  onClose: () => void;
  onOpenScoreboard: () => void;
  onLinkAccount?: () => void;
}

/**
 * Breed Discovery Journal — dog breeds unlock dynamically as your companion
 * levels up, each with trivia, origins & fun facts. Includes the Online
 * Scoreboard quick-access button.
 */
export const BreedJournal: React.FC<BreedJournalProps> = ({
  dogName,
  dogBreed,
  level,
  accountName,
  onClose,
  onOpenScoreboard,
  onLinkAccount,
}) => {
  const [selected, setSelected] = useState<string | null>(dogBreed || "golden");
  const found = discoveredBreeds(level);
  const foundIds = new Set(found.map((b) => b.id));
  const entry = BREED_JOURNAL.find((b) => b.id === selected) || null;
  const isDiscovered = entry ? foundIds.has(entry.id) : false;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-[#A7C957]/20 text-[#A7C957]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Breed Discovery Journal</h3>
              <p className="text-[11px] text-[#A7C957]/90 font-medium">
                {found.length}/{BREED_JOURNAL.length} breeds discovered • {accountName ? `Trainer: ${accountName}` : "Link your account for the scoreboard!"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#2c5234] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scoreboard quick-access bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/50 border-b border-[#386641]/10">
          <span className="text-[11px] font-bold text-[#386641]/70">
            🏆 {dogName} is a Level {level} good boy — rank up on the global board!
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { sound.playButtonTap(); onOpenScoreboard(); }}
              className="px-3 py-1.5 rounded-xl bg-[#6A994E] hover:bg-[#5b8543] text-white font-black text-[11px] shadow flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
            >
              <Trophy className="w-3.5 h-3.5" /> Online Scoreboard
            </button>
            {!accountName && onLinkAccount && (
              <button
                onClick={() => { sound.playButtonTap(); onLinkAccount(); }}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[11px] shadow flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
              >
                <Link2 className="w-3.5 h-3.5" /> Link Account
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Breed list */}
          <div className="w-[42%] overflow-y-auto p-2.5 space-y-1.5 border-r border-[#386641]/10">
            {BREED_JOURNAL.map((b) => {
              const unlocked = foundIds.has(b.id);
              const isSel = selected === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => { setSelected(b.id); sound.playButtonTap(); }}
                  className={`w-full p-2.5 rounded-xl flex items-center gap-2 text-left transition-all cursor-pointer ${
                    isSel ? "bg-[#386641] text-[#F2E8CF] shadow" : unlocked ? "bg-white/85 hover:bg-white text-[#386641]" : "bg-[#386641]/10 text-[#386641]/50"
                  }`}
                >
                  <span className={`text-xl ${unlocked ? "" : "grayscale opacity-50"}`}>{b.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-black truncate">{unlocked ? b.name : "???"}</span>
                    <span className="block text-[9px] font-bold opacity-70">
                      {unlocked ? `Lv ${b.unlockLevel}+` : `Unlocks at Lv ${b.unlockLevel}`}
                    </span>
                  </span>
                  {!unlocked && <Lock className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Detail card */}
          <div className="flex-1 overflow-y-auto p-4">
            {entry && (
              <div className="space-y-3">
                <div className="text-center">
                  <span className={`text-5xl block ${isDiscovered ? "" : "grayscale opacity-40"}`}>{entry.emoji}</span>
                  <h4 className={`text-sm font-black mt-1 ${isDiscovered ? "text-[#386641]" : "text-[#386641]/50"}`}>
                    {isDiscovered ? entry.name : "Still a mystery..."}
                  </h4>
                </div>
                {isDiscovered ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="bg-white rounded-2xl p-3 border border-[#386641]/12">
                      <span className="font-black text-[#6A994E]">🌍 Origins:</span>{" "}
                      <span className="font-bold">{entry.origin} — {entry.era}</span>
                    </div>
                    <div className="bg-white rounded-2xl p-3 border border-[#386641]/12">
                      <span className="font-black text-[#BC4749]">💛 Personality:</span>{" "}
                      <span className="font-bold">{entry.personality}</span>
                    </div>
                    <div className="bg-[#A7C957]/25 rounded-2xl p-3 border border-[#6A994E]/25">
                      <span className="font-black text-[#386641]">🌟 Fun Fact:</span>{" "}
                      <span className="font-bold">{entry.funFact}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-[#386641]/60 text-center bg-white/70 rounded-2xl p-4 border border-[#386641]/10">
                    Keep earning XP with {dogName} — this breed unlocks at Level {entry.unlockLevel}! 🐾
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Re-exported for the scoreboard's verified trainer icon
export { ShieldCheck, RefreshCw };
