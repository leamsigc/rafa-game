import React, { useState } from "react";
import { X, Shirt, Check, Sparkles, Eye } from "lucide-react";
import { HEAD_ACCESSORIES } from "../tabletop/tabletopData";
import { sound } from "../../utils/audio";

interface WardrobeModalProps {
  dogName: string;
  equippedAccessory?: string;
  ownedAccessories: string[];
  /** Live 3D preview — the real Happy dog (in the scene) dons the hat. */
  onPreview: (accessoryId: string | undefined) => void;
  /** Commit: save + wear it. */
  onConfirm: (accessoryId: string | undefined) => void;
  /** Step out of the closet without committing (reverts the preview). */
  onClose: () => void;
}

/**
 * Opened by pressing the bedroom closet: your view slides into the wardrobe
 * and the REAL 3D dog (Happy) stands on the left, lit against the blue closet
 * interior. Tap a hat on the right to see him try it on live, like in a normal
 * game, then wear it.
 */
export const WardrobeModal: React.FC<WardrobeModalProps> = ({
  dogName,
  equippedAccessory,
  ownedAccessories,
  onPreview,
  onConfirm,
  onClose,
}) => {
  const ownedHats = HEAD_ACCESSORIES.filter((h) => ownedAccessories.includes(h.id));
  const startsWithHat = equippedAccessory && HEAD_ACCESSORIES.some((h) => h.id === equippedAccessory);
  const [selected, setSelected] = useState<string | undefined>(
    startsWithHat ? equippedAccessory : "none"
  );

  const choose = (id: string) => {
    setSelected(id);
    onPreview(id === "none" ? undefined : id); // live preview on the 3D dog
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none animate-in fade-in duration-200">
      {/* soft blue "inside the closet" wash — center stays visible */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#1d4ed8]/55 via-transparent to-[#1d4ed8]/45" />
      {/* closet frame edges */}
      <div className="absolute inset-y-0 left-0 w-5 bg-[#1e293b]/80" />
      <div className="absolute inset-y-0 right-0 w-5 bg-[#1e293b]/80" />
      <div className="absolute top-0 inset-x-0 h-1.5 bg-[#94a3b8]" />

      <button
        onClick={onClose}
        className="absolute top-4 right-9 z-10 p-2 rounded-xl bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer pointer-events-auto"
        aria-label="Step out of the closet"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Title (left) */}
      <div className="absolute top-5 left-9 max-w-[46%]">
        <h2 className="text-white font-black text-lg flex items-center gap-2 drop-shadow">
          <Sparkles className="w-5 h-5" /> {dogName}'s Wardrobe
        </h2>
        <p className="text-white/75 text-xs font-bold mt-1 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Tap a hat — he tries it on live!
        </p>
      </div>

      {/* Hat rack (right) */}
      <div className="absolute top-1/2 -translate-y-1/2 right-9 w-52 pointer-events-auto">
        <div className="h-1 w-full bg-[#94a3b8] rounded-full mb-3" />
        {ownedHats.length === 0 && (
          <p className="text-white/90 text-xs font-bold bg-black/30 rounded-xl px-3 py-2 mb-2">
            No hats yet. Grab a Witch Hat on Halloween 🎃 or buy some in the Shop.
          </p>
        )}
        <div className="flex flex-col gap-2.5 max-h-[52vh] overflow-y-auto no-scrollbar pr-1">
          {ownedHats.map((hat) => {
            const active = selected === hat.id;
            return (
              <button
                key={hat.id}
                onClick={() => choose(hat.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                  active ? "bg-white border-[#fbbf24] shadow-lg scale-105" : "bg-white/20 border-white/25 hover:bg-white/35"
                }`}
              >
                <span className="text-3xl">{hat.icon}</span>
                <span className="font-black text-sm text-white">{hat.name}</span>
                {active && <Check className="w-4 h-4 text-[#f59e0b] ml-auto" />}
              </button>
            );
          })}
          {(ownedHats.length > 0) && (
            <button
              onClick={() => choose("none")}
              className={`flex items-center gap-3 px-3 py-2 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                selected === "none" ? "bg-white border-[#fbbf24] shadow-lg scale-105" : "bg-white/20 border-white/25 hover:bg-white/35"
              }`}
            >
              <span className="text-3xl">🚫</span>
              <span className="font-black text-sm text-white">No hat</span>
              {selected === "none" && <Check className="w-4 h-4 text-[#f59e0b] ml-auto" />}
            </button>
          )}
        </div>
        <button
          onClick={() => { sound.playRewardFanfare(); onConfirm(selected === "none" ? undefined : selected); }}
          className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#fbbf24] hover:bg-[#f59e0b] active:scale-95 text-[#3b2410] font-black text-sm shadow-xl transition-all cursor-pointer"
        >
          <Shirt className="w-4 h-4" /> Wear this look
        </button>
      </div>
    </div>
  );
};
