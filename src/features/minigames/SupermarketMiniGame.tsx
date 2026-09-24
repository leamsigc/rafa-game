import React, { useMemo, useState } from "react";
import { X, ShoppingCart, Trophy, Sparkles, Check } from "lucide-react";
import { sound } from "../../utils/audio";
import { logDayEvent } from "../journal/dayJournal";

interface SupermarketMiniGameProps {
  dogName: string;
  onClose: () => void;
  /**
   * @param score correct picks out of 10
   * @param foodId the chosen food's ingredient id (only when score >= 5)
   */
  onGameComplete: (score: number, foodId: string | null) => void;
}

/** Aisle board areas the player shops from. */
const AREAS = [
  { id: "dairy", name: "Dairy", icon: "🥛", foodId: "egg", foodName: "Farm Eggs" },
  { id: "meat", name: "Meat", icon: "🥩", foodId: "meat", foodName: "Fresh Meat" },
  { id: "veggies", name: "Veggies", icon: "🥬", foodId: "carrot", foodName: "Garden Carrots" },
  { id: "bakery", name: "Bakery", icon: "🍞", foodId: "potato", foodName: "Golden Potatoes" },
  { id: "cheese", name: "Cheese", icon: "🧀", foodId: "cheese", foodName: "Cheddar Chunks" },
  { id: "fish", name: "Fish", icon: "🐟", foodId: "fish", foodName: "River Fish" },
  { id: "treats", name: "Treats", icon: "🦴", foodId: "honey", foodName: "Honey Bottles" },
  { id: "fruit", name: "Fruit", icon: "🍎", foodId: "blueberry", foodName: "Blueberries" },
] as const;

/** 10 shopping requests — "Happy wants..." — player taps the right aisle. */
function buildRequests(): { text: string; areaId: string }[] {
  const items: Record<string, string[]> = {
    dairy: ["a cold glass of milk 🥛", "a creamy yogurt cup 🥛", "a chunk of butter 🧈"],
    meat: ["a juicy steak 🥩", "breakfast sausages 🌭", "a chicken drumstick 🍗"],
    veggies: ["a crunchy carrot 🥕", "fresh green broccoli 🥦", "a big red tomato 🍅"],
    bakery: ["a warm loaf of bread 🍞", "a flaky croissant 🥐", "a cinnamon bagel 🥯"],
    cheese: ["a wedge of cheddar 🧀", "a mozzarella ball 🧀", "some grated parmesan 🧀"],
    fish: ["a fresh river fish 🐟", "a salmon fillet 🍣", "fish sticks for dinner 🐠"],
    treats: ["a jar of honey 🍯", "a peanut butter jar 🥜", "a bone-shaped biscuit 🦴"],
    fruit: ["a crisp red apple 🍎", "a sweet banana 🍌", "a bowl of blueberries 🫐"],
  };
  return Array.from({ length: 10 }, () => {
    const area = AREAS[Math.floor(Math.random() * AREAS.length)];
    const options = items[area.id];
    return { text: options[Math.floor(Math.random() * options.length)], areaId: area.id };
  });
}

type Phase = "shopping" | "reward" | "done";

/**
 * Supermarket Dash — {dogName} calls out what he wants; tap the right
 * aisle on the board. Score at least 5/10 and you pick one food to take
 * home FIVE of. City exclusive (tap the supermarket building).
 */
