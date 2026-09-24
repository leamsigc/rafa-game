import React, { useEffect, useMemo } from "react";
import { X, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { SecretCodeDef } from "./secretCodes";
import dogAvatar from "../../assets/images/dog_avatar_1788547305164.jpg";
import { sound } from "../../utils/audio";

interface SecretCodeModalProps {
  code: SecretCodeDef;
  dogName: string;
  onClose: () => void;
}

const HAPPY_MEAL_FOODS = ["🍔", "🍟", "🥤", "🍗", "🥪", "🍪"];

/**
 * Full-screen cartoon Easter egg revealed by typing a secret chat code.
 * The crown jewel: your dog sitting at a table gobbling a Happy Meal
 * like a smug little troll. 😏
 */
export const SecretCodeModal: React.FC<SecretCodeModalProps> = ({ code, dogName, onClose }) => {
  useEffect(() => {
    sound.playRewardFanfare();
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 } });
  }, []);

  const fallingItems = useMemo(() => {
    const count = code.scene === "boneStorm" ? 26 : 22;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.6,
      duration: 2.2 + Math.random() * 2.4,
      size: 22 + Math.random() * 26,
    }));
  }, [code.scene]);

  const itemEmoji = code.scene === "boneStorm" ? "🦴" : code.scene === "treatRain" ? ["🍖", "🧀", "🥓", "🦴"][0] : "🦴";
  const treats = ["🍖", "🧀", "🥓", "🍪"];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* Falling emoji storm behind the card */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {fallingItems.map((f) => (
          <span
            key={f.id}
            className="absolute animate-fall-repeat"
            style={{
              left: `${f.left}%`,
              top: "-8%",
              fontSize: f.size,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.duration}s`,
            }}
          >
            {code.scene === "treatRain" ? treats[f.id % treats.length] : itemEmoji}
          </span>
        ))}
      </div>

      <div className="relative w-full max-w-md bg-[#F2E8CF] border-4 border-[#A7C957] rounded-3xl shadow-2xl overflow-hidden text-[#386641]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#A7C957]" />
            <h3 className="text-sm font-black tracking-wide">
              🎉 SECRET CODE UNLOCKED: {code.title}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[#2c5234] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-5">
          {code.scene === "happyMeal" ? (
            /* 🍔 The legendary Happy Meal troll scene */
            <div className="relative mx-auto w-64 h-56">
              <style>{`
                @keyframes trollGobble { 0%,100% { transform: translateY(0) rotate(0deg);} 25% { transform: translateY(-6px) rotate(-4deg);} 50% { transform: translateY(0) rotate(3deg);} 75% { transform: translateY(-4px) rotate(-2deg);} }
                @keyframes traySlide { 0%,100% { transform: translateX(0);} 50% { transform: translateX(-4px) rotate(1deg);} }
                @keyframes foodShrink { 0% { transform: scale(1); opacity: 1;} 80% { transform: scale(0.55); opacity: 0.85;} 100% { transform: scale(1); opacity: 1;} }
                @keyframes nomPop { 0%,100% { opacity: 0; transform: scale(0.6);} 40% { opacity: 1; transform: scale(1.15);} }
              `}</style>
              {/* Table */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-56 h-10 bg-[#92400e] rounded-t-xl border-4 border-[#78350f]" />
              {/* Dog (troll mode) */}
              <img
                src={dogAvatar}
                alt={dogName}
                referrerPolicy="no-referrer"
                className="absolute bottom-12 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full object-cover border-4 border-[#BC4749] shadow-xl animate-troll-gobble"
                style={{ animation: "trollGobble 0.9s ease-in-out infinite" }}
              />
              {/* Smug troll face + party hat */}
              <span className="absolute bottom-20 left-[calc(50%+34px)] text-3xl" style={{ animation: "nomPop 1.2s ease-in-out infinite" }}>😏</span>
              <span className="absolute bottom-36 left-[calc(50%-14px)] text-2xl rotate-12">🎉</span>
              {/* NOM NOM speech bubbles */}
              <span className="absolute bottom-36 left-2 text-xs font-black text-[#BC4749] bg-white rounded-full px-2 py-0.5 border border-[#BC4749]/30" style={{ animation: "nomPop 1.2s ease-in-out infinite" }}>NOM NOM!</span>
              {/* Tray with shrinking food */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-white/95 rounded-xl px-2 py-1.5 border-2 border-[#386641]/30" style={{ animation: "traySlide 1.4s ease-in-out infinite" }}>
                {HAPPY_MEAL_FOODS.map((f, i) => (
                  <span key={f} className="text-xl" style={{ animation: `foodShrink ${1.6 + i * 0.15}s ease-in-out infinite` }}>{f}</span>
                ))}
              </div>
              {/* Crumbs flying */}
              <span className="absolute bottom-6 right-6 text-lg" style={{ animation: "nomPop 0.7s ease-in-out infinite" }}>✨</span>
              <span className="absolute bottom-8 left-4 text-sm" style={{ animation: "nomPop 1s ease-in-out infinite" }}>🍟</span>
            </div>
          ) : (
            /* 🦴 Bone Storm / 🍖 Treat Rain celebration */
            <div className="relative mx-auto w-64 h-48">
              <img
                src={dogAvatar}
                alt={dogName}
                referrerPolicy="no-referrer"
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full object-cover border-4 border-[#A7C957] shadow-xl animate-bounce"
              />
              <span className="absolute bottom-14 left-4 text-4xl animate-spin-slow">{code.scene === "boneStorm" ? "🦴" : "🍖"}</span>
              <span className="absolute bottom-14 right-4 text-4xl animate-bounce" style={{ animationDelay: "0.3s" }}>{code.scene === "boneStorm" ? "🦴" : "🧀"}</span>
              <span className="absolute bottom-28 left-8 text-2xl" style={{ animation: "nomPop 0.9s ease-in-out infinite" }}>WOW!</span>
            </div>
          )}

          <div>
            <p className="text-sm font-bold text-[#386641] leading-relaxed">
              {code.scene === "happyMeal"
                ? `${dogName} is gobbling a whole Happy Meal like a tiny troll. So smug. So majestic.`
                : code.scene === "boneStorm"
                  ? `A magical storm of bones swirls around ${dogName}!`
                  : `It's raining treats! ${dogName} is living the dream!`}
            </p>
            <p className="text-xs font-bold text-[#BC4749] mt-2">+{code.rewardCoins} Treat Coins • Code added to your collection!</p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-sm shadow-md transition-colors cursor-pointer active:scale-95"
          >
            Epic. 😎
          </button>
        </div>
      </div>
    </div>
  );
};
