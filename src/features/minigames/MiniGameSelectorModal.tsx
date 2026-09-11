import React from "react";
import { X, Play, Trophy, Sparkles } from "lucide-react";
import { MiniGameType } from "../../types/pet";

interface MiniGameSelectorModalProps {
  dogName: string;
  onSelectGame: (game: MiniGameType) => void;
  onClose: () => void;
}

export const MiniGameSelectorModal: React.FC<MiniGameSelectorModalProps> = ({
  dogName,
  onSelectGame,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#A7C957] flex items-center justify-center text-[#386641] font-bold text-lg shadow-xs">
              🎮
            </div>
            <div>
              <h3 className="text-base font-black text-white">Park Mini-Games</h3>
              <p className="text-xs text-[#F2E8CF]/80">Play together with {dogName} to earn coins & boosts!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Games List */}
        <div className="p-5 space-y-3.5">
          {/* 1. Agility Park Dash */}
          <div className="p-4 rounded-2xl bg-white/85 hover:bg-white border border-[#386641]/15 flex items-center justify-between gap-4 transition-all shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#F2E8CF] border border-[#386641]/15 flex items-center justify-center text-2xl shrink-0">
                🏃‍♂️
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#386641]">Agility Park Dash</h4>
                <p className="text-xs text-[#386641]/75 mt-0.5">
                  Leap over hurdles and hoops in an obstacle course!
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6A994E] mt-1">
                  <Trophy className="w-3 h-3 text-[#D4A373]" /> Win up to 100+ Treat Coins
                </span>
              </div>
            </div>
            <button
              onClick={() => onSelectGame("agility")}
              className="px-4 py-2 bg-[#386641] hover:bg-[#2c5234] active:bg-[#224028] text-[#F2E8CF] font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 shadow transition-transform active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Play
            </button>
          </div>

          {/* 2. Treat Catch Frenzy */}
          <div className="p-4 rounded-2xl bg-white/85 hover:bg-white border border-[#386641]/15 flex items-center justify-between gap-4 transition-all shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#F2E8CF] border border-[#386641]/15 flex items-center justify-center text-2xl shrink-0">
                🍖
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#386641]">Treat Catch Frenzy</h4>
                <p className="text-xs text-[#386641]/75 mt-0.5">
                  Steer {dogName} to catch delicious flying snacks!
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#BC4749] mt-1">
                  <Sparkles className="w-3 h-3 text-[#BC4749]" /> Restores energy + rewards
                </span>
              </div>
            </div>
            <button
              onClick={() => onSelectGame("treatCatch")}
              className="px-4 py-2 bg-[#6A994E] hover:bg-[#5b8543] active:bg-[#4d7039] text-[#F2E8CF] font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 shadow transition-transform active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Play
            </button>
          </div>

          {/* 3. 3D Fetch Ball */}
          <div className="p-4 rounded-2xl bg-white/85 hover:bg-white border border-[#386641]/15 flex items-center justify-between gap-4 transition-all shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#F2E8CF] border border-[#386641]/15 flex items-center justify-center text-2xl shrink-0">
                🎾
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#386641]">3D Tennis Ball Fetch</h4>
                <p className="text-xs text-[#386641]/75 mt-0.5">
                  Throw the ball anywhere in the 3D park for {dogName} to retrieve!
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#386641] mt-1">
                  🎾 Realistic physics & AI tracking
                </span>
              </div>
            </div>
            <button
              onClick={() => onSelectGame("fetch")}
              className="px-4 py-2 bg-[#A7C957] hover:bg-[#97b949] active:bg-[#86a63d] text-[#386641] font-black text-xs rounded-xl flex items-center gap-1.5 shrink-0 shadow transition-transform active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Throw
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F2E8CF] border-t border-[#386641]/15 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs text-[#386641] hover:text-[#2c5234] font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
