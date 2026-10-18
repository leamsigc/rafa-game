import React from "react";
import { Pin, PinOff, Lock, Check, Sparkles, Trophy, Coins } from "lucide-react";
import { PetStats } from "../../types/pet";
import {
  BADGE_CASE,
  BADGE_COIN_REWARD,
  BADGE_RARITY_META,
  BadgeDef,
} from "./badgeCaseData";

interface BadgeCaseProps {
  stats: PetStats;
  /** Badge ids permanently earned (from stats.earnedBadges). */
  earned: string[];
  /** The badge currently pinned as the trainer's showcase emblem. */
  pinned: string | null;
  onPin: (badgeId: string | null) => void;
}

/**
 * The Badge Case — a glass display case inside the Achievements Hall of Fame.
 *
 * Every slot holds a permanent cosmetic badge unlocked by a specific Canine
 * Skill Tree milestone. Earned badges are fully coloured and can be pinned as
 * the trainer's showcase emblem; locked slots show a silhouette, the exact
 * requirement, and live progress toward it.
 */
export const BadgeCase: React.FC<BadgeCaseProps> = ({ stats, earned, pinned, onPin }) => {
  const earnedSet = new Set(earned);
  const earnedCount = BADGE_CASE.filter((b) => earnedSet.has(b.id)).length;
  const pinnedBadge = pinned ? BADGE_CASE.find((b) => b.id === pinned) : undefined;

  return (
    <div className="space-y-3">
      {/* Case header */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#386641] flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          Badge Case ({earnedCount}/{BADGE_CASE.length})
        </h4>
        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#386641]/10 text-[#386641]/80 border border-[#386641]/15">
          Skill Tree Milestones
        </span>
      </div>

      {/* The featured emblem — a pinned badge shown front and centre */}
      <div className="rounded-3xl border-2 border-[#386641]/20 bg-gradient-to-br from-[#2c5234] via-[#386641] to-[#1f3b27] p-4 shadow-inner">
        <div className="flex items-center gap-4">
          <div
            className={`relative w-16 h-16 shrink-0 rounded-full flex items-center justify-center text-3xl border-4 shadow-lg ${
              pinnedBadge
                ? `${BADGE_RARITY_META[pinnedBadge.rarity].ring} bg-[#F2E8CF] ${BADGE_RARITY_META[pinnedBadge.rarity].glow}`
                : "border-white/25 bg-white/10"
            }`}
          >
            {pinnedBadge ? (
              <span>{pinnedBadge.icon}</span>
            ) : (
              <Sparkles className="w-7 h-7 text-[#F2E8CF]/50" />
            )}
            {pinnedBadge && (
              <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#F2E8CF] text-[#386641] border border-white shadow">
                <Pin className="w-3 h-3" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#A7C957]">
              Pinned Emblem
            </p>
            <h5 className="text-sm font-black text-white truncate">
              {pinnedBadge ? pinnedBadge.name : "Nothing pinned yet"}
            </h5>
            <p className="text-[11px] font-bold text-[#F2E8CF]/75 leading-snug mt-0.5">
              {pinnedBadge
                ? pinnedBadge.description
                : "Earn a skill-tree badge below, then pin it to showcase it beside your name."}
            </p>
          </div>
        </div>
      </div>

      {/* The display slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {BADGE_CASE.map((badge) => (
          <BadgeSlot
            key={badge.id}
            badge={badge}
            stats={stats}
            isEarned={earnedSet.has(badge.id)}
            isPinned={pinned === badge.id}
            onPin={onPin}
          />
        ))}
      </div>
    </div>
  );
};

interface BadgeSlotProps {
  badge: BadgeDef;
  stats: PetStats;
  isEarned: boolean;
  isPinned: boolean;
  onPin: (badgeId: string | null) => void;
}

const BadgeSlot: React.FC<BadgeSlotProps> = ({ badge, stats, isEarned, isPinned, onPin }) => {
  const meta = BADGE_RARITY_META[badge.rarity];
  const prog = badge.progress(stats);
  const pct = Math.min(100, Math.round((prog.current / Math.max(1, prog.goal)) * 100));
  const reward = BADGE_COIN_REWARD[badge.rarity];

  return (
    <div
      className={`relative rounded-2xl border p-3 transition-all ${
        isEarned
          ? `bg-gradient-to-br from-[#F2E8CF] to-white ${meta.ring} shadow-sm`
          : "bg-white/70 border-[#386641]/12"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Medal */}
        <div
          className={`relative w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-xl border-2 shadow-sm ${
            isEarned ? `${meta.ring} bg-white` : "border-[#386641]/15 bg-[#386641]/5"
          }`}
        >
          <span className={isEarned ? "" : "grayscale opacity-35"}>{badge.icon}</span>
          {isEarned && (
            <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-[#6A994E] text-white border border-white">
              <Check className="w-2.5 h-2.5" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h5
              className={`text-[11px] font-black truncate ${
                isEarned ? "text-[#386641]" : "text-[#386641]/55"
              }`}
            >
              {badge.name}
            </h5>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${meta.chip}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-[9px] font-bold text-[#386641]/60 leading-tight mt-0.5">
            {isEarned ? badge.description : badge.requirement}
          </p>

          {/* Progress bar for locked badges */}
          {!isEarned && (
            <div className="mt-1.5">
              <div className="h-1.5 bg-[#386641]/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6A994E] rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] font-black text-[#386641]/45 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> {prog.current}/{prog.goal}
                </span>
                <span className="text-[9px] font-black text-amber-700 flex items-center gap-0.5">
                  <Coins className="w-2.5 h-2.5" /> {reward} on unlock
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pin / unpin control */}
      {isEarned && (
        <button
          onClick={() => onPin(isPinned ? null : badge.id)}
          className={`mt-2.5 w-full py-1.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
            isPinned
              ? "bg-[#386641] text-[#F2E8CF]"
              : "bg-[#386641]/10 hover:bg-[#386641]/20 text-[#386641]"
          }`}
        >
          {isPinned ? (
            <>
              <Pin className="w-3 h-3" /> Pinned to profile
            </>
          ) : (
            <>
              <PinOff className="w-3 h-3" /> Pin this badge
            </>
          )}
        </button>
      )}
    </div>
  );
};
