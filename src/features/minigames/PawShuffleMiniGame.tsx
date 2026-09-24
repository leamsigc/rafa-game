import React, { useEffect, useRef, useState } from "react";
import { X, Search as SniffIcon, Sparkles } from "lucide-react";
import { sound } from "../../utils/audio";
import { logDayEvent, setLifetimeMax } from "../journal/dayJournal";

interface PawShuffleMiniGameProps {
  dogName: string;
  onClose: () => void;
  onGameComplete: (score: number, coinsEarned: number, energyUsed: number) => void;
}

type Phase = "reveal" | "shuffle" | "pick" | "result" | "over";

const TREATS = ["🍖", "🥓", "🧀", "🦴"];
const BOWL_SPACING = 96; // px between bowl slots

/**
 * Paw Shuffle (Find the Hidden Treat) — canine cognition shell game.
 * A treat is hidden under wooden bowls that shuffle and swap across the
 * board. Track the movement, tap Sniff Hint to eliminate a guaranteed
 * empty bowl, and ride the streak for Treat Coins + XP!
 */
export const PawShuffleMiniGame: React.FC<PawShuffleMiniGameProps> = ({
  dogName,
  onClose,
  onGameComplete,
}) => {
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>("reveal");
  const [treat] = useState(() => TREATS[Math.floor(Math.random() * TREATS.length)]);
  const [slots, setSlots] = useState<string[]>([]); // slot index -> bowl id
  const [treatBowlId, setTreatBowlId] = useState("");
  const [revealedBowl, setRevealedBowl] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [pupFace, setPupFace] = useState("👀");

  const timers = useRef<number[]>([]);
  const slotsRef = useRef<string[]>([]);
  const treatRef = useRef("");
  const missesRef = useRef(0);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const bowlCount = round <= 2 ? 3 : round <= 4 ? 4 : 5;
  // Difficulty scales: faster swaps every round
  const shuffleCount = 4 + round * 2;
  const swapInterval = Math.max(280, 640 - round * 45);

  useEffect(() => {
    startRound(1);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRound = (r: number) => {
    clearTimers();
    const count = r <= 2 ? 3 : r <= 4 ? 4 : 5;
    const ids = Array.from({ length: count }, (_, i) => `bowl-${i}`);
    const lucky = ids[Math.floor(Math.random() * count)];
    slotsRef.current = [...ids];
    treatRef.current = lucky;
    setSlots([...ids]);
    setTreatBowlId(lucky);
    setRevealedBowl(lucky); // show where the treat starts
    setEliminated([]);
    setHintUsed(false);
    setPhase("reveal");
    setPupFace("👀");
    // 1.4s of watch-the-treat, then hide & shuffle
    later(() => {
      setRevealedBowl(null);
      setPhase("shuffle");
      setPupFace(" tracker mode 🐾");
      runShuffle(0);
    }, 1400);
  };

  const runShuffle = (done: number) => {
    if (done >= shuffleCount) {
      later(() => setPhase("pick"), swapInterval);
      return;
    }
    // pick two different, non-eliminated slot indexes to swap
    const active = slotsRef.current.map((id, i) => ({ id, i })).filter((s) => !eliminated.includes(s.id));
    if (active.length >= 2) {
      const a = active[Math.floor(Math.random() * active.length)].i;
      let b = active[Math.floor(Math.random() * active.length)].i;
      if (a === b) return runShuffle(done);
      const next = [...slotsRef.current];
      [next[a], next[b]] = [next[b], next[a]];
      slotsRef.current = next;
      setSlots([...next]);
      sound.playButtonTap();
    }
    later(() => runShuffle(done + 1), swapInterval);
  };

  const pickBowl = (bowlId: string) => {
    if (phase !== "pick" || eliminated.includes(bowlId)) return;
    setRevealedBowl(bowlId);
    setPhase("result");
    if (bowlId === treatRef.current) {
      const gained = 5 + streak * 2 + round * 2;
      setCoins((c) => c + gained);
      setScore((s) => s + 1);
      setStreak((s) => {
        const ns = s + 1;
        setBestStreak((bs) => Math.max(bs, ns));
        setLifetimeMax("bestShuffleStreak", ns);
        return ns;
      });
      setPupFace("🥳 WOOF! Found it!");
      sound.playRewardFanfare();
    } else {
      setStreak(0);
      missesRef.current += 1;
      setMisses(missesRef.current);
      setPupFace("😮 *ears droop*");
      sound.playBark("low");
    }
    later(() => {
      if (missesRef.current >= 3) {
        finish();
      } else {
        const nr = round + 1;
        setRound(nr);
        startRound(nr);
      }
    }, 1600);
  };

  const useSniffHint = () => {
    if (phase !== "pick" || hintUsed) return;
    setHintUsed(true);
    // Eliminate one guaranteed-empty bowl
    const empties = slotsRef.current.filter((id) => id !== treatRef.current && !eliminated.includes(id));
    if (!empties.length) return;
    const gone = empties[Math.floor(Math.random() * empties.length)];
    setEliminated((e) => [...e, gone]);
    setPupFace("👃 *sniff sniff*");
    sound.playSoftWoof();
  };

  const finish = () => {
    setPhase("over");
    logDayEvent("miniGames", `Played Paw Shuffle round ${round} (${score} treats found)`);
    if (score >= 3) logDayEvent("wins", "Won a round of Paw Shuffle");
    onGameComplete(score * 5 + streak * 3, coins, 8);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div>
            <h3 className="text-base font-black text-white">🥣 Paw Shuffle</h3>
            <p className="text-[11px] text-[#A7C957]/90 font-medium">Find the hidden treat — {dogName} is watching!</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-[#A7C957]">Round {round}</span>
            <span className="text-xs font-black">🔥 Streak {streak}</span>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#2c5234] cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Watchful pup reaction line */}
          <div className="text-center bg-white/80 rounded-2xl border border-[#386641]/15 px-4 py-2.5">
            <span className="text-sm font-black">{pupFace}</span>
            <div className="text-[11px] font-bold text-[#386641]/70 mt-0.5">
              {phase === "reveal" && `Watch the ${treat} closely...`}
              {phase === "shuffle" && "Eyes on the bowls! They're swapping!"}
              {phase === "pick" && "Where did the treat go? Pick a bowl!"}
              {phase === "result" && revealedBowl === treatBowlId ? "TREAT FOUND! What a smart pup! 🎉" : "Aww, empty bowl. Try again!"}
            </div>
          </div>

          {/* The board — bowls slide smoothly between slots as they swap */}
          <div className="relative h-44 rounded-2xl bg-gradient-to-b from-[#6A994E]/30 to-[#A7C957]/30 border border-[#6A994E]/30 overflow-hidden">
            {slots.map((bowlId, slotIndex) => {
              const isEliminated = eliminated.includes(bowlId);
              const isRevealed = revealedBowl === bowlId;
              const hasTreat = bowlId === treatBowlId;
              return (
                <button
                  key={bowlId}
                  onClick={() => pickBowl(bowlId)}
                  disabled={phase !== "pick" || isEliminated}
                  className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    left: `calc(50% + ${(slotIndex - (slots.length - 1) / 2) * BOWL_SPACING}px - 32px)`,
                    transform: `translateY(-50%) scale(${isEliminated ? 0.6 : 1})`,
                    opacity: isEliminated ? 0.25 : 1,
                    zIndex: slotIndex,
                  }}
                >
                  {isRevealed ? (
                    <span className="block w-16 h-16 text-5xl drop-shadow-lg animate-bounce">
                      {hasTreat ? treat : "❌"}
                    </span>
                  ) : (
                    <span className="block w-16 h-16 text-5xl drop-shadow-lg" style={{ filter: "saturate(0.9)" }}>
                      🥣
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sniff hint + status */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={useSniffHint}
              disabled={phase !== "pick" || hintUsed}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black shadow flex items-center gap-1.5 transition-all ${
                phase === "pick" && !hintUsed
                  ? "bg-[#BC4749] hover:bg-[#a63a3c] text-white cursor-pointer active:scale-95"
                  : "bg-[#386641]/15 text-[#386641]/50 cursor-not-allowed"
              }`}
            >
              <SniffIcon className="w-4 h-4" /> Sniff Hint {hintUsed ? "(used)" : ""}
            </button>
            <div className="text-right">
              <div className="text-xs font-black">🪙 {coins} coins earned</div>
              <div className="text-[10px] font-bold text-[#386641]/60">Treats found: {score} • Misses: {misses}/3</div>
            </div>
          </div>
        </div>

        {/* Game over card */}
        {phase === "over" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="bg-[#F2E8CF] rounded-3xl border-4 border-[#A7C957] p-6 sm:p-8 shadow-2xl max-w-xs w-full space-y-3 text-center">
              <Sparkles className="w-9 h-9 mx-auto text-[#D4A373]" />
              <h3 className="text-lg font-black">Pawsome tracking!</h3>
              <p className="text-sm font-bold text-[#386641]/80">
                {score} treats found • Best streak {Math.max(bestStreak, streak)} 🔥
              </p>
              <p className="text-xs font-black text-[#BC4749]">+{coins} Treat Coins • +{score * 5 + streak * 3} XP</p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-sm cursor-pointer active:scale-95 transition-transform"
              >
                Collect Rewards
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
