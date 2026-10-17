import React from "react";
import { X, Coins, Check, ShoppingBag } from "lucide-react";
import { sound } from "../../utils/audio";

interface ToolShopModalProps {
  coins: number;
  ownsAxe: boolean;
  onBuyAxe: (cost: number) => void;
  onClose: () => void;
}

const AXE_PRICE = 60;

/**
 * The city Tool Store counter menu. Walking into the 3D shop and pressing the
 * axe on the display board opens this "Do you want to buy an Axe?" card.
 */
export const ToolShopModal: React.FC<ToolShopModalProps> = ({
  coins,
  ownsAxe,
  onBuyAxe,
  onClose,
}) => {
  const canAfford = coins >= AXE_PRICE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden">
        <div className="bg-gradient-to-r from-stone-700 via-stone-600 to-amber-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-white/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black leading-tight">Tool Store</h2>
              <p className="text-[11px] text-amber-100 font-medium">
                Quality tools for adventurous dogs
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playButtonTap();
              onClose();
            }}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/25 transition"
            aria-label="Close Tool Store"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="text-5xl leading-none drop-shadow-sm">🪓</div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-stone-800">Lumberjack Axe</h3>
              <p className="text-xs text-stone-500 leading-relaxed mt-1">
                A sturdy steel axe with a wooden handle. Buy it and you can chop the
                woodpile on the chopping block for coins — every swing pays out!
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Price
            </span>
            <span className="flex items-center gap-1.5 font-black text-amber-600">
              <Coins className="w-4 h-4 fill-amber-500" /> {AXE_PRICE}
            </span>
          </div>

          <div className="mt-4">
            {ownsAxe ? (
              <div className="w-full py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> You already own the axe — go chop the woodpile!
              </div>
            ) : (
              <button
                disabled={!canAfford}
                onClick={() => {
                  sound.playRewardFanfare();
                  onBuyAxe(AXE_PRICE);
                }}
                className={`w-full py-3 rounded-2xl font-black text-sm transition flex items-center justify-center gap-2 ${
                  canAfford
                    ? "bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-white shadow-md"
                    : "bg-stone-100 text-stone-400 cursor-not-allowed"
                }`}
              >
                <Coins className="w-4 h-4 fill-current" />
                {canAfford ? `Buy the Axe for ${AXE_PRICE} Coins` : "Need More Coins"}
              </button>
            )}
          </div>
        </div>

        <div className="bg-stone-50 border-t border-stone-100 px-6 py-3 flex justify-end">
          <button
            onClick={() => {
              sound.playButtonTap();
              onClose();
            }}
            className="px-5 py-2 bg-stone-700 hover:bg-stone-800 text-white font-bold rounded-xl text-sm transition"
          >
            Leave the counter
          </button>
        </div>
      </div>
    </div>
  );
};
