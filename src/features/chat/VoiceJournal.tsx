import React, { useState } from "react";
import { Play, RotateCcw, Mic, Sparkles, Loader2 } from "lucide-react";
import { PetStats, HolidayId } from "../../types/pet";
import { getHolidayMeta } from "../seasonal/holidays";
import { journalPayload, logDayEvent, todaySummaryText } from "../journal/dayJournal";
import { playPcmAudioChunk, resetAudioSchedule } from "../../utils/geminiLiveVoice";
import { sound } from "../../utils/audio";

interface VoiceJournalProps {
  petStats: PetStats;
  holiday: HolidayId;
  onToast?: (msg: string) => void;
}

/**
 * Voice Journal — {dog} summarizes the day's events based on your
 * interactions and achievements, then Gemini synthesizes a unique,
 * personalized AUDIO recap for you to listen to.
 */
export const VoiceJournal: React.FC<VoiceJournalProps> = ({ petStats, holiday, onToast }) => {
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const summary = todaySummaryText(petStats.name);

  const speakRecap = async (text: string) => {
    setSpeaking(true);
    try {
      const res = await fetch("/api/pet/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          resetAudioSchedule();
          playPcmAudioChunk(data.audio);
          // PCM chunks play ~10s per KB of base64 at 24kHz — rough sleep
          window.setTimeout(() => setSpeaking(false), Math.min(30000, 4000 + text.length * 90));
          return;
        }
      }
    } catch {
      // fall through to browser voice
    }
    sound.speakDogVoice(text.replace(/\*[^*]*\*/g, ""));
    window.setTimeout(() => setSpeaking(false), 3000 + text.length * 60);
  };

  const playRecap = async () => {
    if (loading) return;
    setLoading(true);
    logDayEvent("journalListens", "Listened to the daily Voice Journal recap");
    try {
      const res = await fetch("/api/pet/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petState: {
            name: petStats.name,
            breed: petStats.breed,
            level: petStats.level,
            energy: petStats.energy,
            happiness: petStats.happiness,
            hunger: petStats.hunger,
          },
          journal: journalPayload(),
          holiday,
        }),
      });
      const data = await res.json();
      const text: string = data.recap || "*yawns softly* Woof... today was a nice quiet day with you.";
      setRecap(text);
      await speakRecap(text);
    } catch {
      onToast?.("Couldn't reach the journal service — try again soon!");
      sound.playSoftWoof();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F2E8CF]/70">
      {/* Intro card */}
      <div className="bg-white rounded-2xl border border-[#386641]/15 p-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#A7C957]/30 flex items-center justify-center">
            <Mic className="w-5 h-5 text-[#386641]" />
          </div>
          <div>
            <h4 className="text-sm font-black text-[#386641]">🎙️ Voice Journal</h4>
            <p className="text-[11px] font-bold text-[#386641]/65">
              {petStats.name} summarizes your day — and reads it aloud in his own voice!
            </p>
          </div>
        </div>
        <p className="text-[11px] font-bold text-[#386641]/75 mt-3 bg-[#F2E8CF] rounded-xl px-3 py-2 border border-[#386641]/10">
          📋 {summary}
        </p>
      </div>

      {/* Play button */}
      {!recap && (
        <button
          onClick={playRecap}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#386641] to-[#6A994E] hover:from-[#2c5234] hover:to-[#5b8543] text-[#F2E8CF] font-black text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
          {loading ? "Your pup is remembering the day..." : "Play Today's Audio Recap 🎧"}
        </button>
      )}

      {/* Recap card */}
      {recap && (
        <div className="bg-white rounded-2xl border border-[#A7C957]/50 p-4 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#6A994E]" />
            <span className="text-[11px] font-black uppercase tracking-wider text-[#6A994E]">
              {petStats.name}'s Daily Recap • {new Date().toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-[#386641] font-medium italic serif">
            {recap.split(/(\*[^*]+\*)/g).map((seg, i) =>
              seg.startsWith("*") && seg.endsWith("*") ? (
                <span key={i} className="not-italic font-bold text-[#6A994E]">{seg.slice(1, -1)} </span>
              ) : (
                <span key={i}>{seg}</span>
              )
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => speakRecap(recap)}
              disabled={speaking}
              className="px-4 py-2 rounded-xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-xs shadow flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-60"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${speaking ? "animate-spin" : ""}`} />
              {speaking ? "Speaking..." : "Replay Audio"}
            </button>
            <button
              onClick={playRecap}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white border border-[#386641]/25 text-[#386641] font-black text-xs hover:bg-[#F2E8CF] cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Fresh Recap
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] font-bold text-[#386641]/50 text-center px-4">
        🎧 Powered by Gemini — your pup's recap is unique & personalized from today's
        interactions and achievements{getHolidayMeta(holiday) ? `, with a sprinkle of ${getHolidayMeta(holiday)!.name} spirit` : ""}.
      </p>
    </div>
  );
};
