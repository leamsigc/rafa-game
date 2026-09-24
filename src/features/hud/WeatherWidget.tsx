import React from "react";
import { Sun, Sunset, Moon } from "lucide-react";
import { HolidayId } from "../../types/pet";
import { getHolidayMeta } from "../seasonal/holidays";
import { TimeOfDay, WeatherType } from "../dog3d/ParkScene";

interface WeatherWidgetProps {
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  holiday: HolidayId;
  onCycleWeather?: () => void;
}

/**
 * Dynamic Weather Widget — a living HUD chip whose icon & style react to
 * the weather AND the time of day AND the festive season:
 *   ☀️ sunny day → 🌅 sunset → 🌙 starry night
 *   🌦️ rain by day, 🌧️ rain at night, 🌨️ snow...
 *   and during Christmas the widget sparkles with ❄️ snowflakes
 *   (🎃 Halloween, 🇺🇸 4th of July, 💝 Valentine's, 🎊 New Year too).
 */
export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  weather,
  timeOfDay,
  holiday,
  onCycleWeather,
}) => {
  const holidayMeta = getHolidayMeta(holiday);
  const festive = holiday !== "none";

  // ---- Main icon: festive season wins, then weather, then time of day ----
  let mainIcon: string;
  if (holiday === "christmas") {
    mainIcon = "❄️"; // winter wonderland — always snowing festive vibes
  } else if (holiday === "newyear") {
    mainIcon = "🎊";
  } else if (weather === "snowy") {
    mainIcon = "🌨️";
  } else if (weather === "rainy") {
    mainIcon = timeOfDay === "night" ? "🌧️" : "🌦️";
  } else {
    // sunny: morning sun → golden sunset → moonlit night
    mainIcon = timeOfDay === "day" ? "☀️" : timeOfDay === "sunset" ? "🌅" : "🌙";
  }

  // ---- Labels ----
  const weatherLabel =
    holiday === "christmas"
      ? "Snowy"
      : weather === "sunny"
        ? "Sunny"
        : weather === "rainy"
          ? "Rainy"
          : "Snowy";
  const timeLabel = timeOfDay === "day" ? "Day" : timeOfDay === "sunset" ? "Sunset" : "Night";

  // ---- Time-of-day styling (gradient sky chip) ----
  let chipClass: string;
  if (holiday === "christmas") {
    chipClass = "bg-gradient-to-r from-emerald-700 to-red-700 border-red-300/60 text-white";
  } else if (holiday === "halloween") {
    chipClass = "bg-gradient-to-r from-orange-600 to-amber-700 border-orange-300/50 text-white";
  } else if (holiday === "july4") {
    chipClass = "bg-gradient-to-r from-blue-700 to-red-600 border-white/40 text-white";
  } else if (holiday === "valentines") {
    chipClass = "bg-gradient-to-r from-pink-500 to-rose-600 border-pink-200/60 text-white";
  } else if (holiday === "newyear") {
    chipClass = "bg-gradient-to-r from-violet-600 to-fuchsia-700 border-violet-300/50 text-white";
  } else if (timeOfDay === "night") {
    chipClass = "bg-gradient-to-r from-indigo-800 to-slate-800 border-indigo-300/40 text-white";
  } else if (timeOfDay === "sunset") {
    chipClass = "bg-gradient-to-r from-orange-400 to-rose-500 border-orange-200/60 text-white";
  } else {
    chipClass = "bg-gradient-to-r from-sky-400 to-amber-300 border-sky-200/60 text-slate-900";
  }

  const TimeIcon = timeOfDay === "day" ? Sun : timeOfDay === "sunset" ? Sunset : Moon;
  const timeIconColor = timeOfDay === "day" ? "text-amber-500" : timeOfDay === "sunset" ? "text-rose-100" : "text-indigo-200";

  const cycleTitle = festive
    ? `${holidayMeta!.name} season • ${weatherLabel} ${timeLabel} — click to cycle the weather!`
    : `${weatherLabel} ${timeLabel} — click to cycle the weather!`;

  return (
    <>
      <button
        onClick={onCycleWeather}
        title={cycleTitle}
        className={`px-2.5 py-1.5 rounded-2xl border shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${chipClass}`}
      >
        {/* Animated conditions icon */}
        <span
          className={festive ? "weather-icon-festive" : "weather-icon-float"}
          style={{ fontSize: "1.1rem", lineHeight: 1 }}
        >
          {mainIcon}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-none">
          <span className="text-[10px] font-black tracking-wide">
            {weatherLabel} {timeLabel}
          </span>
          {festive && (
            <span className="text-[8px] font-bold opacity-90 flex items-center gap-0.5 mt-0.5">
              {holidayMeta!.emoji} {holidayMeta!.name}
            </span>
          )}
        </span>
        {/* Time-of-day mini icon */}
        <TimeIcon className={`w-3 h-3 ${timeIconColor} shrink-0`} />
      </button>
      <style>{`
        @keyframes weatherFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes weatherSparkle {
          0%, 100% { transform: translateY(0) rotate(-6deg); filter: brightness(1); }
          50% { transform: translateY(-2px) rotate(6deg); filter: brightness(1.35); }
        }
        .weather-icon-float { display: inline-block; animation: weatherFloat 2.6s ease-in-out infinite; }
        .weather-icon-festive { display: inline-block; animation: weatherSparkle 1.6s ease-in-out infinite; }
      `}</style>
    </>
  );
};
