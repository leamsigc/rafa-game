import React, { useMemo, useState } from "react";
import { X, Shovel, Sparkles, Trophy } from "lucide-react";
import { sound } from "../../utils/audio";
import { logDayEvent } from "../journal/dayJournal";

interface BackyardDiggerMiniGameProps {
  dogName: string;
  onClose: () => void;
  /**
   * @param coinsEarned total haul value
   * @param xpEarned XP from the excavation
   * @param energyUsed stamina spent digging
   * @param fossils number of rare dinosaur fossils excavated
   */
  onGameComplete: (coinsEarned: number, xpEarned: number, energyUsed: number, fossils: number) => void;
}

const GRID = 5;
const START_STAMINA = 12;

type TileContent = "empty" | "golden_bone" | "squeaky_toy" | "tennis_ball" | "dino_fossil" | "treasure_chest";

interface Tile {
  content: TileContent;
  dug: boolean;
  /** Adjacent treasure count (computed after seeding) — the scent radar. */
  clue: number;
}

const CONTENT_META: Record<TileContent, { icon: string; label: string; coins: number; xp: number; stamina: number }> = {
  empty: { icon: "", label: "Empty patch", coins: 0, xp: 1, stamina: 0 },
  golden_bone: { icon: "🦴", label: "Golden Bone", coins: 10, xp: 4, stamina: 0 },
  squeaky_toy: { icon: "🧸", label: "Squeaky Toy", coins: 8, xp: 3, stamina: 0 },
  tennis_ball: { icon: "🎾", label: "Tennis Ball (+2 stamina!)", coins: 5, xp: 3, stamina: 2 },
  dino_fossil: { icon: "🦕", label: "ANCIENT DINO FOSSIL!", coins: 30, xp: 10, stamina: 0 },
  treasure_chest: { icon: "🎁", label: "Treasure Chest!", coins: 25, xp: 8, stamina: 0 },
};

function seedBoard(): Tile[] {
  const tiles: Tile[] = Array.from({ length: GRID * GRID }, () => ({ content: "empty" as TileContent, dug: false, clue: 0 }));
  const treasureSpots = [3, 2, 3, 1, 1]; // bones, toys, balls, fossil, chest
  const pool: TileContent[] = [];
  treasureSpots.forEach((n, i) => {
    const kind = (["golden_bone", "squeaky_toy", "tennis_ball", "dino_fossil", "treasure_chest"] as TileContent[])[i];
    for (let k = 0; k < n; k++) pool.push(kind);
  });
  // Shuffle & place 10 treasures
  const indexes = Array.from({ length: GRID * GRID }, (_, i) => i).sort(() => Math.random() - 0.5);
  pool.forEach((kind, i) => {
    tiles[indexes[i]].content = kind;
  });
  // Scent radar: empty tiles reveal neighboring treasure counts
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].content !== "empty") continue;
    const x = i % GRID;
    const y = Math.floor(i / GRID);
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        if (tiles[ny * GRID + nx].content !== "empty") n++;
      }
    }
    tiles[i].clue = n;
  }
  return tiles;
}

/**
 * Backyard Digger — Buried Treasure & Fossil Hunt: a 5x5 garden excavation
 * with tactile dirt-flying animations, scent clue indicators (👃), and a
 * shovel stamina meter (tennis balls restore it). Rewards pay out into
 * coins, XP and happiness. Accessible from the Park Mini-Games menu.
 */
