import React, { useEffect, useRef, useState } from "react";
import { Moon, Sparkles, Sun, Heart, Zap } from "lucide-react";
import { sound } from "../../utils/audio";

interface SleepOverlayProps {
  isActive?: boolean;
  dogName: string;
  onWakeUp?: () => void;
  onComplete?: () => void;
}

export const SleepOverlay: React.FC<SleepOverlayProps> = ({
  isActive = true,
  dogName,
  onWakeUp,
  onComplete,
}) => {
  const [phase, setPhase] = useState<"fading_in" | "good_night" | "morning" | "done">("fading_in");
  const onWakeUpRef = useRef(onWakeUp);
  onWakeUpRef.current = onWakeUp;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const hasFinishedRef = useRef(false);

  const handleFinish = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setPhase("done");
    if (onWakeUpRef.current) onWakeUpRef.current();
    if (onCompleteRef.current) onCompleteRef.current();
  };

  useEffect(() => {
    if (!isActive) {
      setPhase("fading_in");
      hasFinishedRef.current = false;
      return;
    }

    hasFinishedRef.current = false;
    setPhase("fading_in");

    // Step 1: "Good Night" letters appear with lullaby
    const t1 = setTimeout(() => {
      setPhase("good_night");
    }, 500);

    // Step 2: Morning dawn breaks
    const t2 = setTimeout(() => {
      setPhase("morning");
      sound.playGoodMorning();
    }, 3200);

    // Step 3: Wake up refreshed & complete
    const t3 = setTimeout(() => {
      handleFinish();
    }, 4800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isActive]);

  if (!isActive || phase === "done") return null;

  return (
    <div
      id="sleep-overlay-container"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-auto transition-all duration-1000 select-none"
      style={{
        backgroundColor:
          phase === "morning"
            ? "rgba(254, 243, 199, 0.94)"
            : "rgba(10, 15, 30, 0.97)",
      }}
    >
      {/* Good Night Scene */}
      {(phase === "fading_in" || phase === "good_night") && (
        <div className="flex flex-col items-center text-center px-6 max-w-md animate-fade-in">
          {/* Moon and Stars */}
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-200 to-yellow-100 shadow-[0_0_50px_rgba(251,191,36,0.5)] flex items-center justify-center animate-pulse">
              <Moon className="w-12 h-12 text-amber-500 fill-amber-300" />
            </div>
            <Sparkles className="w-5 h-5 text-yellow-300 absolute -top-2 -right-3 animate-bounce" />
            <Sparkles className="w-4 h-4 text-blue-200 absolute -bottom-1 -left-2 animate-pulse" />
          </div>

          {/* Good Night Typography */}
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-widest uppercase mb-3 drop-shadow-lg">
            Good Night
          </h1>

          <p className="text-amber-200/90 text-sm font-medium tracking-wide mb-6">
            {dogName} is sleeping peacefully in the cozy bed...
          </p>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 text-xs font-semibold mb-8">
            <span>Restoring energy</span>
            <span className="flex gap-1 text-sm tracking-widest text-amber-300 animate-pulse">
              Zzz...
            </span>
          </div>

          <button
            id="sleep-skip-button"
            onClick={handleFinish}
            className="px-5 py-2 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer shadow-sm hover:scale-105"
          >
            Wake Up Now ☀️
          </button>
        </div>
      )}

      {/* Good Morning Scene */}
      {phase === "morning" && (
        <div className="flex flex-col items-center text-center px-6 max-w-md animate-fade-in">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 shadow-[0_0_60px_rgba(245,158,11,0.6)] flex items-center justify-center">
              <Sun className="w-14 h-14 text-white fill-yellow-200 animate-spin" style={{ animationDuration: "20s" }} />
            </div>
            <Sparkles className="w-6 h-6 text-amber-500 absolute -top-2 -right-2 animate-bounce" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-amber-950 tracking-wider uppercase mb-3">
            Good Morning!
          </h1>

          <p className="text-amber-800 text-sm font-medium mb-6">
            A fresh new day has begun! {dogName} is fully energized and ready to play!
          </p>

          <div className="flex items-center gap-3 px-5 py-2.5 bg-white/80 backdrop-blur-md rounded-2xl border border-amber-300/80 shadow-md mb-8">
            <div className="flex items-center gap-1 text-emerald-600 font-black text-sm">
              <Zap className="w-4 h-4 fill-emerald-500 text-emerald-600" />
              <span>Energy 100%</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1 text-rose-500 font-black text-sm">
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
              <span>Full Vitality</span>
            </div>
          </div>

          <button
            id="morning-continue-button"
            onClick={handleFinish}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black text-xs shadow-lg shadow-amber-500/30 transition-all cursor-pointer"
          >
            Start Fresh Day ✨
          </button>
        </div>
      )}
    </div>
  );
};
