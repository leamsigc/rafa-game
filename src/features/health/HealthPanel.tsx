import React from "react";
import { Activity, Pill, Stethoscope, X, ShoppingCart, Check } from "lucide-react";
import {
  HEALTH_BAND_KEY,
  MEDICINES,
  getIllness,
  getMedicine,
  healthBand,
  healthBandColor,
  illnessChanceLabel,
  medicineForIllness,
  type MedicineDef,
} from "./healthData";
import { translate, type LanguageId } from "../i18n/i18n";

interface HealthPanelProps {
  language: LanguageId;
  health: number;
  illnessId: string | null;
  medicines: Record<string, number>;
  coins: number;
  onUseMedicine: (medicine: MedicineDef) => void;
  onBuyMedicine: (medicine: MedicineDef) => void;
  onClose: () => void;
}

/**
 * The health system readout: how healthy the pup is, what is ailing him, and
 * the medicine cabinet to fix it with.
 */
export const HealthPanel: React.FC<HealthPanelProps> = ({
  language,
  health,
  illnessId,
  medicines,
  coins,
  onUseMedicine,
  onBuyMedicine,
  onClose,
}) => {
  const t = (key: string) => translate(language, key);
  const illness = getIllness(illnessId);
  const band = healthBand(health);
  const color = healthBandColor(health);
  const suggested = illness ? medicineForIllness(illness.id) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-[#A7C957]/20 text-[#A7C957]">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">{t("health")}</h3>
              <p className="text-[11px] text-[#A7C957]/90 font-medium">
                {t(HEALTH_BAND_KEY[band])}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-4">
          {/* ===== Health meter ===== */}
          <section className="rounded-2xl bg-white/60 border border-[#386641]/12 p-4">
            <div className="flex items-end justify-between mb-2">
              <span className="flex items-center gap-1.5 font-black text-xs tracking-wide uppercase text-[#386641]/70">
                <Activity className="w-3.5 h-3.5" /> {t("health")}
              </span>
              <span className="font-black text-2xl leading-none" style={{ color }}>
                {Math.round(health)}%
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#386641]/12 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, health))}%`, backgroundColor: color }}
              />
            </div>
          </section>

          {/* ===== Current ailment ===== */}
          <section>
            {illness ? (
              <div className="rounded-2xl border-2 border-[#BC4749]/35 bg-[#BC4749]/10 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none shrink-0 animate-pulse">{illness.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-sm">{illness.name}</h4>
                    <p className="text-xs text-[#386641]/75 mt-0.5 leading-snug">{illness.blurb}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-[#BC4749] text-white font-black text-[10px]">
                        {t("illness")}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/70 border border-[#386641]/15 font-bold text-[10px]">
                        {illnessChanceLabel(illness)} chance
                      </span>
                    </div>
                    {illness.blockedActions.length > 0 && (
                      <p className="mt-2 text-[10px] text-[#386641]/65 font-medium">
                        No {illness.blockedActions.join(", ")} until he's better.
                      </p>
                    )}
                    {suggested && (
                      <button
                        onClick={() => onUseMedicine(suggested)}
                        disabled={(medicines[suggested.id] || 0) <= 0}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#6A994E] hover:bg-[#386641] active:scale-95 text-white font-black text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        <Pill className="w-4 h-4" />
                        {t("giveMedicine")}: {suggested.name}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-[#6A994E]/35 bg-[#6A994E]/10 p-4 flex items-center gap-3">
                <span className="text-3xl leading-none shrink-0">🐾</span>
                <p className="font-black text-sm">{t("noIllness")}</p>
              </div>
            )}
          </section>

          {/* ===== Medicine cabinet ===== */}
          <section>
            <h4 className="flex items-center gap-1.5 font-black text-xs tracking-wide uppercase text-[#386641]/70 mb-2 px-1">
              <Pill className="w-3.5 h-3.5" /> {t("medicine")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MEDICINES.map((med) => {
                const owned = medicines[med.id] || 0;
                const canAfford = coins >= med.cost;
                const curesIllness = illness ? med.cures.includes(illness.id) : false;
                return (
                  <div
                    key={med.id}
                    className={`rounded-2xl border p-3 transition-colors ${
                      curesIllness
                        ? "border-[#6A994E] bg-[#6A994E]/10"
                        : "border-[#386641]/12 bg-white/60"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl leading-none shrink-0">{med.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-[13px] leading-tight">{med.name}</p>
                        <p className="text-[10px] text-[#386641]/65 leading-tight mt-0.5">
                          {med.blurb}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-[#6A994E]">
                          +{med.healthRestore}% {t("health")} · +{med.energyRestore}⚡
                        </p>
                      </div>
                      {owned > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#386641] text-[#F2E8CF] font-black text-[10px] shrink-0">
                          x{owned}
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex gap-1.5">
                      <button
                        onClick={() => onUseMedicine(med)}
                        disabled={owned <= 0}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#6A994E] hover:bg-[#386641] text-white font-black text-[11px] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                      >
                        <Check className="w-3 h-3" />
                        {t("giveMedicine")}
                      </button>
                      <button
                        onClick={() => onBuyMedicine(med)}
                        disabled={!canAfford}
                        title={`${med.cost}c`}
                        className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        {med.cost}c
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

/** Small inline health pill used in the HUD. */
export const HealthChip: React.FC<{
  language: LanguageId;
  health: number;
  illnessId: string | null;
  onClick: () => void;
}> = ({ language, health, illnessId, onClick }) => {
  const t = (key: string) => translate(language, key);
  const illness = getIllness(illnessId);
  const color = healthBandColor(health);
  return (
    <button
      onClick={onClick}
      title={`${t("health")}: ${Math.round(health)}%`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1F2937]/85 border border-[#A7C957]/30 text-[#F2E8CF] text-[11px] font-black backdrop-blur-md hover:bg-[#1F2937] active:scale-95 transition-all cursor-pointer"
    >
      {illness ? (
        <span className="text-sm leading-none animate-pulse">{illness.emoji}</span>
      ) : (
        <Activity className="w-3.5 h-3.5" style={{ color }} />
      )}
      <span>{Math.round(health)}%</span>
    </button>
  );
};

export { getMedicine };
