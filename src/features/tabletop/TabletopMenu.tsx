import React from "react";
import { X, Dices, Package, ArrowRight } from "lucide-react";
import { TABLETOP_GAMES, TABLETOP_PACKAGES, TabletopGameId } from "./tabletopData";
import { sound } from "../../utils/audio";

interface TabletopMenuProps {
  dogName: string;
  onSelect: (game: TabletopGameId) => void;
  onClose: () => void;
}

/**
 * The menu that pops up when you tap the tabletop table in the overworld.
 * The three free games are listed first (stacked), then — at the end — the
 * physical packages, shaped exactly like the boxes on the table: chess
 * (rectangle), tic-tac-toe (little square) and four-wins (long rectangle).
 */
export const TabletopMenu: React.FC<TabletopMenuProps> = ({ dogName, onSelect, onClose }) => {
  const pick = (id: TabletopGameId) => {
    sound.playButtonTap();
    onSelect(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-[#F2E8CF] border-2 border-[#a16207]/30 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#7c2d12] text-[#F2E8CF]">
          <div className="flex items-center gap-2.5">
            <Dices className="w-5 h-5 text-[#fbbf24]" />
            <div>
              <h3 className="text-base font-black leading-none">Tabletop Games</h3>
              <p className="text-[11px] text-[#fed7aa] font-bold mt-0.5">
                Play with {dogName} across the table
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-black/20 hover:bg-black/30 text-[#F2E8CF] transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Section 1 — the three games, stacked over each other */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#7c2d12] mb-2">
              Free Games
            </h4>
            <div className="space-y-2.5">
              {TABLETOP_GAMES.map((game) => (
                <button
                  key={game.id}
                  onClick={() => pick(game.id)}
                  className="group w-full flex items-center gap-3.5 text-left px-3.5 py-3 rounded-2xl bg-white border border-[#7c2d12]/15 hover:border-[#a16207] hover:bg-[#fffbeb] active:scale-[0.98] shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <span className="text-3xl leading-none shrink-0 group-hover:scale-110 transition-transform">
                    {game.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-black text-sm text-[#386641] leading-tight">
                      {game.name}
                    </span>
                    <span className="block text-[11px] text-[#386641]/70 leading-tight mt-0.5">
                      {game.blurb}
                    </span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#a16207] shrink-0 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-[#7c2d12]/15" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#7c2d12]/60">
              on the table
            </span>
            <div className="h-px flex-1 bg-[#7c2d12]/15" />
          </div>

          {/* Section 2 — the physical packages, at the end of the games */}
          <section>
            <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#7c2d12] mb-3">
              <Package className="w-3.5 h-3.5" /> Game Packages
            </h4>
            <div className="flex items-end justify-center gap-4">
              {TABLETOP_PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => pick(pkg.id)}
                  className="group flex flex-col items-center gap-1.5 cursor-pointer"
                  title={pkg.hint}
                >
                  <span
                    className="relative block rounded-md shadow-md border-2 border-black/10 group-hover:scale-110 group-active:scale-95 transition-transform"
                    style={{
                      width: `${Math.min(96, pkg.aspect * 52)}px`,
                      height: `${Math.min(96, 52)}px`,
                      background: `linear-gradient(145deg, ${pkg.color}, ${pkg.trim}22)`,
                    }}
                  >
                    <span
                      className="absolute inset-1.5 rounded-sm border border-dashed"
                      style={{ borderColor: `${pkg.trim}66` }}
                    />
                    <span
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg"
                      style={{ color: pkg.trim }}
                    >
                      {pkg.id === "chess" ? "♟" : pkg.id === "tictactoe" ? "❌" : "🔴"}
                    </span>
                  </span>
                  <span className="text-[11px] font-black text-[#386641] group-hover:text-[#7c2d12]">
                    {pkg.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
