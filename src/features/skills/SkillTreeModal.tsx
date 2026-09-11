import React, { useState } from "react";
import {
  X,
  Sparkles,
  Coins,
  CheckCircle2,
  Lock,
  Zap,
  Heart,
  ShieldAlert,
  Play,
  Award,
} from "lucide-react";
import { DogAction, PetStats, SkillCategory, SkillNode } from "../../types/pet";
import { SKILL_NODES } from "./skillTreeData";
import { sound } from "../../utils/audio";
import confetti from "canvas-confetti";

interface SkillTreeModalProps {
  stats: PetStats;
  onUnlockSkill: (skill: SkillNode) => void;
  onTryTrick: (action: DogAction) => void;
  onClose: () => void;
}

export const SkillTreeModal: React.FC<SkillTreeModalProps> = ({
  stats,
  onUnlockSkill,
  onTryTrick,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | "all">("all");
  const [activeNode, setActiveNode] = useState<SkillNode | null>(null);

  const unlockedSet = new Set(stats.unlockedSkills || []);

  const filteredSkills = SKILL_NODES.filter(
    (node) => selectedCategory === "all" || node.category === selectedCategory
  );

  const handleUnlock = (node: SkillNode) => {
    if (unlockedSet.has(node.id)) return;

    if (stats.coins < node.cost) {
      sound.playBark("low");
      return;
    }

    // Check prerequisites
    const hasPrereqs = node.prerequisites.every((p) => unlockedSet.has(p));
    if (!hasPrereqs) {
      sound.playBark("low");
      return;
    }

    sound.playRewardFanfare();
    confetti({
      particleCount: 65,
      spread: 70,
      origin: { y: 0.6 },
    });

    onUnlockSkill(node);
  };

  const getCategoryLabel = (cat: SkillCategory) => {
    switch (cat) {
      case "tricks":
        return "Tricks & Agility";
      case "affection":
        return "Bond & Affection";
      case "vitality":
        return "Vitality & Instincts";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#386641]/15 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#A7C957] flex items-center justify-center text-[#386641] font-bold text-xl shadow-sm">
              🌳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  {stats.name}'s Canine Skill Tree
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#A7C957]/30 text-[#F2E8CF] border border-[#6A994E]/40">
                  {unlockedSet.size} / {SKILL_NODES.length} Unlocked
                </span>
              </div>
              <p className="text-xs text-[#F2E8CF]/80">
                Spend mini-game rewards to unlock tricks, behaviors & passive bonuses!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Coin Balance Badge */}
            <div
              title="Rewards earned from Agility, Treat Catch & Fetch"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F2E8CF] text-[#386641] rounded-2xl font-black text-sm shadow-xs border border-white/20"
            >
              <Coins className="w-4 h-4 text-[#D4A373]" />
              <span>{stats.coins}</span>
              <span className="text-[10px] text-[#386641]/70 uppercase">Coins</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Tabs & Quick Stats */}
        <div className="px-6 py-3 bg-[#e8dcb8] border-b border-[#386641]/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-[#386641] text-[#F2E8CF] shadow-xs"
                  : "bg-white/80 hover:bg-white text-[#386641]"
              }`}
            >
              All Skills ({SKILL_NODES.length})
            </button>
            <button
              onClick={() => setSelectedCategory("tricks")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                selectedCategory === "tricks"
                  ? "bg-[#386641] text-[#F2E8CF] shadow-xs"
                  : "bg-white/80 hover:bg-white text-[#386641]"
              }`}
            >
              <span>🎾</span> Tricks & Agility
            </button>
            <button
              onClick={() => setSelectedCategory("affection")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                selectedCategory === "affection"
                  ? "bg-[#386641] text-[#F2E8CF] shadow-xs"
                  : "bg-white/80 hover:bg-white text-[#386641]"
              }`}
            >
              <span>❤️</span> Bond & Affection
            </button>
            <button
              onClick={() => setSelectedCategory("vitality")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                selectedCategory === "vitality"
                  ? "bg-[#386641] text-[#F2E8CF] shadow-xs"
                  : "bg-white/80 hover:bg-white text-[#386641]"
              }`}
            >
              <span>⚡</span> Vitality & Perks
            </button>
          </div>

          <div className="text-xs font-bold text-[#386641]/80 hidden md:flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6A994E]" /> Active
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#BC4749]" /> Passive
            </span>
          </div>
        </div>

        {/* Skill Tree Grid */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[60vh] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((node) => {
            const isUnlocked = unlockedSet.has(node.id);
            const missingPrereqs = node.prerequisites.filter((p) => !unlockedSet.has(p));
            const canUnlock = !isUnlocked && missingPrereqs.length === 0 && stats.coins >= node.cost;
            const isLockedPrereq = !isUnlocked && missingPrereqs.length > 0;
            const isNotEnoughCoins = !isUnlocked && missingPrereqs.length === 0 && stats.coins < node.cost;

            return (
              <div
                key={node.id}
                className={`relative rounded-3xl p-4 border transition-all flex flex-col justify-between ${
                  isUnlocked
                    ? "bg-white/95 border-[#6A994E] shadow-sm shadow-[#386641]/5"
                    : canUnlock
                    ? "bg-white border-[#386641]/25 hover:border-[#386641] shadow-md shadow-[#386641]/10"
                    : "bg-[#e8dcb8]/40 border-[#386641]/10 opacity-75"
                }`}
              >
                {/* Top Row: Icon, Tier, and Status */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-xs ${
                          isUnlocked
                            ? "bg-[#A7C957]/40 border border-[#6A994E]/40"
                            : canUnlock
                            ? "bg-white border border-[#386641]/20"
                            : "bg-[#386641]/10"
                        }`}
                      >
                        {node.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-black text-sm text-[#386641] leading-tight">
                            {node.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#386641]/10 text-[#386641]">
                            Tier {node.tier}
                          </span>
                          {node.isPassive ? (
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#BC4749]/15 text-[#BC4749]">
                              Passive Bonus
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#6A994E]/20 text-[#386641]">
                              Action Trick
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isUnlocked ? (
                      <div className="p-1 rounded-full bg-[#6A994E]/20 text-[#386641]">
                        <CheckCircle2 className="w-5 h-5 text-[#6A994E]" />
                      </div>
                    ) : (
                      <div className="p-1 rounded-full bg-[#386641]/10 text-[#386641]/60">
                        <Lock className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Description & Benefit */}
                  <p className="text-xs text-[#386641]/80 mb-2 font-medium leading-relaxed">
                    {node.description}
                  </p>

                  <div className="p-2.5 rounded-2xl bg-[#F2E8CF]/80 border border-[#386641]/10 text-xs font-bold text-[#386641] mb-3 flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4A373] shrink-0 mt-0.5" />
                    <span>{node.benefit}</span>
                  </div>

                  {/* Prerequisite warning if locked */}
                  {isLockedPrereq && (
                    <div className="text-[11px] font-semibold text-[#BC4749] mb-3 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Requires: {missingPrereqs.map((p) => SKILL_NODES.find((n) => n.id === p)?.name).join(", ")}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Area */}
                <div className="pt-2 border-t border-[#386641]/10 flex items-center justify-between gap-2">
                  {isUnlocked ? (
                    <div className="w-full flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#6A994E] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Unlocked
                      </span>
                      {node.actionUnlocked && (
                        <button
                          onClick={() => {
                            onClose();
                            onTryTrick(node.actionUnlocked!);
                          }}
                          className="px-3 py-1.5 bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Perform
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-xs font-black text-[#386641]">
                        <Coins className="w-3.5 h-3.5 text-[#D4A373]" />
                        <span>{node.cost} Coins</span>
                      </div>

                      <button
                        onClick={() => handleUnlock(node)}
                        disabled={!canUnlock}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                          canUnlock
                            ? "bg-[#6A994E] hover:bg-[#5a8342] text-[#F2E8CF] shadow-md shadow-[#386641]/15 active:scale-95"
                            : isNotEnoughCoins
                            ? "bg-[#386641]/15 text-[#386641]/50 cursor-not-allowed"
                            : "bg-[#386641]/10 text-[#386641]/40 cursor-not-allowed"
                        }`}
                      >
                        {isNotEnoughCoins ? "Need More Coins" : isLockedPrereq ? "Locked" : "Unlock Skill"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-3.5 bg-[#e8dcb8] border-t border-[#386641]/15 flex flex-wrap items-center justify-between gap-3 text-xs text-[#386641]/90">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#386641]" />
            <span>Play mini-games (Agility Course, Treat Catch, Fetch) to earn more coins!</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Back to Park
          </button>
        </div>
      </div>
    </div>
  );
};
