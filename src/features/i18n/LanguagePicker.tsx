import React from "react";
import { Check, Globe, X } from "lucide-react";
import {
  LANGUAGES,
  REGION_LABEL,
  REGION_ORDER,
  getLanguage,
  translate,
  type LanguageId,
  type Region,
} from "../i18n/i18n";

interface LanguagePickerProps {
  language: LanguageId;
  onSelect: (lang: LanguageId) => void;
  onClose: () => void;
}

const REGION_FLAG: Record<Region, string> = {
  europe: "🇪🇺",
  northAmerica: "🌎",
  asia: "🌏",
  africa: "🌍",
};

/**
 * Standalone language chooser launched from the title screen. Grouped by world
 * region: Europe, North America, Asia, Africa.
 */
export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  language,
  onSelect,
  onClose,
}) => {
  const t = (key: string) => translate(language, key);
  const current = getLanguage(language);

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-4">
      <div className="relative w-full max-w-2xl bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-[#A7C957]/20 text-[#A7C957] shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white">{t("language")}</h3>
              <p className="text-[11px] text-[#A7C957]/90 font-medium truncate">
                {t("languageSubtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currently selected */}
        <div className="px-5 py-3 bg-white/50 border-b border-[#386641]/10 flex items-center gap-2.5">
          <span className="text-xl leading-none">{current.flag}</span>
          <span className="font-black text-sm">{current.native}</span>
          <span className="text-[11px] text-[#386641]/60 font-medium">
            {REGION_LABEL[current.region]}
          </span>
        </div>

        {/* Language groups */}
        <div className="overflow-y-auto px-4 py-3 space-y-5 flex-1">
          {REGION_ORDER.map((region) => {
            const langs = LANGUAGES.filter((l) => l.region === region);
            if (langs.length === 0) return null;
            return (
              <section key={region}>
                <h4 className="flex items-center gap-2 text-[11px] font-black tracking-[0.18em] uppercase text-[#386641]/55 mb-2 px-1">
                  <span className="text-sm leading-none">{REGION_FLAG[region]}</span>
                  {REGION_LABEL[region]}
                  <span className="flex-1 h-px bg-[#386641]/10" />
                  <span className="text-[#386641]/40">{langs.length}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {langs.map((l) => {
                    const active = l.id === language;
                    return (
                      <button
                        key={l.id}
                        onClick={() => onSelect(l.id)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                          active
                            ? "bg-[#A7C957]/25 border-[#6A994E] shadow-sm"
                            : "bg-white/60 border-[#386641]/12 hover:bg-white hover:border-[#A7C957]"
                        }`}
                      >
                        <span className="text-lg leading-none shrink-0">{l.flag}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-black text-[13px] leading-tight truncate">
                            {l.native}
                          </span>
                          <span className="block text-[10px] text-[#386641]/55 font-medium leading-tight truncate">
                            {l.english}
                          </span>
                        </span>
                        {active && (
                          <span className="p-1 rounded-full bg-[#6A994E] text-white shrink-0">
                            <Check className="w-3 h-3" strokeWidth={3.5} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#386641]/15 bg-white/40">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-sm transition-colors cursor-pointer"
          >
            {t("done")}
          </button>
        </div>
      </div>
    </div>
  );
};
