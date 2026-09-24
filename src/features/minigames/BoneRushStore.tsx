import React from "react";
import { X, Store, Check, Lock } from "lucide-react";
import { sound } from "../../utils/audio";
import {
  BONE_DESIGNS,
  PUP_COSTUMES,
  TRAIL_EFFECTS,
  buyItem,
  equipItem,
  getBoneBalance,
  getWallet,
} from "../bonerush/boneRushData";

interface BoneRushStoreProps {
  onClose: () => void;
  /** Notify the parent (runner) that the wallet changed. */
  onChange?: () => void;
}

/**
 * Bone Rush Store — spend banked Bone Points on bone designs,
 * trail particle effects and runner pup costumes.
 */
export const BoneRushStore: React.FC<BoneRushStoreProps> = ({ onClose, onChange }) => {
  const [, forceRender] = React.useReducer((x: number) => x + 1, 0);
  const wallet = getWallet();

  const refresh = () => {
    forceRender();
    onChange?.();
  };

  const handleBuy = (id: string, cost: number, kind: "design" | "trail" | "costume") => {
    if (buyItem(id, cost)) {
      equipItem(kind, id); // auto-equip what you just bought
      sound.playRewardFanfare();
      refresh();
    } else {
      sound.playBark("low");
    }
  };

  const handleEquip = (kind: "design" | "trail" | "costume", id: string) => {
    equipItem(kind, id);
    sound.playButtonTap();
    refresh();
  };

  const balance = getBoneBalance();

  const Card: React.FC<{
    id: string;
    name: string;
    icon: string;
    cost: number;
    desc: string;
    kind: "design" | "trail" | "costume";
  }> = ({ id, name, icon, cost, desc, kind }) => {
    const unlocked = wallet.unlocked.includes(id);
    const affordable = balance >= cost;
    const isEquipped = wallet.equipped[kind] === id;
    return (
      <div
        className={`p-3 rounded-2xl border transition-all ${
          isEquipped
            ? "bg-[#A7C957]/25 border-[#6A994E] shadow-sm"
            : "bg-white/85 border-[#386641]/15 hover:bg-white"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#F2E8CF] border border-[#386641]/15 flex items-center justify-center text-xl shrink-0">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-[#386641] truncate">{name}</div>
            <div className="text-[10px] text-[#386641]/70 leading-tight">{desc}</div>
          </div>
        </div>
        <div className="mt-2.5">
          {!unlocked ? (
            <button
              disabled={!affordable}
              onClick={() => handleBuy(id, cost, kind)}
              title={affordable ? `Buy for ${cost} bones` : `Need ${cost - balance} more bones`}
              className={`w-full py-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition-all ${
                affordable
                  ? "bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] cursor-pointer active:scale-95"
                  : "bg-[#386641]/15 text-[#386641]/40 cursor-not-allowed"
              }`}
            >
              {affordable ? <Lock className="w-3 h-3" /> : null} 🦴 {cost}
            </button>
          ) : isEquipped ? (
            <div className="w-full py-1.5 rounded-xl text-[11px] font-black bg-[#6A994E] text-white flex items-center justify-center gap-1">
              <Check className="w-3 h-3" /> Equipped
            </div>
          ) : (
            <button
              onClick={() => handleEquip(kind, id)}
              className="w-full py-1.5 rounded-xl text-[11px] font-black bg-white border border-[#386641]/25 text-[#386641] hover:bg-[#F2E8CF] cursor-pointer active:scale-95 transition-all"
            >
              Equip
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border-2 border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[92vh]">
        {/* Header: live banked bone balance */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-[#A7C957]/20 text-[#A7C957]">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Bone Rush Store</h3>
              <p className="text-[11px] text-[#A7C957]/90 font-medium">
                Spend the bones you banked on fresh looks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-white/15 rounded-full px-3 py-1 border border-white/20">
              🦴 {balance}
            </span>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#2c5234] cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Section 1: Bone designs */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
              🦴 Bone Designs <span className="text-[10px] normal-case font-bold text-[#386641]/60">— how your collectibles shine</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {BONE_DESIGNS.map((d) => (
                <Card key={d.id} id={d.id} name={d.name} icon={d.icon} cost={d.cost} desc={d.desc} kind="design" />
              ))}
            </div>
          </section>

          {/* Section 2: Trail effects */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
              💫 Trail Effects <span className="text-[10px] normal-case font-bold text-[#386641]/60">— particles streaming behind the runner</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {TRAIL_EFFECTS.map((t) => (
                <Card key={t.id} id={t.id} name={t.name} icon={t.icon} cost={t.cost} desc={t.desc} kind="trail" />
              ))}
            </div>
          </section>

          {/* Section 3: Costumes */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
              🐶 Runner Pup Costumes <span className="text-[10px] normal-case font-bold text-[#386641]/60">— fresh coats for the track</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {PUP_COSTUMES.map((c) => (
                <Card key={c.id} id={c.id} name={c.name} icon={c.icon} cost={c.cost} desc={c.desc} kind="costume" />
              ))}
            </div>
          </section>

          <p className="text-[10px] font-bold text-[#386641]/60 text-center">
            💡 Collect bones in Subway Pup: Bone Rush runs to fatten your wallet!
          </p>
        </div>
      </div>
    </div>
  );
};

