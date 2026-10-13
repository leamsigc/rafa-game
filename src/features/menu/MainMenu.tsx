import React, { useEffect, useMemo, useState } from "react";
import { Play, Settings as SettingsIcon, Heart, Sparkles } from "lucide-react";
import {
  getSplashes,
  translate,
  type LanguageId,
} from "../i18n/i18n";

interface MainMenuProps {
  language: LanguageId;
  dogName: string;
  onStart: () => void;
  onOpenSettings: () => void;
}

const SPLASH_SLOTS = 4;

/**
 * Title screen: the dog's name, a cluster of little speech splashes in the
 * upper right, a Start button, and Settings underneath.
 */
export const MainMenu: React.FC<MainMenuProps> = ({
  language,
  dogName,
  onStart,
  onOpenSettings,
}) => {
  const pool = useMemo(() => getSplashes(language), [language]);
  const t = useCallbackT(language);

  // Rotate through splash phrases, one new bubble at a time.
  const [offset, setOffset] = useState<number>(() => Math.floor(Math.random() * pool.length));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setOffset((prev) => (prev + 1) % pool.length);
    }, 3400);
    return () => window.clearInterval(timer);
  }, [pool.length]);

  useEffect(() => {
    setOffset((prev) => (prev + 1) % pool.length);
  }, [pool.length]);

  const splashes = Array.from({ length: SPLASH_SLOTS }, (_, i) => {
    const index = (offset - i + pool.length * SPLASH_SLOTS) % pool.length;
    return { text: pool[index], key: `${index}-${i}` };
  });

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Backdrop: warm evening sky over the already-running 3D park */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#101a13]/94 via-[#1b2a1f]/90 to-[#0d1410]/96" />
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_50%_118%,#A7C957_0%,transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)]" />

      {/* ===== Little splashes, upper right ===== */}
      <div className="absolute top-6 right-4 sm:top-10 sm:right-10 flex flex-col items-end gap-2.5 pointer-events-none">
        {splashes.map((splash, i) => (
          <div
            key={splash.key}
            className="relative max-w-[62vw] sm:max-w-xs"
            style={{
              opacity: 1 - i * 0.22,
              transform: `scale(${1 - i * 0.07}) translateY(0)`,
              transition: "opacity 500ms ease, transform 500ms ease",
            }}
          >
            <div
              className={`relative px-3.5 py-2 rounded-2xl rounded-tr-md bg-[#F2E8CF] border-2 border-[#A7C957]/70 text-[#386641] font-bold text-xs sm:text-sm shadow-lg shadow-black/30 whitespace-nowrap ${
                i === 0 ? "animate-splash-pop" : ""
              }`}
            >
              {splash.text}
            </div>
          </div>
        ))}
      </div>

      {/* ===== Title ===== */}
      <div className="relative z-10 flex flex-col items-center px-6 -mt-10 sm:-mt-16">
        <div className="flex items-center gap-2.5 mb-3">
          <Sparkles className="w-5 h-5 text-[#A7C957] animate-pulse" />
          <span className="text-[#A7C957] font-black text-[11px] sm:text-xs tracking-[0.3em] uppercase">
            {t("tagline")}
          </span>
          <Sparkles className="w-5 h-5 text-[#A7C957] animate-pulse" />
        </div>

        <h1
          className="text-[68px] sm:text-[104px] leading-none font-black tracking-tight text-transparent select-none"
          style={{
            backgroundImage: "linear-gradient(180deg, #FFF8E7 0%, #F2E8CF 45%, #A7C957 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            filter: "drop-shadow(0 6px 0 rgba(22,33,26,0.55)) drop-shadow(0 14px 26px rgba(0,0,0,0.5))",
          }}
        >
          {dogName}
        </h1>

        <div className="mt-4 flex items-center gap-2 text-[#F2E8CF]/70 text-xs sm:text-sm font-bold">
          <Heart className="w-3.5 h-3.5 fill-[#BC4749] text-[#BC4749]" />
          {t("splashesTitle")}
          <Heart className="w-3.5 h-3.5 fill-[#BC4749] text-[#BC4749]" />
        </div>
      </div>

      {/* ===== Start + Settings ===== */}
      <div className="relative z-10 mt-10 sm:mt-14 flex flex-col items-center gap-3.5">
        <button
          onClick={onStart}
          className="group flex items-center gap-3 px-9 py-4 rounded-2xl bg-[#A7C957] hover:bg-[#97B949] active:scale-95 text-white font-black text-base sm:text-lg tracking-wide shadow-xl shadow-[#A7C957]/25 transition-all cursor-pointer border-b-4 border-[#6A994E] active:border-b-1"
        >
          <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
          {t("start")}
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-[#F2E8CF]/10 hover:bg-[#F2E8CF]/20 active:scale-95 text-[#F2E8CF] font-black text-sm sm:text-base tracking-wide transition-all cursor-pointer border border-[#F2E8CF]/25 backdrop-blur-sm"
        >
          <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          {t("settings")}
        </button>
      </div>
    </div>
  );
};

/** Tiny memo-free helper so the component body stays readable. */
function useCallbackT(language: LanguageId) {
  return React.useCallback(
    (key: string) => translate(language, key),
    [language]
  );
}
