import React, { useState } from "react";
import {
  ShoppingBag,
  Palette,
  Sparkles,
  Check,
  X,
  Crown,
  Glasses,
  Bell,
  Layers,
  Coins,
  Smile,
} from "lucide-react";
import { PetStats, BedColors } from "../../types/pet";
import { sound } from "../../utils/audio";

interface HouseShopModalProps {
  stats: PetStats;
  onClose: () => void;
  onUpdateBedColors: (colors: BedColors) => void;
  onBuyAccessory: (accessoryId: string, cost: number) => void;
  onEquipAccessory: (accessoryId: string | undefined) => void;
  onBuyToy: (toy: "bone" | "duck" | "bear" | "ball", cost: number) => void;
  onBuyTool?: (toolId: string, cost: number) => void;
}

interface AccessoryItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
}

const ACCESSORIES_CATALOG: AccessoryItem[] = [
  {
    id: "bowtie",
    name: "Crimson Bowtie",
    description: "A charming red satin bowtie for formal trot walks.",
    price: 35,
    icon: "🎀",
  },
  {
    id: "sunglasses",
    name: "Cool Shades",
    description: "Classic tinted UV sunglasses. 100% pure canine swagger.",
    price: 45,
    icon: "🕶️",
  },
  {
    id: "scarf",
    name: "Cozy Winter Scarf",
    description: "A warm knit crimson scarf for breezy afternoon outings.",
    price: 40,
    icon: "🧣",
  },
  {
    id: "bell",
    name: "Golden Jingle Bell",
    description: "A polished brass bell that chimes gently on every step.",
    price: 25,
    icon: "🔔",
  },
  {
    id: "tophat",
    name: "Aristocrat Top Hat",
    description: "A dapper black silk hat with a crimson ribbon.",
    price: 65,
    icon: "🎩",
  },
  {
    id: "crown",
    name: "Royal Golden Crown",
    description: "A sparkling imperial crown studded with rubies.",
    price: 100,
    icon: "👑",
  },
];

const TOYS_CATALOG = [
  {
    id: "bone",
    name: "Squeaky Chew Bone",
    description: "A flexible crimson chew toy that squeaks happily.",
    price: 0,
    icon: "🦴",
  },
  {
    id: "duck",
    name: "Quacky Rubber Duck",
    description: "A cheerful yellow floating friend for cozy play sessions.",
    price: 30,
    icon: "🦆",
  },
  {
    id: "bear",
    name: "Snuggle Teddy Bear",
    description: "A soft plush brown companion to curl up beside.",
    price: 45,
    icon: "🧸",
  },
  {
    id: "ball",
    name: "Super Bouncy Ball",
    description: "A neon green tennis sphere that bounces on wooden floors.",
    price: 20,
    icon: "🎾",
  },
];

const PRESET_PALETTES = [
  { name: "Ruby Crimson", hex: "#dc2626" },
  { name: "Royal Amber", hex: "#d97706" },
  { name: "Sunny Gold", hex: "#facc15" },
  { name: "Emerald Pine", hex: "#16a34a" },
  { name: "Ocean Azure", hex: "#0284c7" },
  { name: "Indigo Night", hex: "#4f46e5" },
  { name: "Velvet Plum", hex: "#9333ea" },
  { name: "Pastel Rose", hex: "#f43f5e" },
  { name: "Warm Cedar", hex: "#854d0e" },
  { name: "Espresso", hex: "#451a03" },
  { name: "Cream Oatmeal", hex: "#fef3c7" },
  { name: "Cloud White", hex: "#f8fafc" },
  { name: "Cool Slate", hex: "#475569" },
  { name: "Midnight Charcoal", hex: "#1e293b" },
];

type ShopTab = "bed" | "accessories" | "toys" | "tools";
type BedPart = "cushion" | "frame" | "blanket";

const TOOLS_CATALOG = [
  {
    id: "axe",
    name: "Lumberjack Axe",
    description: "Chop down park trees! Tap a tree to fell it for wood + forest snacks. Trees grow back in a minute.",
    price: 50,
    icon: "🪓",
  },
];