export const SupermarketMiniGame: React.FC<SupermarketMiniGameProps> = ({
  dogName,
  onClose,
  onGameComplete,
}) => {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>("shopping");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [chosenFood, setChosenFood] = useState<string | null>(null);
  const requests = useMemo(buildRequests, []);
  const current = requests[Math.min(round, 9)];

  const pickArea = (areaId: string, areaName: string, icon: string) => {
    if (phase !== "shopping" || feedback) return;
    const correct = areaId === current.areaId;
    if (correct) {
      setScore((s) => s + 1);
      setFeedback(`✅ ${icon} Got it! Into the cart!`);
      sound.playSqueak();
    } else {
      setFeedback(`❌ Oops — that's the ${areaName} aisle!`);
      sound.playBark("low");
    }
    window.setTimeout(() => {
      setFeedback(null);
      if (round >= 9) {
        const finalScore = score + (correct ? 1 : 0);
        if (finalScore >= 5) {
          setPhase("reward");
        } else {
          setPhase("done");
          finish(finalScore, null);
        }
        setRound(10);
      } else {
        setRound((r) => r + 1);
      }
    }, 900);
  };

  const chooseFood = (foodId: string) => {
    setChosenFood(foodId);
    setPhase("done");
    finish(score, foodId);
  };

  const finish = (finalScore: number, foodId: string | null) => {
    logDayEvent("supermarketTrips", `Supermarket run: ${finalScore}/10`);
    if (finalScore >= 5) logDayEvent("marketWins", "Nailed the 5/10 supermarket shopping dash!");
    onGameComplete(finalScore, foodId);
  };

  const chosenArea = AREAS.find((a) => a.foodId === chosenFood);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#386641]/20 bg-gradient-to-r from-sky-700 to-sky-500 text-white">
          <div>
            <h3 className="text-base font-black">🛒 Supermarket Dash</h3>
            <p className="text-[11px] text-white/85 font-medium">Listen to {dogName} & tap the right aisle!</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-black bg-white/20 rounded-full px-2.5 py-1">Item {Math.min(round + 1, 10)}/10</span>
            <span className="text-xs font-black bg-[#A7C957] text-[#386641] rounded-full px-2.5 py-1">✅ {score}</span>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/15 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {phase === "shopping" && (
            <>
              {/* {dogName}'s request */}
              <div className="text-center bg-white rounded-2xl border border-sky-200 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-wider text-sky-700">🐕 {dogName} wants...</div>
                <div className="text-lg font-black text-[#386641] mt-1">{current.text}</div>
                {feedback && (
                  <div className={`text-xs font-black mt-1.5 ${feedback.startsWith("✅") ? "text-emerald-600" : "text-rose-600"}`}>
                    {feedback}
                  </div>
                )}
              </div>

              {/* Aisle board */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AREAS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => pickArea(a.id, a.name, a.icon)}
                    className="p-3 rounded-2xl bg-white hover:bg-sky-50 border border-sky-200 shadow-sm flex flex-col items-center gap-1 transition-all cursor-pointer active:scale-95"
                  >
                    <span className="text-3xl">{a.icon}</span>
                    <span className="text-[11px] font-black text-sky-800">{a.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Reward: pick one food, take home 5! */}
          {phase === "reward" && (
            <>
              <div className="text-center bg-white rounded-2xl border border-emerald-200 px-4 py-3">
                <Trophy className="w-8 h-8 mx-auto text-amber-500" />
                <h4 className="text-base font-black mt-1.5">Great shopping! {score}/10</h4>
                <p className="text-xs font-bold text-[#386641]/75 mt-1">
                  Score 5+ unlocked! Choose ONE food to take home — you get <span className="text-[#BC4749]">FIVE</span> of it! 🎁
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AREAS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => chooseFood(a.foodId)}
                    className="p-3 rounded-2xl bg-white hover:bg-emerald-50 border border-emerald-200 shadow-sm flex items-center gap-2.5 transition-all cursor-pointer active:scale-95"
                  >
                    <span className="text-2xl">{a.icon}</span>
                    <span className="text-left">
                      <span className="block text-[11px] font-black text-[#386641]">{a.foodName} ×5</span>
                      <span className="block text-[10px] font-bold text-[#386641]/60">{a.name} aisle</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Done screen */}
          {phase === "done" && (
            <div className="text-center space-y-3 py-6">
              <Sparkles className="w-10 h-10 mx-auto text-[#A7C957]" />
              <h4 className="text-base font-black">{chosenFood ? "Groceries packed! 🛍️" : "Better luck next trip! 🛒"}</h4>
              <p className="text-xs font-bold text-[#386641]/75">
                {chosenFood
                  ? `You scored ${score}/10 and brought home 5× ${chosenArea?.foodName} ${chosenArea?.icon} — ${dogName} is thrilled!`
                  : `You scored ${score}/10 — need at least 5 to unlock the food reward. ${dogName} still loved the trip!`}
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-xs shadow cursor-pointer active:scale-95 transition-transform inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Head Home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
