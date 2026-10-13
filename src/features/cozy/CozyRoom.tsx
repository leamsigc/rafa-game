import React, { useEffect, useRef, useState } from "react";
import { BookOpen, X, Milk } from "lucide-react";
import { translate, type LanguageId } from "../i18n/i18n";
import { CozyScene3D } from "./CozyScene3D";
import type { DogBreed } from "../../types/pet";

interface CozyRoomProps {
  language: LanguageId;
  dogName: string;
  breed: DogBreed;
  collarColor: string;
  /** Health drives how alert he looks. */
  health: number;
  onLeave: () => void;
  onReadStory: () => void;
}

const TOTAL_SIPS = 6;

/**
 * The blanket scene. The screen has already gone black; here Happy sits
 * facing the camera in a real 3D room, wrapped in a blanket, drinking a bowl
 * of chocolate milk sip by sip.
 */
export const CozyRoom: React.FC<CozyRoomProps> = ({
  language,
  dogName,
  breed,
  collarColor,
  health,
  onLeave,
  onReadStory,
}) => {
  const t = (key: string) => translate(language, key);
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CozyScene3D | null>(null);

  const [ready, setReady] = useState(false);
  const [sips, setSips] = useState(0);
  const [milk, setMilk] = useState(100);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new CozyScene3D(mountRef.current, breed, collarColor, {
      onMilkLevel: setMilk,
      onSip: setSips,
      onFinished: () => setFinished(true),
    });
    sceneRef.current = scene;
    const reveal = window.setTimeout(() => setReady(true), 700);
    return () => {
      window.clearTimeout(reveal);
      scene.destroy();
      sceneRef.current = null;
    };
  }, [breed, collarColor]);

  const sickly = health < 45;

  return (
    <div className="fixed inset-0 z-[78] flex flex-col overflow-hidden select-none bg-[#0a0705]">
      {/* ===== The 3D room ===== */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Fade up out of black */}
      <div
        className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-[1400ms] ease-out"
        style={{ opacity: ready ? 0 : 1 }}
      />

      {/* Vignette to sink the edges into the warm dark */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.72)_100%)]" />

      {/* ===== Title ===== */}
      <div
        className="relative z-10 text-center pt-5 sm:pt-8 px-6 pointer-events-none transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <h2 className="text-2xl sm:text-3xl font-black text-[#F2E8CF] drop-shadow-lg tracking-wide">
          {t("blanket")}
        </h2>
        <p className="mt-1 text-[#D4A373] text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
          <span>
            {dogName}
            {sickly ? " 🤧" : ""} · {t("chocolateMilk")} {Math.round(milk)}%
          </span>
        </p>
      </div>

      {/* Sip counter, bottom-left, out of the way of the dog */}
      <div
        className="absolute z-10 left-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex items-center gap-1.5 pointer-events-none transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      >
        {Array.from({ length: TOTAL_SIPS }, (_, i) => (
          <span
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              i < sips ? "bg-[#D4A373] scale-110" : "bg-[#F2E8CF]/25"
            }`}
          />
        ))}
        <span className="ml-1.5 text-[11px] font-bold text-[#F2E8CF]/70">
          {finished ? "🐾" : t("sip")}
        </span>
      </div>

      {/* Controls, tucked bottom-right so they never sit on the bowl */}
      <div
        className="absolute z-10 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-2 transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <button
          onClick={onReadStory}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#F2E8CF] hover:bg-white active:scale-95 text-[#386641] font-black text-xs sm:text-sm shadow-xl transition-all cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          {t("readStory")}
        </button>
        <button
          onClick={onLeave}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-[#F2E8CF] font-black text-xs sm:text-sm border border-white/20 backdrop-blur-sm transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
          {t("leaveCoziness")}
        </button>
      </div>

      {/* Bowl-empty hint */}
      {finished && (
        <div className="absolute z-10 inset-x-0 bottom-[92px] flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-black/60 text-[#F2E8CF] text-[11px] font-bold flex items-center gap-1.5">
            <Milk className="w-3.5 h-3.5" />
            {t("chocolateMilk")}: 0% · 🐾
          </div>
        </div>
      )}
    </div>
  );
};
