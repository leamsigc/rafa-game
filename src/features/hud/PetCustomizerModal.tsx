import React from "react";
import { X, Check, Palette } from "lucide-react";
import { DogBreed } from "../../types/pet";

interface PetCustomizerModalProps {
  currentBreed: DogBreed;
  currentCollar: string;
  dogName: string;
  onUpdateBreed: (breed: DogBreed) => void;
  onUpdateCollar: (collar: string) => void;
  onUpdateName: (name: string) => void;
  onClose: () => void;
}

const BREEDS: { id: DogBreed; name: string; icon: string; desc: string }[] = [
  { id: "golden", name: "Golden Retriever", icon: "🦮", desc: "Friendly, gentle golden coat" },
  { id: "chocolate", name: "Chocolate Lab", icon: "🐕", desc: "Rich dark cocoa brown coat" },
  { id: "husky", name: "Siberian Husky", icon: "🐺", desc: "Silver slate coat with snowy markings" },
  { id: "dalmatian", name: "Dalmatian", icon: "🐾", desc: "Classic white coat with playful black spots" },
  { id: "corgi", name: "Pembroke Corgi", icon: "🦊", desc: "Vibrant fox-copper and cream coat" },
];

const COLLAR_COLORS = [
  { name: "Ruby Red", hex: "#e11d48" },
  { name: "Sapphire Blue", hex: "#0284c7" },
  { name: "Emerald Green", hex: "#16a34a" },
  { name: "Sunburst Gold", hex: "#d97706" },
  { name: "Amethyst Purple", hex: "#9333ea" },
  { name: "Midnight Black", hex: "#1e293b" },
];

export const PetCustomizerModal: React.FC<PetCustomizerModalProps> = ({
  currentBreed,
  currentCollar,
  dogName,
  onUpdateBreed,
  onUpdateCollar,
  onUpdateName,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-[#A7C957]" />
            <h3 className="text-base font-black text-white">Pet Styling & Breed</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Pet Name Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#386641] mb-1.5">
              Companion Name
            </label>
            <input
              type="text"
              value={dogName}
              onChange={(e) => onUpdateName(e.target.value)}
              maxLength={20}
              className="w-full bg-white border border-[#386641]/25 rounded-xl px-4 py-2.5 text-sm text-[#386641] font-bold focus:outline-none focus:border-[#386641] focus:ring-1 focus:ring-[#386641] transition-colors"
            />
          </div>

          {/* Breed Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#386641] mb-2">
              Select Breed & Fur Coat
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {BREEDS.map((breed) => {
                const isSelected = currentBreed === breed.id;
                return (
                  <button
                    key={breed.id}
                    onClick={() => onUpdateBreed(breed.id)}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-left transition-all ${
                      isSelected
                        ? "bg-white border-2 border-[#386641] text-[#386641] shadow-sm"
                        : "bg-white/80 hover:bg-white border border-[#386641]/15 text-[#386641]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{breed.icon}</span>
                      <div>
                        <div className="text-sm font-black text-[#386641] leading-tight">
                          {breed.name}
                        </div>
                        <div className="text-xs text-[#386641]/70">{breed.desc}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#386641]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Collar Colors */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#386641] mb-2">
              Collar Color
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {COLLAR_COLORS.map((color) => {
                const isSelected = currentCollar.toLowerCase() === color.hex.toLowerCase();
                return (
                  <button
                    key={color.hex}
                    onClick={() => onUpdateCollar(color.hex)}
                    title={color.name}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${
                      isSelected ? "ring-3 ring-[#386641] ring-offset-2 ring-offset-[#F2E8CF]" : ""
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F2E8CF] border-t border-[#386641]/15 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#386641] hover:bg-[#2c5234] active:bg-[#224028] text-[#F2E8CF] font-bold rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
