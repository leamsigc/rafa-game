import React, { useEffect, useState } from "react";
import { X, Zap, Heart, Utensils, Sparkles, ChefHat } from "lucide-react";
import { CookingJob } from "../../types/pet";
import { sound } from "../../utils/audio";

interface SoupReadyModalProps {
  job: CookingJob;
  dogName: string;
  onServe: () => void;
  onClose: () => void;
}

/**
 * Soup-ready reveal: the pot spins around, then the lid slides off and
 * drops down, showing the soup name + its special effects.
 */
export const SoupReadyModal: React.FC<SoupReadyModalProps> = ({ job, dogName, onServe, onClose }) => {
  const [phase, setPhase] = useState<"spin" | "lid" | "reveal">("spin");

  useEffect(() => {
    sound.playPotReveal();
    const t1 = window.setTimeout(() => setPhase("lid"), 1400);
    const t2 = window.setTimeout(() => {
      setPhase("reveal");
      sound.playRewardFanfare();
    }, 2600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#FFF7ED] border border-amber-900/20 rounded-3xl shadow-2xl overflow-hidden text-amber-950">
        <div className="bg-gradient-to-r from-[#F50A26] via-orange-500 to-amber-500 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-2xl">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight">🍲 Soup's ready!</h2>
              <p className="text-[11px] text-amber-100">Fresh from the pot for {dogName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/15 hover:bg-white/30 transition" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Animated pot stage */}
        <div className="flex flex-col items-center pt-6 pb-2 px-6 bg-gradient-to-b from-amber-100/80 to-[#FFF7ED]">
          <div className="relative h-44 w-44">
            {/* steam */}
            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 flex gap-1.5 transition-opacity duration-500 ${phase === "reveal" ? "opacity-100" : "opacity-40"}`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="block w-2.5 h-2.5 rounded-full bg-stone-300/90 animate-bounce" style={{ animationDelay: `${i * 180}ms` }} />
              ))}
            </div>
            {/* pot body: spins in phase 1 */}
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 transition-transform"
              style={{
                animation: phase === "spin" ? "potspin 1.4s ease-in-out" : undefined,
              }}
            >
              <div className="w-32 h-20 rounded-b-[2.5rem] rounded-t-xl bg-gradient-to-b from-slate-600 to-slate-800 border-2 border-slate-900 shadow-xl relative overflow-hidden">
                <div className={`absolute top-1.5 left-2 right-2 h-5 rounded-full bg-gradient-to-b from-amber-300 to-orange-500 transition-all duration-700 ${phase === "reveal" ? "opacity-100 scale-100" : "opacity-60 scale-90"}`} />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-3xl">{job.recipeIcon}</div>
              </div>
              <div className="mx-auto -mt-1 h-2 w-36 rounded-full bg-slate-900/80" />
            </div>
            {/* lid: sits on top, then slides off and drops down */}
            <div
              className="absolute left-1/2 top-10 transition-all duration-700 ease-in"
              style={
                phase === "spin"
                  ? { transform: "translateX(-50%) rotate(0deg)", opacity: 1 }
                  : phase === "lid"
                    ? { transform: "translateX(10%) translateY(46px) rotate(38deg)", opacity: 1 }
                    : { transform: "translateX(28%) translateY(72px) rotate(62deg)", opacity: 0.95 }
              }
            >
              <div className="w-36 h-5 rounded-full bg-gradient-to-b from-slate-300 to-slate-500 border-2 border-slate-600 shadow-lg" />
              <div className="mx-auto -mt-3 h-3 w-6 rounded-full bg-slate-700" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-amber-800/80 h-4">
            {phase === "spin" ? "The pot is turning..." : phase === "lid" ? "The lid is sliding off..." : "Ta-daa! Dinner is served! ✨"}
          </p>
          <style>{`@keyframes potspin { 0% { transform: translateX(-50%) rotate(0deg);} 30% { transform: translateX(-50%) rotate(-14deg);} 55% { transform: translateX(-50%) rotate(12deg);} 80% { transform: translateX(-50%) rotate(-6deg);} 100% { transform: translateX(-50%) rotate(0deg);} }`}</style>
        </div>

        {/* Dish info card */}
        <div className={`px-5 pb-5 transition-all duration-500 ${phase === "reveal" ? "opacity-100 translate-y-0" : "opacity-40 translate-y-2"}`}>
          <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm text-center">
            <div className="text-4xl">{job.recipeIcon}</div>
            <h3 className="text-lg font-black mt-1 flex items-center justify-center gap-1.5">
              {job.recipeName}
              <Sparkles className="w-4 h-4 text-amber-500" />
            </h3>
            <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">{job.description}</p>
            <div className="flex items-center justify-center gap-3 mt-3 text-xs font-black flex-wrap">
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <Zap className="w-3.5 h-3.5" /> +{job.energyBoost}% energy
              </span>
              <span className="flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                <Heart className="w-3.5 h-3.5" /> +{job.happinessBoost}% joy
              </span>
              <span className="flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <Utensils className="w-3.5 h-3.5" /> −{job.hungerReduction}% hunger • +{job.xp} XP
              </span>
            </div>
          </div>
          <button
            onClick={onServe}
            disabled={phase !== "reveal"}
            className={`mt-3 w-full py-3 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
              phase === "reveal"
                ? "bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/30 cursor-pointer"
                : "bg-amber-950/10 text-amber-950/35 cursor-wait"
            }`}
          >
            🐶 Serve to {dogName}!
          </button>
        </div>
      </div>
    </div>
  );
};
