import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, ScrollText, PawPrint } from "lucide-react";

interface TutorialStep {
  icon: string;
  title: string;
  text: string;
}

/**
 * The Town Hall's friendly clerk dog walks a brand-new pup through the whole
 * game. A short, friendly step-by-step so nobody gets lost in the city.
 */
const STEPS: TutorialStep[] = [
  {
    icon: "🐾",
    title: "Welcome to Happy's World!",
    text:
      "Woof! I'm Bruno, the town clerk. Your little dog is called Happy — and this whole city " +
      "is yours to explore. I'll show you around in a few quick steps. Ready?",
  },
  {
    icon: "❤️",
    title: "Care for Happy",
    text:
      "Watch the three bars: Energy ⚡, Happiness 😊 and Hunger 🍖. Pet him, play fetch and " +
      "give treats to keep him happy. Feed him before he gets too hungry and let him rest when " +
      "he's tired!",
  },
  {
    icon: "🎾",
    title: "Play & learn tricks",
    text:
      "Use the action buttons to sit, roll over, dance and more. Train tricks to earn XP and " +
      "level up. Every level gives you a training point for the Skill Tree!",
  },
  {
    icon: "🪙",
    title: "Coins & the Shop",
    text:
      "Earn Treat Coins by playing mini-games and doing tricks. Spend them in the shop on " +
      "accessories, bed colours, medicines and ingredients for cooking.",
  },
  {
    icon: "🏙️",
    title: "Ride into the city",
    text:
      "Tap the little car by the house to drive to the city. There you'll find the 🛒 Supermarket " +
      "and the 🏋️ Gym for mini-games, and the 🎂 Cake Store to set your birthday!",
  },
  {
    icon: "🎵",
    title: "Music School",
    text:
      "West of the street sits the Music School. Step inside and tap the instruments — piano, " +
      "guitar, drums and more — to hear them play!",
  },
  {
    icon: "📚",
    title: "The Library",
    text:
      "Right next door to this Town Hall is the Library. Open the glowing books on the shelves " +
      "and Happy will read you a brand-new story every time.",
  },
  {
    icon: "🏛️",
    title: "You're all set!",
    text:
      "That's everything! Come back to the Town Hall whenever you want this tour again. " +
      "Now go have fun — and give Happy a scratch behind the ears from me. 🐶",
  },
];

interface TutorialModalProps {
  dogName: string;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ dogName, onClose }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const atEnd = step >= STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#fdf6e3] border border-amber-300 rounded-3xl shadow-2xl overflow-hidden text-[#4a3418] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#7c4a03] text-[#fdf6e3]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-white/15">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base leading-tight">Town Hall Tutorial</h2>
              <p className="text-[10px] sm:text-[11px] text-amber-100 font-bold">
                Bruno the clerk dog 🐾 shows you the ropes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-amber-900/50 transition-colors cursor-pointer"
            aria-label="Close tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                i === step ? "w-6 bg-[#7c4a03]" : "w-1.5 bg-amber-300 hover:bg-amber-400"
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto">
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="text-5xl sm:text-6xl leading-none select-none" aria-hidden>
              {current.icon}
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[#5c3603]">{current.title}</h3>
            <p className="text-xs sm:text-sm font-semibold leading-relaxed text-[#5c4a2e] max-w-md">
              {current.text}
            </p>
            {step === 0 && (
              <p className="text-[11px] font-bold text-amber-700/80 mt-1">
                This tour is about your pup, <span className="underline">{dogName}</span>.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-amber-200 bg-[#f7edd6] flex items-center gap-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border-2 border-amber-200 hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed font-black text-xs transition-all cursor-pointer active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex-1 text-center text-[11px] font-black text-amber-700">
            {step + 1} / {STEPS.length}
          </div>
          {atEnd ? (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7c4a03] hover:bg-[#5c3603] text-[#fdf6e3] font-black text-xs shadow-md transition-all cursor-pointer active:scale-95"
            >
              <PawPrint className="w-4 h-4" /> Let's go!
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7c4a03] hover:bg-[#5c3603] text-[#fdf6e3] font-black text-xs shadow-md transition-all cursor-pointer active:scale-95"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
