import { BoneRushSave } from "../../types/pet";

/**
 * Subway Pup: Bone Rush — persistent Bone Points wallet + cosmetics catalog.
 * Every bone collected during a run is banked here and spent in the
 * Bone Rush Store (designs, trails, costumes).
 */

const WALLET_KEY = "bonerush_wallet_v1";
const STARTER_BONES = 50;

export interface BoneDesign {
  id: string;
  name: string;
  icon: string;
  cost: number;
  /** CSS hex color of the collectible bone mesh. */
  color: number;
  /** Emissive glow color (0 = no glow). */
  emissive: number;
  /** Hue-cycles every frame (prismatic rainbow). */
  hueCycle?: boolean;
  /** Festive stripes rendered on the bone (peppermint). */
  stripes?: boolean;
  desc: string;
}

export interface TrailEffect {
  id: string;
  name: string;
  icon: string;
  cost: number;
  color: number;
  hueCycle?: boolean;
  desc: string;
}

export interface PupCostume {
  id: string;
  name: string;
  icon: string;
  cost: number;
  /** Runner body + accent fur colors. */
  body: number;
  accent: number;
  /** Neon visor glow (Cyber Mech). */
  visor?: number;
  desc: string;
}

export const BONE_DESIGNS: BoneDesign[] = [
  { id: "classic_bone", name: "Classic Bone", icon: "🦴", cost: 0, color: 0xf5f0e6, emissive: 0, desc: "The timeless ivory dog bone." },
  { id: "golden_honey", name: "Golden Honey Bone", icon: "🍯", cost: 40, color: 0xf5b942, emissive: 0x7a4a00, desc: "Rich honey-gold with a warm shimmer." },
  { id: "diamond_crystal", name: "Diamond Crystal Bone", icon: "💎", cost: 75, color: 0x9ff2ff, emissive: 0x1e6b8a, desc: "Refractive cyan glimmer, ice-cold sparkle." },
  { id: "cyber_neon", name: "Cyber Neon Bone", icon: "🟣", cost: 60, color: 0xff3df5, emissive: 0x9900b3, desc: "Synthwave magenta with grid glow." },
  { id: "molten_magma", name: "Molten Magma Bone", icon: "🌋", cost: 80, color: 0xff5722, emissive: 0xbf360c, desc: "Cracked lava fissures glowing hot orange." },
  { id: "prismatic_rainbow", name: "Prismatic Rainbow Bone", icon: "🌈", cost: 120, color: 0xff0055, emissive: 0x55007f, hueCycle: true, desc: "Dynamic hue cycling — every bone a new color!" },
  { id: "peppermint_candy", name: "Peppermint Candy Bone", icon: "🍬", cost: 50, color: 0xffffff, emissive: 0, stripes: true, desc: "Festive red-striped candy cane bone." },
];

export const TRAIL_EFFECTS: TrailEffect[] = [
  { id: "none", name: "No Trail", icon: "🚫", cost: 0, color: 0x000000, desc: "A clean runner, no particles." },
  { id: "earth_puffs", name: "Soft Earth Puffs", icon: "🌫️", cost: 30, color: 0xb08a5e, desc: "Cozy dust puffs kicked up by galloping paws." },
  { id: "golden_stardust", name: "Golden Stardust", icon: "✨", cost: 60, color: 0xffd54f, desc: "Twinkling sparkles trailing behind." },
  { id: "rocket_embers", name: "Rocket Flame Embers", icon: "🔥", cost: 90, color: 0xff6d1f, desc: "Blazing ember streaks — zoom zoom!" },
  { id: "aurora_ribbon", name: "Rainbow Aurora Ribbon", icon: "🌈", cost: 120, color: 0xff0088, hueCycle: true, desc: "A dancing ribbon of aurora light." },
  { id: "aqua_bubbles", name: "Hydro Aqua Bubbles", icon: "🫧", cost: 70, color: 0x59d5ff, desc: "Floating water bubbles in your wake." },
  { id: "matrix_bits", name: "Digital Matrix Bits", icon: "🟩", cost: 100, color: 0x39ff14, desc: "Glitchy green digital code bits." },
];

export const PUP_COSTUMES: PupCostume[] = [
  { id: "classic_pup", name: "Classic Pup", icon: "🐶", cost: 0, body: 0xd9a05b, accent: 0x8a5a2b, desc: "Your good boy, just as he is." },
  { id: "midnight_shadow", name: "Midnight Shadow Hound", icon: "🌑", cost: 80, body: 0x232135, accent: 0x0f0f1a, desc: "A sleek shadow-black hunter of the night." },
  { id: "arctic_snow", name: "Arctic Snow Wolf", icon: "❄️", cost: 100, body: 0xf2f6fa, accent: 0xb9c9d9, desc: "Frost-white fur, cool as fresh powder." },
  { id: "cyber_mech", name: "Cyber Mech Canine", icon: "🤖", cost: 150, body: 0x3c4450, accent: 0x1de9b6, visor: 0x00e5ff, desc: "Chrome plating and a neon LED visor." },
];

// ---------- Wallet persistence ----------

function defaultSave(): BoneRushSave {
  return {
    bones: STARTER_BONES,
    unlocked: ["classic_bone", "none", "classic_pup"],
    equipped: { design: "classic_bone", trail: "none", costume: "classic_pup" },
  };
}

function load(): BoneRushSave {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BoneRushSave;
      return {
        bones: typeof parsed.bones === "number" ? parsed.bones : STARTER_BONES,
        unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : defaultSave().unlocked,
        equipped: { ...defaultSave().equipped, ...(parsed.equipped || {}) },
      };
    }
  } catch {
    // ignore
  }
  return defaultSave();
}

let save: BoneRushSave = typeof window !== "undefined" ? load() : defaultSave();

function persist() {
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(save));
  } catch {
    // ignore
  }
}

export function getWallet(): BoneRushSave {
  return save;
}

export function getBoneBalance(): number {
  return save.bones;
}

export function addBones(n: number): number {
  save.bones = Math.max(0, Math.round(save.bones + n));
  persist();
  return save.bones;
}

/** Returns true when the purchase succeeded (enough bones). */
export function buyItem(id: string, cost: number): boolean {
  if (save.unlocked.includes(id)) return false;
  if (save.bones < cost) return false;
  save.bones -= cost;
  save.unlocked.push(id);
  persist();
  return true;
}

export function equipItem(kind: "design" | "trail" | "costume", id: string) {
  save.equipped[kind] = id;
  persist();
}

export function getEquippedDesign(): BoneDesign {
  return BONE_DESIGNS.find((d) => d.id === save.equipped.design) ?? BONE_DESIGNS[0];
}

export function getEquippedTrail(): TrailEffect {
  return TRAIL_EFFECTS.find((t) => t.id === save.equipped.trail) ?? TRAIL_EFFECTS[0];
}

export function getEquippedCostume(): PupCostume {
  return PUP_COSTUMES.find((c) => c.id === save.equipped.costume) ?? PUP_COSTUMES[0];
}
