import React from "react";
import { X, ShoppingCart, Cake, Home, Plane } from "lucide-react";

export type CarDestination = "supermarket" | "cakestore" | "airport";

interface CarSatNavModalProps {
  /** Chosen stop: the Supermarket lot or the lot behind the Cake Store. */
  onPick: (dest: CarDestination) => void;
  /** Close the sat-nav and stay parked at home. */
  onCancel: () => void;
}

/**
 * The car's dashboard sat-nav. It pops up right after Happy walks over to the
 * car: the driver's seat with the steering wheel, and on the right the sat-nav
 * screen with the two stops — 🛒 Supermarket or 🎂 Cake Store.
 */
export const CarSatNavModal: React.FC<CarSatNavModalProps> = ({ onPick, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-500/30 bg-[#1e293b] text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#0f172a] border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚗</span>
            <div>
              <h2 className="font-black text-sm sm:text-base leading-tight">Happy&apos;s Car — Sat Nav</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold">
                The engine is purring… where are we driving?
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
            aria-label="Close sat nav"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dashboard: driver's seat + sat-nav screen */}
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 p-4 sm:p-5 bg-gradient-to-b from-[#334155] to-[#1e293b]">
          {/* Steering wheel */}
          <div className="hidden sm:flex items-center justify-center">
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 rounded-full border-[12px] border-[#0f172a] shadow-[inset_0_2px_10px_rgba(0,0,0,0.6),0_2px_10px_rgba(0,0,0,0.5)]" />
              <div className="absolute inset-[26px] rounded-full border border-slate-600/60" />
              {/* Spokes */}
              <div className="absolute left-1/2 top-[46px] bottom-1/2 w-3 -translate-x-1/2 bg-[#0f172a] rounded-b" />
              <div className="absolute top-1/2 left-[46px] right-1/2 h-3 -translate-y-1/2 bg-[#0f172a] rounded-r" />
              <div className="absolute top-1/2 left-1/2 right-[46px] h-3 -translate-y-1/2 bg-[#0f172a] rounded-l" />
              {/* Hub */}
              <div className="absolute left-1/2 top-1/2 w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0f172a] border border-slate-600/50 flex items-center justify-center text-base">
                🐾
              </div>
              <p className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 whitespace-nowrap">
                driver&apos;s seat
              </p>
            </div>
          </div>

          {/* Sat-nav screen */}
          <div className="rounded-2xl bg-[#0c1a2e] border border-sky-500/40 shadow-[0_0_30px_rgba(56,189,248,0.15)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-sky-900/60 border-b border-sky-500/20">
              <span className="text-[11px] font-black tracking-widest text-sky-300 uppercase">Sat Nav</span>
              <span className="text-[10px] font-bold text-sky-200/70">📍 this is your house</span>
            </div>
            {/* Little route strip */}
            <div className="relative h-10 mx-4 mt-3 rounded-xl bg-sky-950/70 border border-sky-500/15 flex items-center px-3 gap-2 overflow-hidden">
              <Home className="w-4 h-4 text-emerald-300 shrink-0" />
              <div className="flex-1 border-t-2 border-dashed border-sky-400/60" />
              <span className="text-sm">🎯</span>
            </div>
            <p className="px-4 pt-3 pb-1 text-[11px] font-black uppercase tracking-wide text-sky-300">
              Where to?
            </p>
            {/* Stops */}
            <div className="p-3 pt-1.5 space-y-2">
              <button
                onClick={() => onPick("supermarket")}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-400/60 transition-all cursor-pointer active:scale-[0.99] text-left"
              >
                <span className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5 text-emerald-300" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-black text-sm text-emerald-100">Supermarket</span>
                  <span className="block text-[11px] text-slate-400 font-bold">
                    Park in the hedge lot by the big market
                  </span>
                </span>
              </button>
              <button
                onClick={() => onPick("cakestore")}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-pink-500/15 border border-white/10 hover:border-pink-400/60 transition-all cursor-pointer active:scale-[0.99] text-left"
              >
                <span className="w-11 h-11 rounded-xl bg-pink-500/20 border border-pink-400/30 flex items-center justify-center shrink-0">
                  <Cake className="w-5 h-5 text-pink-300" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-black text-sm text-pink-100">Cake Store</span>
                  <span className="block text-[11px] text-slate-400 font-bold">
                    Drive around the pink shop &amp; park right behind it
                  </span>
                </span>
              </button>
              <button
                onClick={() => onPick("airport")}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/60 transition-all cursor-pointer active:scale-[0.99] text-left"
              >
                <span className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0">
                  <Plane className="w-5 h-5 text-sky-300" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-black text-sm text-sky-100">Airport</span>
                  <span className="block text-[11px] text-slate-400 font-bold">
                    West past the fountain &amp; park under the big roof
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0f172a] border-t border-white/10 flex items-center justify-between gap-3">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500">
            Tip: you can drive back home any time — just tap the car in the city 🐾
          </p>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-black text-[11px] sm:text-xs text-slate-300 cursor-pointer transition-colors shrink-0"
          >
            Stay parked
          </button>
        </div>
      </div>
    </div>
  );
};
