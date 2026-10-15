import React, { useState } from "react";
import { X, Cake, PartyPopper } from "lucide-react";
import { BirthdayDate, MONTH_NAMES, daysInMonth, formatBirthday } from "./birthdayData";

interface BirthdaySalonModalProps {
  /** The currently saved birthday (month + day), if any. */
  saved: BirthdayDate | null;
  /** True while the birthday party mode is live in the city. */
  partyActive: boolean;
  /** Save the chosen month + day (no year — dogs don't count those). */
  onSave: (b: BirthdayDate) => void;
  /** Immediately celebrate (preview the party experience). */
  onPreviewParty: () => void;
  onClose: () => void;
}

/**
 * The Cake Store's Birthday Salon: Chef Biscuit asks for the one special day
 * of the year. Only month + day are saved — never a year.
 */
export const BirthdaySalonModal: React.FC<BirthdaySalonModalProps> = ({
  saved,
  partyActive,
  onSave,
  onPreviewParty,
  onClose,
}) => {
  const [month, setMonth] = useState<number | null>(saved ? saved.month : null);
  const [day, setDay] = useState<number | null>(saved ? saved.day : null);

  const maxDay = month === null ? 31 : daysInMonth(month);
  const canSave = month !== null && day !== null && day <= maxDay;

  const pickMonth = (m: number) => {
    setMonth(m);
    // Keep the day valid when February etc. has fewer days than the pick
    const max = daysInMonth(m);
    if (day !== null && day > max) setDay(max);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#fff5f8] border border-pink-300/60 rounded-3xl shadow-2xl overflow-hidden text-[#831843] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pink-300/50 bg-[#db2777] text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-white/15">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base leading-tight">Birthday Cake Salon</h2>
              <p className="text-[10px] sm:text-[11px] text-pink-100 font-bold">
                Chef Biscuit 🐾 is taking your order
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-pink-800/60 transition-colors cursor-pointer"
            aria-label="Close birthday salon"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto">
          <p className="text-xs sm:text-sm font-bold text-pink-900/80 mb-1">
            “Woof! When’s the big day? Tell me the month and the day — no year needed, we dogs don’t
            count those!” 🎂
          </p>
          {saved && (
            <p className="text-[11px] font-bold text-pink-600 mb-3">
              Saved birthday: <span className="underline">{formatBirthday(saved)}</span>
              {partyActive ? " — and it's party time right now! 🎉" : ""}
            </p>
          )}

          {/* Month picker */}
          <div className="mt-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-pink-500 mb-1.5">
              1. Pick a month
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {MONTH_NAMES.map((name, m) => (
                <button
                  key={name}
                  onClick={() => pickMonth(m)}
                  className={`px-2 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer border-2 active:scale-95 ${
                    month === m
                      ? "bg-[#db2777] text-white border-[#db2777] shadow-md"
                      : "bg-white text-pink-900 border-pink-200 hover:border-pink-400"
                  }`}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Day picker */}
          <div className="mt-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-pink-500 mb-1.5">
              2. Pick a day
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  disabled={month === null}
                  className={`aspect-square rounded-xl text-xs font-bold transition-all border-2 active:scale-95 ${
                    month === null
                      ? "opacity-40 cursor-not-allowed bg-white text-pink-900 border-pink-100"
                      : day === d
                        ? "bg-[#db2777] text-white border-[#db2777] shadow-md cursor-pointer"
                        : "bg-white text-pink-900 border-pink-200 hover:border-pink-400 cursor-pointer"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            {month === null && (
              <p className="text-[10px] font-bold text-pink-400 mt-1.5">Pick a month first 🐾</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-pink-300/50 bg-pink-50 flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => canSave && onSave({ month: month!, day: day! })}
            disabled={!canSave}
            className={`flex-1 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${
              canSave
                ? "bg-[#db2777] hover:bg-[#be185d] text-white cursor-pointer"
                : "bg-pink-200 text-pink-400 cursor-not-allowed"
            }`}
            title={canSave ? "Save this special day" : "Pick a month and a day first"}
          >
            <Cake className="w-4 h-4" />
            {canSave ? `Save ${MONTH_NAMES[month!]} ${day}` : "Save my birthday"}
          </button>
          <button
            onClick={onPreviewParty}
            className="flex-1 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm bg-[#facc15] hover:bg-[#eab308] text-yellow-950 shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            title="Experience the birthday party right now"
          >
            <PartyPopper className="w-4 h-4" />
            Celebrate today (preview)
          </button>
        </div>
      </div>
    </div>
  );
};
