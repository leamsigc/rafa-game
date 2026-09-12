import React, { useState } from "react";
import { X, GraduationCap, Zap, Award, Dumbbell } from "lucide-react";
import { TRAINABLE_TRICKS, TrickId, trickTierFor, isTrickLearned } from "./trainingData";
import { sound } from "../../utils/audio";

export interface TrainResult {
  trickId: TrickId;
  success: boolean;
  gain: number;
  proficiency: number;
  leveledUp: boolean;
}

interface TrainingModalProps {
  dogName: string;
  dogEnergy: number;
  trickProgress: Record<string, number>;
  trainingPoints: number;
  onTrain: (trickId: TrickId) => TrainResult | null;
  onOpenSkillTree: () => void;
  onClose: () => void;
}

const TIER_STYLES: Record<string, string> = {
  Untrained: "bg-stone-200 text-stone-600",
  Learning: "bg-sky-100 text-sky-800",
  Skilled: "bg-emerald-100 text-emerald-800",
  Mastered: "bg-amber-100 text-amber-900",
};

export const TrainingModal: React.FC<TrainingModalProps> = ({
  dogName,
  dogEnergy,
  trickProgress,
  trainingPoints,
  onTrain,
  onOpenSkillTree,
  onClose,
}) => {
  const [lastResult, setLastResult] = useState<TrainResult | null>(null);
  const [busyTrick, setBusyTrick] = useState<TrickId | null>(null);

  const handleTrainClick = (trickId: TrickId) => {
    sound.playButtonTap();
    setBusyTrick(trickId);
    window.setTimeout(() => {
      const result = onTrain(trickId);
      setLastResult(result);
      setBusyTrick(null);
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#A7C957] rounded-2xl">
              <GraduationCap className="w-5 h-5 text-[#386641]" />
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-none">Train {dogName}</h3>
              <p className="text-xs text-[#F2E8CF]/80 mt-1">
                Training Points: {trainingPoints} • Energy {dogEnergy}%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#2c5234] transition-colors cursor-pointer"
            aria-label="Close training"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {lastResult && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-bold animate-in fade-in slide-in-from-top-2 ${
                lastResult.success
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-amber-50 border-amber-300 text-amber-900"
              }`}
            >
              {lastResult.success
                ? `🎉 Nailed it! +${lastResult.gain}% ${lastResult.trickId} (${lastResult.proficiency}%)${
                    lastResult.leveledUp ? " — tier up! 🏅" : ""
                  }`
                : `🤔 Almost... ${dogName} got distracted. +${lastResult.gain}% effort. Try again!`}
            </div>
          )}

          {TRAINABLE_TRICKS.map((trick) => {
            const proficiency = Math.round(trickProgress[trick.id] || 0);
            const tier = trickTierFor(proficiency);
            const learned = isTrickLearned(proficiency);
            const tooTired = dogEnergy < trick.energyCost;
            return (
              <div
                key={trick.id}
                className="p-4 rounded-2xl bg-white/90 border border-[#386641]/15 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#F2E8CF] border border-[#386641]/15 flex items-center justify-center text-3xl shrink-0">
                    {trick.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black">“{trick.command}” — {trick.name}</h4>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${TIER_STYLES[tier]}`}
                      >
                        {tier}
                      </span>
                      {learned && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#386641] text-[#F2E8CF] flex items-center gap-1">
                          <Award className="w-3 h-3" /> Chat-ready
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#386641]/75 mt-0.5">{trick.description}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2.5 rounded-full bg-[#386641]/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#6A994E] to-[#A7C957] transition-all duration-500"
                      style={{ width: `${proficiency}%` }}
                    />
                  </div>
                  <span className="text-xs font-black w-10 text-right">{proficiency}%</span>
                </div>

                <button
                  onClick={() => handleTrainClick(trick.id)}
                  disabled={tooTired || busyTrick !== null}
                  className={`mt-3 w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-98 ${
                    tooTired || busyTrick !== null
                      ? "bg-[#386641]/15 text-[#386641]/40 cursor-not-allowed"
                      : "bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] shadow cursor-pointer"
                  }`}
                >
                  <Dumbbell className="w-4 h-4" />
                  {busyTrick === trick.id
                    ? "Training..."
                    : tooTired
                      ? `Too tired (−${trick.energyCost}% energy needed)`
                      : `Train ${trick.name} (−${trick.energyCost}% energy)`}
                </button>
                <p className="mt-1.5 text-[11px] text-[#386641]/60 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> +{trick.xpReward} XP per session • Chat obeys at Skilled (40%+)
                </p>
              </div>
            );
          })}

          <button
            onClick={onOpenSkillTree}
            className="w-full py-2.5 rounded-xl text-xs font-black bg-[#A7C957]/30 hover:bg-[#A7C957]/50 text-[#386641] border border-[#6A994E]/30 transition cursor-pointer"
          >
            ✨ Open full Skill Tree ({trainingPoints} points)
          </button>
        </div>
      </div>
    </div>
  );
};
