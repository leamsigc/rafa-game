import React from "react";
import { X, Plus, Coins, Zap, Heart } from "lucide-react";
import { AVAILABLE_TREATS } from "./treatsData";
import { TreatItem } from "../../types/pet";
import treatsImage from "../../assets/images/treats_plate_1788547316465.jpg";

interface TreatsTrayProps {
  dogName: string;
  inventory: Record<string, number>;
  coins: number;
  energy: number;
  onFeed: (treat: TreatItem) => void;
  onBuy: (treat: TreatItem) => void;
  onClose: () => void;
}

export const TreatsTray: React.FC<TreatsTrayProps> = ({
  dogName,
  inventory,
  coins,
  energy,
  onFeed,
  onBuy,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#F2E8CF] border border-[#386641]/20 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[90vh]">
        {/* Header with treats image banner */}
        <div className="relative h-28 w-full overflow-hidden bg-[#F2E8CF]">
          <img
            src={treatsImage}
            alt="Gourmet Treats"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-60 filter brightness-95"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F2E8CF] via-[#F2E8CF]/65 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-[#386641]/80 hover:bg-[#386641] text-[#F2E8CF] backdrop-blur transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Title & Coins Bar */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#6A994E]">
                Canine Pantry
              </span>
              <h2 className="text-xl font-black text-[#386641] leading-tight">
                Feed Treats to {dogName}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#A7C957]/40 border border-[#6A994E]/40 rounded-full text-[#386641] font-black text-sm backdrop-blur">
              <Coins className="w-4 h-4 text-[#D4A373]" />
              <span>{coins} Coins</span>
            </div>
          </div>
        </div>

        {/* Current Energy Status */}
        <div className="px-5 py-3 bg-[#F2E8CF]/80 border-b border-[#386641]/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#6A994E]" />
            <span className="text-xs text-[#386641] font-bold">Current Energy Level:</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-[#386641]/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#A7C957] transition-all duration-300"
                style={{ width: `${Math.min(100, energy)}%` }}
              />
            </div>
            <span className="text-xs font-extrabold text-[#386641]">{energy}%</span>
          </div>
        </div>

        {/* Treats Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3">
          {AVAILABLE_TREATS.map((treat) => {
            const count = inventory[treat.id] || 0;
            const canAfford = coins >= treat.cost;

            return (
              <div
                key={treat.id}
                className="p-3.5 rounded-2xl bg-white/85 hover:bg-white border border-[#386641]/15 shadow-sm flex items-center gap-4 transition-colors"
              >
                {/* Treat Icon */}
                <div className="w-14 h-14 rounded-2xl bg-[#F2E8CF] border border-[#386641]/15 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                  {treat.icon}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#386641] truncate">{treat.name}</h4>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#A7C957]/30 text-[#386641] border border-[#6A994E]/25">
                      x{count}
                    </span>
                  </div>
                  <p className="text-xs text-[#386641]/80 line-clamp-1 mt-0.5">
                    {treat.description}
                  </p>

                  {/* Stat badges */}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-bold text-[#6A994E] flex items-center gap-1">
                      <Zap className="w-3 h-3" /> +{treat.energyBoost}% Energy
                    </span>
                    <span className="text-xs font-bold text-[#BC4749] flex items-center gap-1">
                      <Heart className="w-3 h-3" /> +{treat.happinessBoost}% Joy
                    </span>
                  </div>
                </div>

                {/* Actions: Feed or Buy */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                  {count > 0 ? (
                    <button
                      onClick={() => onFeed(treat)}
                      className="px-4 py-2 bg-[#386641] hover:bg-[#2c5234] active:bg-[#224028] text-[#F2E8CF] font-bold text-xs rounded-xl shadow-md transition-transform active:scale-95"
                    >
                      Feed Now
                    </button>
                  ) : (
                    <button
                      onClick={() => onBuy(treat)}
                      disabled={!canAfford}
                      className={`px-3.5 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 ${
                        canAfford
                          ? "bg-[#A7C957] hover:bg-[#97b949] active:bg-[#86a63d] text-[#386641] shadow-md cursor-pointer"
                          : "bg-[#386641]/10 text-[#386641]/40 cursor-not-allowed border border-[#386641]/10"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Buy {treat.cost}c
                    </button>
                  )}

                  {count > 0 && (
                    <button
                      onClick={() => onBuy(treat)}
                      disabled={!canAfford}
                      title={`Buy 1 more for ${treat.cost} coins`}
                      className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                        canAfford
                          ? "border-[#386641]/20 hover:bg-[#F2E8CF] text-[#386641]"
                          : "border-[#386641]/10 text-[#386641]/30 cursor-not-allowed"
                      }`}
                    >
                      +{treat.cost}c
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#F2E8CF] border-t border-[#386641]/15 flex items-center justify-between text-xs text-[#386641]/80">
          <span>Earn coins playing Fetch and Agility mini-games!</span>
          <button
            onClick={onClose}
            className="text-[#386641] hover:text-[#2c5234] font-bold hover:underline"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
