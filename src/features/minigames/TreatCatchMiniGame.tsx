import React, { useState, useEffect, useRef } from "react";
import { X, Play, RotateCcw, Zap, ArrowLeft, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { sound } from "../../utils/audio";

interface TreatCatchMiniGameProps {
  dogName: string;
  dogEnergy: number;
  onClose: () => void;
  onGameComplete: (score: number, coinsEarned: number, energyBoost: number) => void;
}

interface FallingItem {
  id: number;
  x: number; // percentage 5 to 95
  y: number; // percentage 0 to 100
  type: "steak" | "biscuit" | "cheese" | "mudBall";
  points: number;
  energy: number;
  icon: string;
  speed: number;
}

export const TreatCatchMiniGame: React.FC<TreatCatchMiniGameProps> = ({
  dogName,
  dogEnergy,
  onClose,
  onGameComplete,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [dogX, setDogX] = useState<number>(50); // percentage 10 to 90
  const [items, setItems] = useState<FallingItem[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30); // 30 second frenzy

  const dogXRef = useRef<number>(50);
  const animRef = useRef<number | null>(null);
  const nextItemIdRef = useRef<number>(1);
  const streakRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const itemsRef = useRef<FallingItem[]>([]);
  const hasEndedRef = useRef<boolean>(false);

  const startGame = () => {
    hasEndedRef.current = false;
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    scoreRef.current = 0;
    setStreak(0);
    streakRef.current = 0;
    setTimeLeft(30);
    setDogX(50);
    dogXRef.current = 50;
    itemsRef.current = [];
    setItems([]);
    sound.playWhistle();
  };

  const moveDog = (dir: -1 | 1) => {
    const next = Math.max(10, Math.min(90, dogXRef.current + dir * 8));
    dogXRef.current = next;
    setDogX(next);
  };

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") {
        moveDog(-1);
      } else if (e.key === "ArrowRight" || e.key === "d") {
        moveDog(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPlaying]);

  // Timer countdown
  useEffect(() => {
    if (!isPlaying || gameOver) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, gameOver]);

  // Trigger end game when timer expires cleanly outside state updaters
  useEffect(() => {
    if (isPlaying && !gameOver && timeLeft === 0) {
      endGame();
    }
  }, [timeLeft, isPlaying, gameOver]);

  // Main game loop
  useEffect(() => {
    if (!isPlaying || gameOver) return;

    let spawnTimer = 0;

    const loop = () => {
      spawnTimer++;
      // Spawn new falling treat every ~45 frames
      if (spawnTimer % 45 === 0) {
        const r = Math.random();
        let itemType: "steak" | "biscuit" | "cheese" | "mudBall" = "biscuit";
        let icon = "🦴";
        let pts = 20;
        let eng = 5;

        if (r < 0.3) {
          itemType = "steak";
          icon = "🍖";
          pts = 40;
          eng = 10;
        } else if (r < 0.55) {
          itemType = "cheese";
          icon = "🧀";
          pts = 30;
          eng = 8;
        } else if (r < 0.8) {
          itemType = "biscuit";
          icon = "🦴";
          pts = 15;
          eng = 4;
        } else {
          itemType = "mudBall";
          icon = "🟤";
          pts = -20;
          eng = 0;
        }

        const uniqueId = nextItemIdRef.current++;
        itemsRef.current.push({
          id: uniqueId,
          x: 10 + Math.random() * 80,
          y: 0,
          type: itemType,
          points: pts,
          energy: eng,
          icon,
          speed: 1.2 + Math.random() * 0.8,
        });
      }

      // Update falling items
      const currentDogX = dogXRef.current;
      const remaining: FallingItem[] = [];

      itemsRef.current.forEach((item) => {
        const nextY = item.y + item.speed;

        // Catch collision near bottom (y > 78 and y < 92)
        if (nextY >= 78 && nextY <= 92 && Math.abs(item.x - currentDogX) < 9) {
          // Caught item!
          if (item.type === "mudBall") {
            sound.playBark("low");
            scoreRef.current = Math.max(0, scoreRef.current - 20);
            streakRef.current = 0;
          } else {
            sound.playCrunch();
            const currentStreak = streakRef.current;
            scoreRef.current += item.points * (1 + Math.floor(currentStreak / 5));
            streakRef.current += 1;
          }
        } else if (nextY <= 100) {
          remaining.push({ ...item, y: nextY });
        }
      });

      itemsRef.current = remaining;
      setItems(remaining);
      setScore(scoreRef.current);
      setStreak(streakRef.current);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, gameOver]);

  const endGame = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    setGameOver(true);
    setIsPlaying(false);
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    const finalScore = scoreRef.current;
    const coinsEarned = Math.max(8, Math.floor(finalScore / 25));
    const energyBoost = Math.min(30, Math.floor(finalScore / 40));

    sound.playRewardFanfare();
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });

    setTimeout(() => {
      onGameComplete(finalScore, coinsEarned, energyBoost);
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#A7C957] flex items-center justify-center text-[#386641] font-bold text-lg shadow-xs">
              🍖
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Treat Catch Frenzy</h2>
              <p className="text-xs text-[#F2E8CF]/80">Help {dogName} catch yummy flying snacks!</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-[#A7C957]/30 border border-[#6A994E]/40 rounded-full text-xs font-bold text-[#F2E8CF]">
              ⏱️ {timeLeft}s
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative h-72 sm:h-80 bg-gradient-to-b from-[#F2E8CF] via-[#e8dcb8] to-[#ded1ab] overflow-hidden select-none border-b border-[#386641]/20">
          {/* Falling treats */}
          {items.map((item) => (
            <div
              key={item.id}
              className="absolute text-3xl filter drop-shadow-md transition-all pointer-events-none"
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {item.icon}
            </div>
          ))}

          {/* Dog Catcher */}
          <div
            className="absolute bottom-2 transition-all duration-75 flex flex-col items-center"
            style={{
              left: `${dogX}%`,
              transform: "translateX(-50%)",
            }}
          >
            {/* Open mouth dog catcher sprite */}
            <div className="text-5xl filter drop-shadow-lg">🐶</div>
            <div className="w-16 h-2 bg-[#386641]/20 rounded-full" />
          </div>

          {/* Score & Multiplier HUD */}
          {isPlaying && (
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-[#386641] font-black">
              <div className="bg-[#F2E8CF]/90 border border-[#386641]/15 backdrop-blur px-3 py-1 rounded-full text-sm shadow-sm">
                Score: <span className="text-[#BC4749]">{score}</span>
              </div>
              {streak >= 3 && (
                <div className="bg-[#BC4749] text-white px-3 py-1 rounded-full text-xs animate-bounce shadow">
                  🔥 {streak} Streak!
                </div>
              )}
            </div>
          )}

          {/* Pre-game Screen */}
          {!isPlaying && !gameOver && (
            <div className="absolute inset-0 bg-[#386641]/65 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
              <h3 className="text-2xl font-black text-[#F2E8CF] mb-2">Snack Catcher Challenge</h3>
              <p className="text-sm text-[#F2E8CF]/90 max-w-sm mb-5">
                Catch yummy steaks, bone treats and cheese! Dodge the messy mud balls 🟤!
              </p>
              <button
                onClick={startGame}
                className="px-6 py-3 bg-[#BC4749] hover:bg-[#a63d3f] text-[#F2E8CF] font-black rounded-xl shadow-lg flex items-center gap-2 text-base transition-transform active:scale-95 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Snack Catching
              </button>
            </div>
          )}

          {/* Game Over Screen */}
          {gameOver && (
            <div className="absolute inset-0 bg-[#386641]/75 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="text-xl font-black text-white mb-1">Yum! {dogName} is full & happy!</h3>
              <p className="text-2xl font-black text-[#A7C957] mb-1">{score} Points</p>
              <p className="text-xs text-[#F2E8CF]/90 mb-4">
                +{Math.max(8, Math.floor(score / 25))} Treat Coins • +{Math.min(30, Math.floor(score / 40))}% Energy Boost
              </p>
              <div className="flex gap-3">
                <button
                  onClick={startGame}
                  className="px-4 py-2 bg-[#BC4749] hover:bg-[#a63d3f] text-[#F2E8CF] font-black rounded-xl flex items-center gap-2 text-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-[#F2E8CF] hover:bg-white text-[#386641] font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Back to Park
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-[#F2E8CF] border-t border-[#386641]/15 flex items-center justify-between gap-4">
          <div className="text-xs text-[#386641]/80 hidden sm:block font-medium">
            Controls: <strong>Left / Right Arrow</strong> or <strong>A / D</strong>
          </div>
          {isPlaying && (
            <div className="flex w-full sm:w-auto gap-3">
              <button
                onClick={() => moveDog(-1)}
                className="flex-1 sm:w-28 py-3 bg-white hover:bg-[#F2E8CF] border border-[#386641]/20 active:bg-[#e8dcb8] text-[#386641] font-black rounded-xl flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                Left
              </button>
              <button
                onClick={() => moveDog(1)}
                className="flex-1 sm:w-28 py-3 bg-white hover:bg-[#F2E8CF] border border-[#386641]/20 active:bg-[#e8dcb8] text-[#386641] font-black rounded-xl flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                Right
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
