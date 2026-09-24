import React, { useEffect, useRef, useState } from "react";
import { X, Dumbbell, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { DogAction } from "../../types/pet";
import { sound } from "../../utils/audio";
import { logDayEvent } from "../journal/dayJournal";

interface GymMiniGameProps {
  dogName: string;
  onClose: () => void;
  /** Command the real 3D dog so it trains behind the modal too. */
  onDogAction: (action: DogAction) => void;
  /** Rewards paid out when the training session completes. */
  onComplete: (xp: number, coins: number) => void;
}

type Phase = "intro" | "choose" | "training" | "done";

interface TrainingSkill {
  id: string;
  name: string;
  icon: string;
  action: DogAction;
  advice: string[];
}

const SKILLS: TrainingSkill[] = [
  {
    id: "jump",
    name: "Jumping Skills",
    icon: "🦘",
    action: "jump",
    advice: ["Bend those knees!", "Reach for the sky!", "Paws UP, champ!", "Higher! Believed in you!"],
  },
  {
    id: "run",
    name: "Running Skills",
    icon: "🏃💨",
    action: "zoomies",
    advice: ["Move those legs!", "Feel the wind!", "Sprint like the wind!", "Look at that stride!"],
  },
  {
    id: "roll",
    name: "Rollover Skills",
    icon: "🔄",
    action: "roll",
    advice: ["Tuck and roll!", "Spin it, spin it!", "Nice tight form!", "Textbook rollover!"],
  },
];

const TRAINING_SECONDS = 5;

/**
 * Doggy Gym — meet MAX the muscle-bound coach dog! He asks if you want to
 * train your muscles, you pick a skill (jumping, running or rollover), and
 * the two dogs run a quick 5-second training session together before you
 * pocket +100 XP and +10 Doggy Coins.
 */
export const GymMiniGame: React.FC<GymMiniGameProps> = ({ dogName, onClose, onDogAction, onComplete }) => {
  const [phase, setPhase] = useState<Phase>("intro");
  const [skill, setSkill] = useState<TrainingSkill | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TRAINING_SECONDS);
  const [adviceIdx, setAdviceIdx] = useState(0);
  const paidRef = useRef(false);

  // The 5-second training session: coach advice rotates + the real dog trains
  useEffect(() => {
    if (phase !== "training" || !skill) return;
    onDogAction(skill.action);
    const adviceTimer = window.setInterval(() => {
      setAdviceIdx((i) => (i + 1) % skill.advice.length);
      sound.playSoftWoof();
    }, 1300);
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          window.clearInterval(adviceTimer);
          if (!paidRef.current) {
            paidRef.current = true;
            setPhase("done");
            logDayEvent("gymSessions", `Trained ${skill.name} with Max the coach`);
            confetti({ particleCount: 80, spread: 75, origin: { y: 0.5 } });
            sound.playRewardFanfare();
            onComplete(100, 10);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(adviceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const pickSkill = (s: TrainingSkill) => {
    setSkill(s);
    setSecondsLeft(TRAINING_SECONDS);
    setAdviceIdx(0);
    setPhase("training");
    sound.playWhistle();
  };

  /** The buff coach dog: 💪 MAX 💪 with a sweatband & tank top. */
  const CoachDog = ({ small = false }: { small?: boolean }) => (
    <div className={`relative flex flex-col items-center ${small ? "scale-90" : ""}`}>
      {/* Sweatband */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-20 h-3.5 bg-red-600 rounded-full border-2 border-red-900 z-10" />
      {/* Head */}
      <div className="text-7xl leading-none select-none">🐶</div>
      {/* Muscular body: tank top + big pecs/arms */}
      <div className="relative -mt-1">
        <div className="w-24 h-16 bg-emerald-700 rounded-xl relative border-2 border-emerald-900">
          {/* Pecs */}
          <div className="absolute left-2 top-1 w-9 h-9 bg-emerald-600 rounded-full border-2 border-emerald-900" />
          <div className="absolute right-2 top-1 w-9 h-9 bg-emerald-600 rounded-full border-2 border-emerald-900" />
          {/* Six-pack lines */}
          <div className="absolute inset-x-6 bottom-1.5 flex justify-between gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2.5 h-2.5 bg-emerald-900/40 rounded-full" />
            ))}
          </div>
        </div>
        {/* Bulging arms */}
        <span className="absolute -left-6 top-2 text-3xl">💪</span>
        <span className="absolute -right-6 top-2 text-3xl scale-x-[-1]">💪</span>
      </div>
      <span className="text-[10px] font-black text-amber-800 mt-1">MAX · Gym Coach</span>
    </div>
  );

  const SpeechBubble = ({ children }: { children: React.ReactNode }) => (
    <div className="relative bg-white rounded-2xl border-2 border-[#386641]/25 px-4 py-2.5 shadow-sm max-w-[240px]">
      <span className="text-sm font-black text-[#386641]">{children}</span>
      <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white border-r-2 border-b-2 border-[#386641]/25 rotate-45" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#386641]/20 bg-gradient-to-r from-orange-600 to-amber-500 text-white">
          <div>
            <h3 className="text-base font-black">🏋️ The Doggy Gym</h3>
            <p className="text-[11px] text-white/85 font-medium">Train with MAX — the strongest good boy in the city!</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* ---------- INTRO: meet the coach ---------- */}
          {(phase === "intro" || phase === "choose") && (
            <div className="flex flex-col items-center gap-4">
              <CoachDog />
              <SpeechBubble>
                {phase === "intro" ? "You want to train your muscles?" : "Pick your training, champ!"}
              </SpeechBubble>

              {/* The three training options */}
              <div className="grid grid-cols-3 gap-2 w-full pt-1">
                {SKILLS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pickSkill(s)}
                    className="p-3 rounded-2xl bg-white hover:bg-orange-50 border-2 border-orange-200 shadow-sm flex flex-col items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <span className="text-3xl">{s.icon}</span>
                    <span className="text-[11px] font-black text-center leading-tight text-orange-900">{s.name}</span>
                  </button>
                ))}
              </div>
              {phase === "intro" && (
                <button
                  onClick={() => setPhase("choose")}
                  className="px-6 py-2.5 rounded-2xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-xs shadow cursor-pointer active:scale-95 transition-transform flex items-center gap-1.5"
                >
                  <Dumbbell className="w-4 h-4" /> Yes, let's train!
                </button>
              )}
            </div>
          )}

          {/* ---------- TRAINING: 5 seconds with the coach ---------- */}
          {phase === "training" && skill && (
            <div className="space-y-4">
              {/* Countdown bar */}
              <div className="h-3 bg-[#386641]/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(secondsLeft / TRAINING_SECONDS) * 100}%` }}
                />
              </div>
              <div className="text-center text-xs font-black text-orange-800">
                Training {skill.name}... {secondsLeft}s
              </div>

              {/* Coach gives advice next to your dog doing the exercise */}
              <div className="flex items-end justify-center gap-4 sm:gap-8 py-2">
                <div className="flex flex-col items-center gap-2">
                  <CoachDog small />
                  <SpeechBubble>{skill.advice[adviceIdx]}</SpeechBubble>
                </div>
                <div className="flex flex-col items-center gap-2">
                  {/* Your dog doing the move (mirrored by the real 3D dog!) */}
                  <span
                    className={
                      skill.id === "jump"
                        ? "text-6xl animate-bounce"
                        : skill.id === "run"
                          ? "text-6xl gym-run-wiggle"
                          : "text-6xl gym-roll"
                    }
                  >
                    🐕
                  </span>
                  <span className="text-[10px] font-black text-[#386641]/70">{dogName}</span>
                </div>
              </div>
            </div>
          )}

          {/* ---------- DONE: rewards ---------- */}
          {phase === "done" && skill && (
            <div className="text-center space-y-4 py-3">
              <div className="text-5xl">🏆💪</div>
              <h4 className="text-base font-black">Great training session!</h4>
              <p className="text-xs font-bold text-[#386641]/75">
                Max is proud of you — {dogName} crushed the {skill.name.toLowerCase()}!
              </p>
              <div className="flex items-center justify-center gap-2 text-sm font-black">
                <span className="bg-[#A7C957]/40 rounded-full px-3 py-1.5 flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-[#6A994E]" /> +100 XP
                </span>
                <span className="bg-amber-100 rounded-full px-3 py-1.5 border border-amber-300">🪙 +10 Doggy Coins</span>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-xs shadow cursor-pointer active:scale-95 transition-transform"
              >
                Leave the Gym
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes gymRunWiggle {
            0%, 100% { transform: translateX(-6px) rotate(-4deg); }
            50% { transform: translateX(6px) rotate(4deg); }
          }
          @keyframes gymRollSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(-360deg); }
          }
          .gym-run-wiggle { display: inline-block; animation: gymRunWiggle 0.35s ease-in-out infinite; }
          .gym-roll { display: inline-block; animation: gymRollSpin 1s linear infinite; }
        `}</style>
      </div>
    </div>
  );
};