export const BackyardDiggerMiniGame: React.FC<BackyardDiggerMiniGameProps> = ({
  dogName,
  onClose,
  onGameComplete,
}) => {
  const [tiles, setTiles] = useState<Tile[]>(() => seedBoard());
  const [stamina, setStamina] = useState(START_STAMINA);
  const [coins, setCoins] = useState(0);
  const [xp, setXp] = useState(0);
  const [fossils, setFossils] = useState(0);
  const [found, setFound] = useState(0);
  const [flyingDirt, setFlyingDirt] = useState<{ id: number; x: number; y: number }[]>([]);
  const [done, setDone] = useState(false);

  const totalTreasures = useMemo(() => tiles.filter((t) => t.content !== "empty").length, [tiles]);
  const dirtId = React.useRef(0);

  const spawnDirt = (index: number) => {
    const x = (index % GRID) * 20 + 10;
    const y = Math.floor(index / GRID) * 20 + 10;
    const puffs = Array.from({ length: 5 }, () => ({
      id: dirtId.current++,
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
    }));
    setFlyingDirt((prev) => [...prev, ...puffs]);
    window.setTimeout(() => {
      setFlyingDirt((prev) => prev.filter((p) => !puffs.some((q) => q.id === p.id)));
    }, 700);
  };

  const dig = (index: number) => {
    if (done || tiles[index].dug || stamina <= 0) return;
    const tile = tiles[index];
    const meta = CONTENT_META[tile.content];
    sound.playChop();
    spawnDirt(index);

    const nextStamina = Math.max(0, stamina - 1 + meta.stamina);
    const nextTiles = tiles.map((t, i) => (i === index ? { ...t, dug: true } : { ...t, clue: t.content === "empty" ? recomputeClue(tiles, i, index) : t.clue }));
    setTiles(nextTiles);
    setStamina(nextStamina);
    setCoins((c) => c + meta.coins);
    setXp((x) => x + meta.xp);

    if (tile.content === "dino_fossil") {
      setFossils((f) => f + 1);
      logDayEvent("digs", "Excavated a rare ancient dinosaur fossil 🦕");
      sound.playRewardFanfare();
    } else if (tile.content !== "empty") {
      setFound((f) => f + 1);
      if (tile.content === "tennis_ball") sound.playSqueak();
    }

    // End of the dig: stamina out or garden cleared
    const cleared = nextTiles.every((t) => t.dug);
    if (nextStamina <= 0 || cleared) {
      finish(cleared);
    }
  };

  /** After digging one tile, neighbors' scent clues shrink accordingly. */
  const recomputeClue = (current: Tile[], forIndex: number, justDug: number): number => {
    const t = current[forIndex];
    if (t.content !== "empty" || t.dug) return t.clue;
    const x = forIndex % GRID;
    const y = Math.floor(forIndex / GRID);
    const jx = justDug % GRID;
    const jy = Math.floor(justDug / GRID);
    // only neighbors of the dug tile change
    if (Math.abs(x - jx) <= 1 && Math.abs(y - jy) <= 1) {
      return Math.max(0, t.clue - (current[justDug].content !== "empty" ? 1 : 0));
    }
    return t.clue;
  };

  const finish = (cleared: boolean) => {
    setDone(true);
    logDayEvent("miniGames", `Backyard dig: +${coins} coins${cleared ? " — cleared the whole garden!" : ""}`);
    if (cleared || coins >= 40) logDayEvent("wins", "Backyard Digger haul!");
    onGameComplete(coins, xp, START_STAMINA - Math.max(0, stamina), fossils);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#386641]/20 bg-[#6b4423] text-[#F2E8CF]">
          <div>
            <h3 className="text-base font-black text-white">⛏️ Backyard Digger</h3>
            <p className="text-[11px] text-amber-200/90 font-medium">Send {dogName} digging for buried treasure!</p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-black bg-white/15 rounded-full px-2.5 py-1 flex items-center gap-1">
              <Shovel className="w-3.5 h-3.5" /> {stamina}
            </span>
            <span className="text-xs font-black bg-[#A7C957] text-[#386641] rounded-full px-2.5 py-1">🪙 {coins}</span>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/15 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-[11px] font-bold text-[#386641]/70 text-center">
            Dig up golden bones 🦴, squeaky toys 🧸, fossils 🦕 & chests 🎁 — tennis balls 🎾 restore shovel stamina! Empty patches sniff out 👃 neighboring treasure.
          </p>

          {/* 5x5 garden plot */}
          <div className="relative mx-auto grid grid-cols-5 gap-1.5 max-w-[92%]">
            {tiles.map((t, i) => {
              const meta = CONTENT_META[t.content];
              return (
                <button
                  key={i}
                  onClick={() => dig(i)}
                  disabled={t.dug || done || stamina <= 0}
                  className={`aspect-square rounded-xl border transition-all cursor-pointer flex items-center justify-center text-xl sm:text-2xl shadow-xs ${
                    t.dug
                      ? "bg-[#8a6844]/40 border-[#6b4423]/30"
                      : "bg-gradient-to-b from-[#a1785a] to-[#8a5f3c] border-[#6b4423]/50 hover:from-[#b38a68] active:scale-90"
                  }`}
                >
                  {t.dug ? (
                    t.content === "empty" ? (
                      <span className={`text-[13px] font-black ${t.clue > 0 ? "text-amber-900" : "text-stone-500/60"}`}>
                        {t.clue > 0 ? `👃${t.clue}` : "·"}
                      </span>
                    ) : (
                      <span className="animate-in zoom-in duration-200">{meta.icon}</span>
                    )
                  ) : (
                    <span className="opacity-60 text-sm">🌱</span>
                  )}
                </button>
              );
            })}

            {/* Tactile dirt-flying particles */}
            {flyingDirt.map((p) => (
              <span
                key={p.id}
                className="absolute text-sm pointer-events-none z-10"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  animation: "dirtFly 0.65s ease-out forwards",
                }}
              >
                🟤
              </span>
            ))}
          </div>

          {/* Status line */}
          <div className="flex items-center justify-between text-[11px] font-bold text-[#386641]/75 px-1">
            <span>Treasures found: {found}/{totalTreasures}</span>
            <span>+{xp} XP banked{fossils > 0 ? ` • 🦕 fossils: ${fossils}` : ""}</span>
          </div>

          {/* Results card */}
          {done && (
            <div className="bg-white rounded-2xl border border-[#386641]/15 p-4 text-center space-y-2 shadow-sm">
              <Trophy className="w-8 h-8 mx-auto text-amber-500" />
              <h4 className="text-sm font-black">Complete haul! 🏺</h4>
              <p className="text-xs font-bold text-[#386641]/75">
                +{coins} coins • +{xp} XP • {fossils > 0 ? `${fossils} dino fossil${fossils > 1 ? "s" : ""} 🦕 • ` : ""}
                +{Math.min(25, 5 + found * 2)} happiness for {dogName}
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-xs shadow cursor-pointer active:scale-95 transition-transform inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" /> Collect the Haul
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes dirtFly {
            0% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
            100% { transform: translate(-14px, -42px) scale(0.4) rotate(160deg); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
};