export const HouseShopModal: React.FC<HouseShopModalProps> = ({
  stats,
  onClose,
  onUpdateBedColors,
  onBuyAccessory,
  onEquipAccessory,
  onBuyToy,
  onBuyTool,
}) => {
  const [activeTab, setActiveTab] = useState<ShopTab>("bed");
  const [selectedBedPart, setSelectedBedPart] = useState<BedPart>("cushion");
  const [localBedColors, setLocalBedColors] = useState<BedColors>(
    stats.bedColors || {
      cushion: "#dc2626",
      frame: "#854d0e",
      blanket: "#fef3c7",
    }
  );

  const handleColorSelect = (hex: string) => {
    sound.playButtonTap();
    const updated = {
      ...localBedColors,
      [selectedBedPart]: hex,
    };
    setLocalBedColors(updated);
    onUpdateBedColors(updated);
  };

  const ownedAccessories = stats.ownedAccessories || [];
  const equippedAccessory = stats.equippedAccessory;
  const currentToy = stats.houseToy || "bone";

  return (
    <div
      id="house-shop-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="house-shop-modal-card"
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-amber-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 px-6 py-4 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Doggy House Shop
                <Sparkles className="w-4 h-4 text-yellow-200" />
              </h2>
              <p className="text-xs text-amber-100 font-medium">
                Customize your dog's cozy bed & buy fancy accessories!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Doggy Coin Balance */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black/20 rounded-full border border-white/20 text-sm font-bold shadow-inner">
              <Coins className="w-4 h-4 text-yellow-300 fill-yellow-300" />
              <span>{stats.coins}</span>
              <span className="text-xs text-amber-200 uppercase font-semibold">Coins</span>
            </div>

            <button
              id="close-shop-button"
              onClick={() => {
                sound.playButtonTap();
                onClose();
              }}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/25 transition text-white"
              aria-label="Close Shop"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 bg-amber-50/50 p-2 gap-2">
          <button
            id="shop-tab-bed"
            onClick={() => {
              sound.playButtonTap();
              setActiveTab("bed");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === "bed"
                ? "bg-white text-amber-900 shadow-sm border border-amber-200/60"
                : "text-amber-800/70 hover:bg-amber-100/50"
            }`}
          >
            <Palette className="w-4 h-4 text-amber-600" />
            <span>Bed Customizer</span>
          </button>

          <button
            id="shop-tab-accessories"
            onClick={() => {
              sound.playButtonTap();
              setActiveTab("accessories");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === "accessories"
                ? "bg-white text-amber-900 shadow-sm border border-amber-200/60"
                : "text-amber-800/70 hover:bg-amber-100/50"
            }`}
          >
            <Crown className="w-4 h-4 text-amber-600" />
            <span>Dog Accessories</span>
          </button>

          <button
            id="shop-tab-toys"
            onClick={() => {
              sound.playButtonTap();
              setActiveTab("toys");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === "toys"
                ? "bg-white text-amber-900 shadow-sm border border-amber-200/60"
                : "text-amber-800/70 hover:bg-amber-100/50"
            }`}
          >
            <Smile className="w-4 h-4 text-amber-600" />
            <span>House Toys</span>
          </button>

          <button
            id="shop-tab-tools"
            onClick={() => {
              sound.playButtonTap();
              setActiveTab("tools");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === "tools"
                ? "bg-white text-amber-900 shadow-sm border border-amber-200/60"
                : "text-amber-800/70 hover:bg-amber-100/50"
            }`}
          >
            <span className="text-base">🪓</span>
            <span>Tools</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* TAB 1: BED CUSTOMIZER */}
          {activeTab === "bed" && (
            <div className="space-y-6">
              {/* Instructions banner */}
              <div className="bg-amber-100/60 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
                <span className="text-xl">🛏️</span>
                <div>
                  <p className="font-bold text-amber-950 mb-0.5">Choose your bed colors!</p>
                  <p>
                    Select which of the <strong>three parts of the bed</strong> you want to customize,
                    then click any color palette below to instantly preview it in the 3D room.
                  </p>
                </div>
              </div>

              {/* 3 Bed Parts Selection Buttons */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 block">
                  1. Select Bed Part (3 Customizable Parts)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Part 1: Cushion */}
                  <button
                    id="bed-part-cushion-button"
                    onClick={() => {
                      sound.playButtonTap();
                      setSelectedBedPart("cushion");
                    }}
                    className={`relative p-3.5 rounded-2xl text-left border transition-all ${
                      selectedBedPart === "cushion"
                        ? "bg-white border-amber-500 ring-2 ring-amber-400/40 shadow-md"
                        : "bg-white/80 border-slate-200 hover:border-amber-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-slate-800">Cushion</span>
                      <div
                        className="w-5 h-5 rounded-full border border-black/20 shadow-sm"
                        style={{ backgroundColor: localBedColors.cushion }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">Soft memory-foam center pad</p>
                    {selectedBedPart === "cushion" && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white rounded-full p-0.5 text-[9px] font-bold">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>

                  {/* Part 2: Outer Frame */}
                  <button
                    id="bed-part-frame-button"
                    onClick={() => {
                      sound.playButtonTap();
                      setSelectedBedPart("frame");
                    }}
                    className={`relative p-3.5 rounded-2xl text-left border transition-all ${
                      selectedBedPart === "frame"
                        ? "bg-white border-amber-500 ring-2 ring-amber-400/40 shadow-md"
                        : "bg-white/80 border-slate-200 hover:border-amber-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-slate-800">Outer Frame</span>
                      <div
                        className="w-5 h-5 rounded-full border border-black/20 shadow-sm"
                        style={{ backgroundColor: localBedColors.frame }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">Sturdy wooden support rim</p>
                    {selectedBedPart === "frame" && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white rounded-full p-0.5 text-[9px] font-bold">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>

                  {/* Part 3: Snuggle Blanket */}
                  <button
                    id="bed-part-blanket-button"
                    onClick={() => {
                      sound.playButtonTap();
                      setSelectedBedPart("blanket");
                    }}
                    className={`relative p-3.5 rounded-2xl text-left border transition-all ${
                      selectedBedPart === "blanket"
                        ? "bg-white border-amber-500 ring-2 ring-amber-400/40 shadow-md"
                        : "bg-white/80 border-slate-200 hover:border-amber-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-slate-800">Snuggle Throw</span>
                      <div
                        className="w-5 h-5 rounded-full border border-black/20 shadow-sm"
                        style={{ backgroundColor: localBedColors.blanket }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">Folded fleece bedtime blanket</p>
                    {selectedBedPart === "blanket" && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white rounded-full p-0.5 text-[9px] font-bold">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Color Swatch Picker */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                  <span>2. Pick Color for {selectedBedPart.toUpperCase()}</span>
                  <span className="text-[11px] font-medium text-amber-700">Instant 3D Preview</span>
                </label>

                <div className="grid grid-cols-7 gap-2.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  {PRESET_PALETTES.map((palette) => {
                    const isSelected = localBedColors[selectedBedPart] === palette.hex;
                    return (
                      <button
                        key={palette.hex}
                        id={`palette-${palette.name.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => handleColorSelect(palette.hex)}
                        title={palette.name}
                        className={`group flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-all ${
                          isSelected
                            ? "ring-2 ring-amber-500 ring-offset-2 scale-105 bg-amber-50/60"
                            : "hover:scale-105 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full border-2 border-black/10 shadow-sm flex items-center justify-center transition-transform group-hover:scale-110"
                          style={{ backgroundColor: palette.hex }}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[60px] text-center">
                          {palette.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Preview Pill */}
              <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: localBedColors.frame }}
                      title="Frame Color"
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: localBedColors.cushion }}
                      title="Cushion Color"
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: localBedColors.blanket }}
                      title="Blanket Color"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700">
                    Active Bed Color Scheme
                  </span>
                </div>

                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saved & Active in Room
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: ACCESSORIES SHOP */}
          {activeTab === "accessories" && (
            <div className="space-y-4">
              <div className="bg-amber-100/60 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
                <span className="text-xl">🎩</span>
                <div>
                  <p className="font-bold text-amber-950 mb-0.5">Dress up your dog!</p>
                  <p>
                    Use your hard-earned <strong>doggy coins</strong> from fetch games and treats to
                    buy hats, sunglasses, bows, and bells! Click to equip or remove them anytime.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {ACCESSORIES_CATALOG.map((item) => {
                  const isOwned = ownedAccessories.includes(item.id);
                  const isEquipped = equippedAccessory === item.id;
                  const canAfford = stats.coins >= item.price;

                  return (
                    <div
                      key={item.id}
                      id={`accessory-item-${item.id}`}
                      className={`p-4 rounded-2xl border bg-white flex flex-col justify-between transition-all ${
                        isEquipped
                          ? "border-amber-500 ring-2 ring-amber-400/40 shadow-md"
                          : "border-slate-200 hover:border-amber-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-3xl">{item.icon}</span>
                          {isEquipped ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Equipped
                            </span>
                          ) : isOwned ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                              Owned
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 font-bold text-amber-600 text-xs bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Coins className="w-3 h-3 fill-amber-500" />
                              <span>{item.price}</span>
                            </div>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-800 mb-1">{item.name}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mb-3">
                          {item.description}
                        </p>
                      </div>

                      {/* Action Button */}
                      <div>
                        {isEquipped ? (
                          <button
                            id={`unequip-${item.id}-button`}
                            onClick={() => {
                              sound.playButtonTap();
                              onEquipAccessory(undefined);
                            }}
                            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                          >
                            <X className="w-3 h-3" /> Unequip
                          </button>
                        ) : isOwned ? (
                          <button
                            id={`equip-${item.id}-button`}
                            onClick={() => {
                              sound.playRewardFanfare();
                              onEquipAccessory(item.id);
                            }}
                            className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Wear Item
                          </button>
                        ) : (
                          <button
                            id={`buy-${item.id}-button`}
                            disabled={!canAfford}
                            onClick={() => {
                              sound.playRewardFanfare();
                              onBuyAccessory(item.id, item.price);
                            }}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                              canAfford
                                ? "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-sm"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                          >
                            <Coins className="w-3.5 h-3.5 fill-current" />
                            {canAfford ? `Buy for ${item.price} Coins` : "Need More Coins"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: HOUSE TOYS */}
          {activeTab === "toys" && (
            <div className="space-y-4">
              <div className="bg-amber-100/60 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
                <span className="text-xl">🦴</span>
                <div>
                  <p className="font-bold text-amber-950 mb-0.5">Room Floor Toy</p>
                  <p>
                    Choose which toy sits on the rug inside the house. Click the toy anytime in the
                    room to watch your dog trot over and squeak it!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {TOYS_CATALOG.map((toy) => {
                  const isActive = currentToy === toy.id;
                  const canAfford = stats.coins >= toy.price;

                  return (
                    <div
                      key={toy.id}
                      id={`toy-item-${toy.id}`}
                      className={`p-4 rounded-2xl border bg-white flex flex-col justify-between transition-all ${
                        isActive
                          ? "border-amber-500 ring-2 ring-amber-400/40 shadow-md"
                          : "border-slate-200 hover:border-amber-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-3xl">{toy.icon}</span>
                          {isActive ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> In House
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 font-bold text-amber-600 text-xs bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Coins className="w-3 h-3 fill-amber-500" />
                              <span>{toy.price === 0 ? "Free" : toy.price}</span>
                            </div>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-800 mb-1">{toy.name}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mb-3">
                          {toy.description}
                        </p>
                      </div>

                      <button
                        id={`select-toy-${toy.id}-button`}
                        disabled={isActive || (!isActive && toy.price > 0 && !canAfford)}
                        onClick={() => {
                          sound.playToyBounce();
                          onBuyToy(toy.id as any, toy.price);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                          isActive
                            ? "bg-slate-100 text-slate-400 cursor-default"
                            : canAfford
                            ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        {isActive ? (
                          "Currently in House"
                        ) : toy.price === 0 ? (
                          "Place in House"
                        ) : canAfford ? (
                          `Place in House (${toy.price} Coins)`
                        ) : (
                          "Need More Coins"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: TOOLS (axe for chopping trees) */}
          {activeTab === "tools" && (
            <div className="space-y-4">
              <div className="bg-emerald-100/70 border border-emerald-300 rounded-2xl p-4 text-xs text-emerald-950 flex items-start gap-3">
                <span className="text-xl">🌲</span>
                <div>
                  <p className="font-bold mb-0.5">Chop trees with an axe — 50 dog coins!</p>
                  <p>
                    Buy the axe once, then tap any park tree to chop it down for
                    <strong> +8 coins, +1 Golden Acorn & +1 Red Mushroom</strong>.
                    Trees grow back after a minute.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {TOOLS_CATALOG.map((tool) => {
                  const owned = (stats.ownedTools || []).includes(tool.id);
                  const canAfford = stats.coins >= tool.price;
                  return (
                    <div
                      key={tool.id}
                      id={`tool-item-${tool.id}`}
                      className={`p-4 rounded-2xl border bg-white flex items-center gap-4 transition-all ${
                        owned
                          ? "border-emerald-500 ring-2 ring-emerald-400/40 shadow-md"
                          : "border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      <span className="text-4xl shrink-0">{tool.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-800">{tool.name}</h4>
                          {owned ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Owned
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-bold text-amber-600 text-xs bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Coins className="w-3 h-3 fill-amber-500" />
                              <span>{tool.price}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed mt-1">{tool.description}</p>
                      </div>
                      {!owned && (
                        <button
                          id={`buy-${tool.id}-button`}
                          disabled={!canAfford}
                          onClick={() => {
                            sound.playRewardFanfare();
                            onBuyTool?.(tool.id, tool.price);
                          }}
                          className={`shrink-0 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            canAfford
                              ? "bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5 fill-current" />
                          {canAfford ? `Buy ${tool.price}` : "Need coins"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-100 px-6 py-3.5 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Changes apply instantly to your 3D dog and house!
          </p>
          <button
            id="done-shop-button"
            onClick={() => {
              sound.playButtonTap();
              onClose();
            }}
            className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-bold rounded-xl text-sm shadow-md transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
