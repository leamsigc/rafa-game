import React from "react";
import { X, Coins, ShoppingBag } from "lucide-react";

export type CafeItemId = "tea" | "coffee" | "cake";

export interface CafeItemDef {
  id: CafeItemId;
  name: string;
  emoji: string;
  price: number;
  /** How much hunger it removes (0-100). */
  hunger: number;
  blurb: string;
  accent: string;
}

export const CAFE_ITEMS: CafeItemDef[] = [
  {
    id: "tea",
    name: "Cup of Tea",
    emoji: "🫖",
    price: 25,
    hunger: 25,
    blurb: "Warm chamomile with a honey biscuit on the saucer.",
    accent: "#0f766e",
  },
  {
    id: "coffee",
    name: "Cup of Coffee",
    emoji: "☕",
    price: 25,
    hunger: 25,
    blurb: "A creamy pupuccino with a little cocoa paw on top.",
    accent: "#7c2d12",
  },
  {
    id: "cake",
    name: "Slice of Cake",
    emoji: "🍰",
    price: 50,
    hunger: 100,
    blurb: "A giant slice that fills Happy right up. Worth every coin.",
    accent: "#be185d",
  },
];

interface CafeMenuModalProps {
  coins: number;
  place: "patio" | "inside";
  onOrder: (item: CafeItemDef) => void;
  onClose: () => void;
}

/**
 * The café menu — a 3D-styled bottom sheet that slides up when Happy sits
 * down. Three oversized, chunky "toy" cards (tea / coffee / cake) with real
 * depth, shadows and a wooden counter lip so it feels like an in-world menu.
 */
export const CafeMenuModal: React.FC<CafeMenuModalProps> = ({
  coins,
  place,
  onOrder,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/45 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl rounded-t-3xl sm:rounded-3xl border-2 border-[#5c3a1e] shadow-2xl overflow-hidden text-[#3f2a17] animate-in slide-in-from-bottom-6 duration-300"
        style={{
          background:
            "linear-gradient(180deg, #fdf3e3 0%, #f7e6c9 60%, #e7c89a 100%)",
        }}
      >
        {/* Wooden header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#7c2d12] text-[#fde68a] border-b-4 border-[#5c3a1e]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl drop-shadow">☕</span>
            <div>
              <h3 className="text-base font-black tracking-wide">HAPPY CAFE — MENU</h3>
              <p className="text-[11px] text-[#fcd9a4]/90 font-medium">
                {place === "patio"
                  ? "Ordering from the sunny patio 🌿"
                  : "Ordering at the counter inside 🐾"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-black bg-[#fde68a] text-[#7c2d12] px-2.5 py-1 rounded-full border border-[#f59e0b] shadow-sm">
              <Coins className="w-3.5 h-3.5" /> {coins}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CAFE_ITEMS.map((item) => {
              const affordable = coins >= item.price;
              return (
                <button
                  key={item.id}
                  onClick={() => affordable && onOrder(item)}
                  disabled={!affordable}
                  className={`group relative text-left rounded-2xl p-4 border-2 transition-all cursor-pointer ${
                    affordable
                      ? "bg-white/85 border-[#c9a173] hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
                      : "bg-white/40 border-[#c9a173]/50 opacity-60 cursor-not-allowed"
                  }`}
                  style={{
                    boxShadow: affordable
                      ? "0 8px 0 -2px rgba(92,58,30,0.25), 0 14px 22px rgba(92,58,30,0.18)"
                      : "none",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-4xl drop-shadow-sm">{item.emoji}</span>
                    <span
                      className="text-[11px] font-black px-2 py-1 rounded-full text-white shadow"
                      style={{ backgroundColor: item.accent }}
                    >
                      {item.price} c
                    </span>
                  </div>
                  <h4 className="mt-2 text-sm font-black">{item.name}</h4>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#5c3a1e]/80">
                    {item.blurb}
                  </p>
                  <p className="mt-2 text-[10px] font-bold text-[#6A994E]">
                    −{item.hunger}% hunger
                  </p>
                  <span className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#7c2d12] group-hover:bg-[#5c3a1e] text-[#fde68a] text-xs font-black transition-colors">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {affordable ? "Order" : "Not enough coins"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[10px] font-medium text-[#5c3a1e]/60">
            Tea &amp; coffee: 25 coins · cake: 50 coins · cake fills the whole bowl
          </p>
        </div>
      </div>
    </div>
  );
};
