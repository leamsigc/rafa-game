import React, { useState, useEffect, useRef } from "react";
import { Play, RotateCcw, Award, Zap, ArrowUp, X } from "lucide-react";
import confetti from "canvas-confetti";
import { sound } from "../../utils/audio";

interface AgilityMiniGameProps {
  dogName: string;
  dogEnergy: number;
  onClose: () => void;
  onGameComplete: (score: number, coinsEarned: number, energyUsed: number) => void;
}

interface Obstacle {
  id: number;
  x: number; // 0 to 100%
  type: "hurdle" | "hoop" | "boneBonus";
  passed: boolean;
}

export const AgilityMiniGame: React.FC<AgilityMiniGameProps> = ({
  dogName,
  dogEnergy,
  onClose,
  onGameComplete,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [dogY, setDogY] = useState<number>(0); // Jump height: 0 (ground) to 120 (peak)
  const [isJumping, setIsJumping] = useState<boolean>(false);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [distanceRan, setDistanceRan] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1.2);

  const jumpVelocityRef = useRef<number>(0);
  const dogYRef = useRef<number>(0);
  const animRef = useRef<number | null>(null);
  const isJumpingRef = useRef<boolean>(false);
  const comboRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const speedRef = useRef<number>(1.2);
  const nextObstacleIdRef = useRef<number>(1);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const hasEndedRef = useRef<boolean>(false);

  const startGame = () => {
    hasEndedRef.current = false;
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    scoreRef.current = 0;
    setCombo(0);
    comboRef.current = 0;
    setDistanceRan(0);
    setSpeed(1.2);
    speedRef.current = 1.2;
    setIsJumping(false);
    isJumpingRef.current = false;
    setDogY(0);
    dogYRef.current = 0;
    jumpVelocityRef.current = 0;

    // Initial obstacle train with strictly unique monotonically increasing IDs
    const initialObs: Obstacle[] = [
      { id: nextObstacleIdRef.current++, x: 120, type: "hurdle", passed: false },
      { id: nextObstacleIdRef.current++, x: 170, type: "hoop", passed: false },
      { id: nextObstacleIdRef.current++, x: 210, type: "boneBonus", passed: false },
      { id: nextObstacleIdRef.current++, x: 260, type: "hurdle", passed: false },
      { id: nextObstacleIdRef.current++, x: 310, type: "hurdle", passed: false },
    ];
    obstaclesRef.current = initialObs;
    setObstacles(initialObs);
    sound.playWhistle();
  };

  const handleJump = () => {
    if (!isPlaying || isJumpingRef.current) return;
    setIsJumping(true);
    isJumpingRef.current = true;
    jumpVelocityRef.current = 14;
    sound.playSoftWoof();
  };

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPlaying]);

  // Main game physics loop
  useEffect(() => {
    if (!isPlaying || gameOver) return;

    const loop = () => {
      // 1. Jump gravity & arc
      if (isJumpingRef.current) {
        dogYRef.current += jumpVelocityRef.current;
        jumpVelocityRef.current -= 0.85; // Gravity

        if (dogYRef.current <= 0) {
          dogYRef.current = 0;
          setIsJumping(false);
          isJumpingRef.current = false;
          jumpVelocityRef.current = 0;
        }
        setDogY(dogYRef.current);
      }

      setDistanceRan((d) => d + 1);

      // 2. Move obstacles and detect collisions
      const currentSpeed = speedRef.current;
      const dogHitboxX = 22; // Dog's position on track in %
      const currentY = dogYRef.current;
      let shouldEnd = false;

      let updated = obstaclesRef.current.map((obs) => ({
        ...obs,
        x: obs.x - currentSpeed,
      }));

      updated.forEach((obs) => {
        if (!obs.passed && Math.abs(obs.x - dogHitboxX) < 5) {
          if (obs.type === "hurdle") {
            if (currentY < 40) {
              // Tripped on hurdle!
              sound.playBark("low");
              comboRef.current = 0;
              shouldEnd = true;
            } else {
              obs.passed = true;
              sound.playRewardFanfare();
              const currentCombo = comboRef.current;
              scoreRef.current += 50 * (currentCombo + 1);
              comboRef.current += 1;
            }
          } else if (obs.type === "hoop") {
            if (currentY < 35 || currentY > 110) {
              // Missed agility hoop
              comboRef.current = 0;
              obs.passed = true;
            } else {
              obs.passed = true;
              sound.playRewardFanfare();
              const currentCombo = comboRef.current;
              scoreRef.current += 100 * (currentCombo + 1);
              comboRef.current += 1;
            }
          } else if (obs.type === "boneBonus") {
            if (currentY > 30) {
              obs.passed = true;
              sound.playCrunch();
              scoreRef.current += 80;
            }
          }
        }
      });

      // Filter offscreen and spawn new
      updated = updated.filter((obs) => obs.x > -15);
      const lastObs = updated[updated.length - 1];
      if (!lastObs || lastObs.x < 85) {
        const rand = Math.random();
        const type: "hurdle" | "hoop" | "boneBonus" =
          rand < 0.5 ? "hurdle" : rand < 0.8 ? "hoop" : "boneBonus";
        updated.push({
          id: nextObstacleIdRef.current++,
          x: 105 + Math.random() * 25,
          type,
          passed: false,
        });
      }

      obstaclesRef.current = updated;
      setObstacles(updated);
      setScore(scoreRef.current);
      setCombo(comboRef.current);

      if (shouldEnd) {
        endGame(false);
        return;
      }

      // Increase speed slightly over time
      speedRef.current = Math.min(2.5, speedRef.current + 0.0003);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, gameOver]);

  const endGame = (won: boolean = false) => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    setGameOver(true);
    setIsPlaying(false);
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    const finalScore = scoreRef.current;
    const coinsEarned = Math.max(5, Math.floor(finalScore / 35));
    const energyUsed = 15;

    if (finalScore > 200) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    }

    setTimeout(() => {
      onGameComplete(finalScore, coinsEarned, energyUsed);
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#A7C957] flex items-center justify-center text-[#386641] font-bold text-lg shadow-xs">
              🏃‍♂️
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Agility Park Dash</h2>
              <p className="text-xs text-[#F2E8CF]/80">Time your jumps over hurdles with {dogName}!</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#A7C957]/30 border border-[#6A994E]/40 rounded-full text-xs font-bold text-[#F2E8CF]">
              <Zap className="w-3.5 h-3.5 text-[#A7C957]" />
              <span>Energy: {dogEnergy}%</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Game Canvas Area */}
        <div className="relative h-64 sm:h-72 bg-gradient-to-b from-sky-300 via-[#A7C957]/40 to-[#6A994E] overflow-hidden select-none border-b border-[#386641]/20">
          {/* Clouds */}
          <div className="absolute top-4 left-10 w-24 h-8 bg-white/70 rounded-full blur-[1px]" />
          <div className="absolute top-8 right-20 w-32 h-10 bg-white/60 rounded-full blur-[1px]" />

          {/* Distant trees */}
          <div className="absolute bottom-16 left-0 right-0 h-10 flex gap-4 opacity-40">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={`bg-tree-${i}`} className="w-12 h-12 bg-[#386641] rounded-full shrink-0" />
            ))}
          </div>

          {/* Running Track */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#D4A373] border-t-4 border-[#bc8a5f]">
            <div className="w-full h-full flex items-center">
              <div className="w-full h-1 border-b-2 border-dashed border-[#F2E8CF]" />
            </div>
          </div>

          {/* Player Dog Sprite */}
          <div
            className="absolute left-[20%] transition-transform"
            style={{
              bottom: `${64 + dogY}px`,
              transform: `rotate(${isJumping ? -12 : 0}deg)`,
            }}
          >
            <div className="relative">
              {/* Dog emoji / badge avatar with jump shadow */}
              <div className="text-5xl filter drop-shadow-md">🐕</div>
              {/* Jump dust / shadow */}
              <div
                className="w-10 h-2 bg-black/30 rounded-full mx-auto -mt-1 transition-all"
                style={{
                  transform: `scale(${Math.max(0.3, 1 - dogY / 120)})`,
                  opacity: Math.max(0.2, 1 - dogY / 120),
                }}
              />
            </div>
          </div>

          {/* Obstacles Rendering */}
          {obstacles.map((obs) => (
            <div
              key={obs.id}
              className="absolute transition-all"
              style={{
                left: `${obs.x}%`,
                bottom: "64px",
              }}
            >
              {obs.type === "hurdle" && (
                <div className="flex flex-col items-center">
                  <div className="w-8 h-10 border-4 border-b-0 border-[#BC4749] rounded-t-md bg-[#F2E8CF] shadow-sm flex items-center justify-center text-xs font-bold text-[#BC4749]">
                    🚧
                  </div>
                </div>
              )}
              {obs.type === "hoop" && (
                <div className="w-12 h-16 rounded-full border-4 border-[#D4A373] bg-[#F2E8CF]/40 flex items-center justify-center text-xs font-bold text-[#386641] animate-pulse">
                  ⭕
                </div>
              )}
              {obs.type === "boneBonus" && !obs.passed && (
                <div className="text-3xl animate-bounce filter drop-shadow-lg -mb-2">
                  🦴
                </div>
              )}
            </div>
          ))}

          {/* Stats Overlay during play */}
          {isPlaying && (
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-[#386641] font-black drop-shadow">
              <div className="bg-[#F2E8CF]/90 border border-[#386641]/15 backdrop-blur px-3 py-1 rounded-full text-sm">
                Score: <span className="text-[#386641]">{score}</span>
              </div>
              {combo > 1 && (
                <div className="bg-[#A7C957] text-[#386641] font-black px-3 py-1 rounded-full text-xs animate-pulse shadow-xs">
                  Combo x{combo}!
                </div>
              )}
              <div className="bg-[#F2E8CF]/90 border border-[#386641]/15 backdrop-blur px-3 py-1 rounded-full text-sm">
                Distance: {Math.floor(distanceRan / 10)}m
              </div>
            </div>
          )}

          {/* Start Screen Prompt */}
          {!isPlaying && !gameOver && (
            <div className="absolute inset-0 bg-[#386641]/60 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
              <h3 className="text-2xl font-black text-[#F2E8CF] mb-2">Agility Park Run</h3>
              <p className="text-sm text-[#F2E8CF]/90 max-w-sm mb-5">
                Press <strong>Spacebar</strong> or tap <strong>JUMP</strong> to leap over hurdles and agility hoops!
              </p>
              <button
                onClick={startGame}
                className="px-6 py-3 bg-[#A7C957] hover:bg-[#97b949] text-[#386641] font-black rounded-xl shadow-lg flex items-center gap-2 text-base transition-transform active:scale-95 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Agility Run
              </button>
            </div>
          )}

          {/* Game Over Screen */}
          {gameOver && (
            <div className="absolute inset-0 bg-[#386641]/75 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
              <div className="text-4xl mb-2">🏁</div>
              <h3 className="text-xl font-black text-white mb-1">Great Run, {dogName}!</h3>
              <p className="text-2xl font-black text-[#A7C957] mb-1">{score} Points</p>
              <p className="text-xs text-[#F2E8CF]/90 mb-4">
                Earned +{Math.max(5, Math.floor(score / 35))} Treat Coins!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={startGame}
                  className="px-4 py-2 bg-[#A7C957] hover:bg-[#97b949] text-[#386641] font-black rounded-xl flex items-center gap-2 text-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-[#F2E8CF] hover:bg-white text-[#386641] font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Return to Park
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Mobile Controls */}
        <div className="p-4 bg-[#F2E8CF] border-t border-[#386641]/15 flex items-center justify-between">
          <div className="text-xs text-[#386641]/80 hidden sm:block font-medium">
            Controls: <strong>Spacebar</strong> or <strong>Up Arrow</strong> to Jump
          </div>
          {isPlaying && (
            <button
              onClick={handleJump}
              className="w-full sm:w-auto px-8 py-3 bg-[#386641] hover:bg-[#2c5234] active:bg-[#224028] text-[#F2E8CF] font-black rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              <ArrowUp className="w-5 h-5" />
              TAP TO JUMP
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
