import React, { useState } from "react";
import {
  X,
  Volume2,
  VolumeX,
  Volume1,
  Trees,
  Sparkles,
  Palette,
  Camera,
  Sun,
  Sunset,
  Moon,
  Check,
  Music,
  Trophy,
  ShieldCheck,
  Link2,
  BookOpen,
} from "lucide-react";
import { DogBreed, HolidayId, LinkedAccount, PetStats } from "../../types/pet";
import { TimeOfDay } from "../dog3d/ParkScene";
import { AudioSettings, sound } from "../../utils/audio";
import { ACHIEVEMENTS } from "../achievements/achievementsData";
import { getLifetime } from "../journal/dayJournal";

export type SettingsTab = "audio" | "pet" | "environment" | "achievements" | "account";

interface SettingsModalProps {
  currentBreed: DogBreed;
  currentCollar: string;
  dogName: string;
  timeOfDay: TimeOfDay;
  followCamera: boolean;
  stats: PetStats;
  account: LinkedAccount | null;
  holiday: HolidayId;
  onUpdateTimeOfDay: (time: TimeOfDay) => void;
  onUpdateFollowCamera: (follow: boolean) => void;
  onUpdateBreed: (breed: DogBreed) => void;
  onUpdateCollar: (collar: string) => void;
  onUpdateName: (name: string) => void;
  onLinkAccount: () => void;
  onOpenBreedJournal: () => void;
  onOpenScoreboard: () => void;
  onClose: () => void;
  initialTab?: SettingsTab;
}

const BREEDS: { id: DogBreed; name: string; icon: string; desc: string }[] = [
  { id: "golden", name: "Golden Retriever", icon: "🦮", desc: "Friendly, gentle golden coat" },
  { id: "chocolate", name: "Chocolate Lab", icon: "🐕", desc: "Rich dark cocoa brown coat" },
  { id: "husky", name: "Siberian Husky", icon: "🐺", desc: "Silver slate coat with snowy markings" },
  { id: "dalmatian", name: "Dalmatian", icon: "🐾", desc: "Classic white coat with playful black spots" },
  { id: "corgi", name: "Pembroke Corgi", icon: "🦊", desc: "Vibrant fox-copper and cream coat" },
];

const COLLAR_COLORS = [
  { name: "Ruby Red", hex: "#e11d48" },
  { name: "Sapphire Blue", hex: "#0284c7" },
  { name: "Emerald Green", hex: "#16a34a" },
  { name: "Sunburst Gold", hex: "#d97706" },
  { name: "Amethyst Purple", hex: "#9333ea" },
  { name: "Midnight Black", hex: "#1e293b" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentBreed,
  currentCollar,
  dogName,
  timeOfDay,
  followCamera,
  stats,
  account,
  holiday,
  onUpdateTimeOfDay,
  onUpdateFollowCamera,
  onUpdateBreed,
  onUpdateCollar,
  onUpdateName,
  onLinkAccount,
  onOpenBreedJournal,
  onOpenScoreboard,
  onClose,
  initialTab = "audio",
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => sound.getSettings());
  const unlockedSet = new Set(stats.unlockedAchievements || []);

  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    sound.setMasterVolume(val);
    setAudioSettings(sound.getSettings());
  };

  const handleAmbientVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    sound.setAmbientVolume(val);
    setAudioSettings(sound.getSettings());
  };

  const handleSfxVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    sound.setSfxVolume(val);
    setAudioSettings(sound.getSettings());
  };

  const handleToggleAmbient = () => {
    const next = !audioSettings.ambientEnabled;
    sound.setAmbientEnabled(next);
    setAudioSettings(sound.getSettings());
  };

  const handleToggleSfx = () => {
    const next = !audioSettings.sfxEnabled;
    sound.setSfxEnabled(next);
    setAudioSettings(sound.getSettings());
  };

  const handleTestBirdChirp = () => {
    sound.setAmbientEnabled(true);
    sound.playBirdChirp();
    setAudioSettings(sound.getSettings());
  };

  const handleTestBark = () => {
    sound.setSfxEnabled(true);
    sound.playBark("normal");
    setAudioSettings(sound.getSettings());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#F2E8CF] border border-[#386641]/20 rounded-3xl shadow-2xl overflow-hidden text-[#386641] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#386641]/20 bg-[#386641] text-[#F2E8CF]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-[#A7C957]/20 text-[#A7C957]">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Settings & Audio</h3>
              <p className="text-[11px] text-[#A7C957]/90 font-medium">
                Customize soundscape, companion styling, and park ambiance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!account && (
              <button
                onClick={() => { sound.playButtonTap(); onLinkAccount(); }}
                title="Link your Google account (+100 XP, +50 Coins, verified shield on the scoreboard)"
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[11px] shadow flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
              >
                <Link2 className="w-3.5 h-3.5" /> Link Account
              </button>
            )}
            {account && (
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 text-[#A7C957] font-black text-[11px] border border-white/15">
                <ShieldCheck className="w-3.5 h-3.5 fill-[#A7C957]/30" /> {account.name}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[#2c5234] text-[#F2E8CF] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-[#386641]/15 bg-white/40 px-3 pt-2 gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("audio")}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
              activeTab === "audio"
                ? "bg-[#F2E8CF] text-[#386641] border-t-2 border-x border-b-0 border-[#386641]/20 shadow-xs"
                : "text-[#386641]/70 hover:text-[#386641] hover:bg-white/60"
            }`}
          >
            <Music className="w-3.5 h-3.5 text-[#386641]" />
            <span>Audio</span>
          </button>
          <button
            onClick={() => setActiveTab("pet")}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
              activeTab === "pet"
                ? "bg-[#F2E8CF] text-[#386641] border-t-2 border-x border-b-0 border-[#386641]/20 shadow-xs"
                : "text-[#386641]/70 hover:text-[#386641] hover:bg-white/60"
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-[#386641]" />
            <span>Pet Styling</span>
          </button>
          <button
            onClick={() => setActiveTab("environment")}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
              activeTab === "environment"
                ? "bg-[#F2E8CF] text-[#386641] border-t-2 border-x border-b-0 border-[#386641]/20 shadow-xs"
                : "text-[#386641]/70 hover:text-[#386641] hover:bg-white/60"
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-[#386641]" />
            <span>Atmosphere</span>
          </button>
          <button
            onClick={() => setActiveTab("achievements")}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
              activeTab === "achievements"
                ? "bg-[#F2E8CF] text-[#386641] border-t-2 border-x border-b-0 border-[#386641]/20 shadow-xs"
                : "text-[#386641]/70 hover:text-[#386641] hover:bg-white/60"
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Achievements</span>
          </button>
          <button
            onClick={() => setActiveTab("account")}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
              activeTab === "account"
                ? "bg-[#F2E8CF] text-[#386641] border-t-2 border-x border-b-0 border-[#386641]/20 shadow-xs"
                : "text-[#386641]/70 hover:text-[#386641] hover:bg-white/60"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>Account & Sync</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* TAB 1: AUDIO & AMBIANCE CONTROLS */}
          {activeTab === "audio" && (
            <div className="space-y-4">
              {/* 1. Background Ambient Park Track */}
              <div className="bg-white rounded-2xl p-4 border border-[#386641]/15 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#A7C957]/30 text-[#386641]">
                      <Trees className="w-4 h-4 text-[#386641]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-[#386641]">
                          Park Ambient Track
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#A7C957]/40 text-[#386641]">
                          Looping Birds & Breeze
                        </span>
                      </div>
                      <p className="text-xs text-[#386641]/70 mt-0.5">
                        Soft birds chirping, gentle rustling leaves, and natural breeze
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={handleToggleAmbient}
                    title={audioSettings.ambientEnabled ? "Mute Ambient Track" : "Enable Ambient Track"}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      audioSettings.ambientEnabled
                        ? "bg-[#386641] text-[#F2E8CF]"
                        : "bg-black/5 text-[#386641]/60 hover:bg-black/10"
                    }`}
                  >
                    {audioSettings.ambientEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#A7C957]" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>Muted</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5 text-[#386641]/80">
                    <span className="flex items-center gap-1">
                      <Volume1 className="w-3.5 h-3.5" />
                      Ambient Volume
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#F2E8CF] text-[#386641]">
                      {Math.round(audioSettings.ambientVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={audioSettings.ambientVolume}
                    onChange={handleAmbientVolumeChange}
                    className="w-full accent-[#386641] h-2 bg-[#386641]/15 rounded-lg cursor-pointer transition-all"
                  />
                </div>

                {/* Quick Test Bird Chirp Action */}
                <div className="flex items-center justify-between pt-1 border-t border-[#386641]/10 text-xs">
                  <span className="text-[11px] text-[#386641]/70 italic">
                    Procedural songbird audio synthesizer
                  </span>
                  <button
                    onClick={handleTestBirdChirp}
                    className="px-2.5 py-1 rounded-lg bg-[#A7C957]/30 hover:bg-[#A7C957]/50 text-[#386641] font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>🎶 Test Bird Chirp</span>
                  </button>
                </div>
              </div>

              {/* 2. Sound Effects (SFX) */}
              <div className="bg-white rounded-2xl p-4 border border-[#386641]/15 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#BC4749]/15 text-[#BC4749]">
                      <Sparkles className="w-4 h-4 text-[#BC4749]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#386641]">Sound Effects (SFX)</h4>
                      <p className="text-xs text-[#386641]/70 mt-0.5">
                        Interactive barks, ball bounces, treat crunches & whistles
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleSfx}
                    title={audioSettings.sfxEnabled ? "Mute SFX" : "Enable SFX"}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      audioSettings.sfxEnabled
                        ? "bg-[#386641] text-[#F2E8CF]"
                        : "bg-black/5 text-[#386641]/60 hover:bg-black/10"
                    }`}
                  >
                    {audioSettings.sfxEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#A7C957]" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>Muted</span>
                      </>
                    )}
                  </button>
                </div>

                {/* SFX Volume Slider */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5 text-[#386641]/80">
                    <span className="flex items-center gap-1">
                      <Volume1 className="w-3.5 h-3.5" />
                      SFX Volume
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#F2E8CF] text-[#386641]">
                      {Math.round(audioSettings.sfxVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={audioSettings.sfxVolume}
                    onChange={handleSfxVolumeChange}
                    className="w-full accent-[#386641] h-2 bg-[#386641]/15 rounded-lg cursor-pointer transition-all"
                  />
                </div>

                {/* Test Bark Action */}
                <div className="flex items-center justify-between pt-1 border-t border-[#386641]/10 text-xs">
                  <span className="text-[11px] text-[#386641]/70 italic">
                    Realistic canine bark with vocal resonance
                  </span>
                  <button
                    onClick={handleTestBark}
                    className="px-2.5 py-1 rounded-lg bg-[#BC4749]/15 hover:bg-[#BC4749]/25 text-[#BC4749] font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>🐕 Test Bark</span>
                  </button>
                </div>
              </div>

              {/* 3. Master Volume */}
              <div className="bg-white/80 rounded-2xl p-4 border border-[#386641]/15 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#386641]">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-[#386641]" />
                    Master Volume
                  </span>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-[#386641] text-[#F2E8CF]">
                    {Math.round(audioSettings.masterVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={audioSettings.masterVolume}
                  onChange={handleMasterVolumeChange}
                  className="w-full accent-[#386641] h-2.5 bg-[#386641]/20 rounded-lg cursor-pointer transition-all"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PET STYLING & BREED */}
          {activeTab === "pet" && (
            <div className="space-y-4">
              {/* Pet Name Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#386641] mb-1.5">
                  Companion Name
                </label>
                <input
                  type="text"
                  value={dogName}
                  onChange={(e) => onUpdateName(e.target.value)}
                  maxLength={20}
                  className="w-full bg-white border border-[#386641]/25 rounded-xl px-4 py-2.5 text-sm text-[#386641] font-bold focus:outline-none focus:border-[#386641] focus:ring-1 focus:ring-[#386641] transition-colors"
                />
              </div>

              {/* Breed Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#386641] mb-2">
                  Select Breed & Fur Coat
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {BREEDS.map((breed) => {
                    const isSelected = currentBreed === breed.id;
                    return (
                      <button
                        key={breed.id}
                        onClick={() => onUpdateBreed(breed.id)}
                        className={`p-3 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-white border-2 border-[#386641] text-[#386641] shadow-sm"
                            : "bg-white/80 hover:bg-white border border-[#386641]/15 text-[#386641]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{breed.icon}</span>
                          <div>
                            <div className="text-sm font-black text-[#386641] leading-tight">
                              {breed.name}
                            </div>
                            <div className="text-xs text-[#386641]/70">{breed.desc}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#386641]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Collar Colors */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#386641] mb-2">
                  Collar Color
                </label>
                <div className="flex items-center gap-3 flex-wrap bg-white p-3 rounded-2xl border border-[#386641]/15">
                  {COLLAR_COLORS.map((color) => {
                    const isSelected = currentCollar.toLowerCase() === color.hex.toLowerCase();
                    return (
                      <button
                        key={color.hex}
                        onClick={() => onUpdateCollar(color.hex)}
                        title={color.name}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
                          isSelected ? "ring-3 ring-[#386641] ring-offset-2" : ""
                        }`}
                        style={{ backgroundColor: color.hex }}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PARK ENVIRONMENT & ATMOSPHERE */}
          {activeTab === "environment" && (
            <div className="space-y-4">
              {/* Time of Day */}
              <div className="bg-white rounded-2xl p-4 border border-[#386641]/15 shadow-xs space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#386641]">
                  Time of Day & Sun Angle
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      onUpdateTimeOfDay("day");
                      sound.setNightMode(false);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                      timeOfDay === "day"
                        ? "bg-[#F2E8CF] border-2 border-[#386641] text-[#386641] font-black"
                        : "bg-white/80 hover:bg-white border-[#386641]/15 text-[#386641]/80"
                    }`}
                  >
                    <Sun className="w-5 h-5 text-[#D4A373]" />
                    <span className="text-xs">Bright Day</span>
                  </button>

                  <button
                    onClick={() => {
                      onUpdateTimeOfDay("sunset");
                      sound.setNightMode(false);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                      timeOfDay === "sunset"
                        ? "bg-[#F2E8CF] border-2 border-[#386641] text-[#386641] font-black"
                        : "bg-white/80 hover:bg-white border-[#386641]/15 text-[#386641]/80"
                    }`}
                  >
                    <Sunset className="w-5 h-5 text-[#BC4749]" />
                    <span className="text-xs">Golden Sunset</span>
                  </button>

                  <button
                    onClick={() => {
                      onUpdateTimeOfDay("night");
                      sound.setNightMode(true);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                      timeOfDay === "night"
                        ? "bg-[#F2E8CF] border-2 border-[#386641] text-[#386641] font-black"
                        : "bg-white/80 hover:bg-white border-[#386641]/15 text-[#386641]/80"
                    }`}
                  >
                    <Moon className="w-5 h-5 text-[#386641]" />
                    <span className="text-xs">Starlight Night</span>
                  </button>
                </div>
              </div>

              {/* Camera Tracking */}
              <div className="bg-white rounded-2xl p-4 border border-[#386641]/15 shadow-xs space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#386641]">
                  Camera Perspective
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onUpdateFollowCamera(true)}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      followCamera
                        ? "bg-[#386641] text-[#F2E8CF] border-[#386641] font-bold"
                        : "bg-white hover:bg-[#F2E8CF] border-[#386641]/20 text-[#386641]"
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span className="text-xs">Follow Companion</span>
                  </button>

                  <button
                    onClick={() => onUpdateFollowCamera(false)}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      !followCamera
                        ? "bg-[#386641] text-[#F2E8CF] border-[#386641] font-bold"
                        : "bg-white hover:bg-[#F2E8CF] border-[#386641]/20 text-[#386641]"
                    }`}
                  >
                    <span className="text-xs">Free Park Orbit</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* TAB 4: ACHIEVEMENTS & BADGES */}
          {activeTab === "achievements" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#386641]">
                  🏅 Milestone Badges ({unlockedSet.size}/{ACHIEVEMENTS.length})
                </h4>
                <button
                  onClick={() => { sound.playButtonTap(); onOpenBreedJournal(); }}
                  className="px-3 py-1.5 rounded-xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-[11px] flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Breed Journal
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {ACHIEVEMENTS.map((a) => {
                  const unlocked = unlockedSet.has(a.id);
                  const prog = a.progress({
                    stats,
                    lifetime: getLifetime(),
                    holiday,
                  });
                  return (
                    <div
                      key={a.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        unlocked
                          ? "bg-gradient-to-br from-amber-100 to-[#A7C957]/25 border-amber-400 shadow-sm"
                          : "bg-white/80 border-[#386641]/12"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`text-2xl ${unlocked ? "" : "grayscale opacity-40"}`}>{a.icon}</span>
                        <div className="min-w-0">
                          <div className={`text-[11px] font-black truncate ${unlocked ? "text-[#386641]" : "text-[#386641]/50"}`}>
                            {a.name}
                          </div>
                          <div className="text-[9px] font-bold text-[#386641]/60 leading-tight">
                            {a.description}
                          </div>
                        </div>
                      </div>
                      {!unlocked && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-[#386641]/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#6A994E] rounded-full transition-all"
                              style={{ width: `${Math.min(100, (prog.current / prog.goal) * 100)}%` }}
                            />
                          </div>
                          <div className="text-[9px] font-black text-[#386641]/50 mt-0.5 text-right">
                            {prog.current} / {prog.goal}
                          </div>
                        </div>
                      )}
                      {unlocked && (
                        <div className="mt-1.5 text-[9px] font-black text-amber-700 flex items-center gap-1">
                          <Check className="w-3 h-3" /> UNLOCKED
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: ACCOUNT & SYNC (Google Account Linking) */}
          {activeTab === "account" && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-[#386641]/15 shadow-xs space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black text-[#386641]">Google Account Linking</h4>
                    <p className="text-[11px] font-bold text-[#386641]/65 leading-snug">
                      Verify your trainer account, earn +100 XP & +50 Coins, get a Google Verified
                      shield badge on the Online Scoreboard, and sync your companion's progress.
                    </p>
                  </div>
                </div>

                {account ? (
                  <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-2xl p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-black">
                        {account.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-black text-[#386641] flex items-center gap-1.5">
                          {account.name}
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-600 fill-sky-200" />
                        </div>
                        <div className="text-[10px] font-bold text-[#386641]/60">
                          {account.email || "Google-verified trainer"} • linked{" "}
                          {new Date(account.linkedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-1">
                      ✅ Synced
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => { sound.playButtonTap(); onLinkAccount(); }}
                    className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs shadow flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
                  >
                    <Link2 className="w-4 h-4" /> Link Account (Google Sign-In)
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#386641]/15 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-[#386641]">Breed Discovery Journal</h4>
                    <p className="text-[11px] font-bold text-[#386641]/65">
                      Trivia, origins & fun facts — new breeds unlock as you level up!
                    </p>
                  </div>
                  <button
                    onClick={() => { sound.playButtonTap(); onOpenBreedJournal(); }}
                    className="px-3 py-2 rounded-xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-black text-[11px] flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform shrink-0"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Open Journal
                  </button>
                </div>
                <div className="flex items-center justify-between border-t border-[#386641]/10 pt-2.5">
                  <div>
                    <h4 className="text-sm font-black text-[#386641]">Online Scoreboard</h4>
                    <p className="text-[11px] font-bold text-[#386641]/65">
                      Global trainer rankings — levels, XP & discovered breeds.
                    </p>
                  </div>
                  <button
                    onClick={() => { sound.playButtonTap(); onOpenScoreboard(); }}
                    className="px-3 py-2 rounded-xl bg-[#6A994E] hover:bg-[#5b8543] text-white font-black text-[11px] flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform shrink-0"
                  >
                    <Trophy className="w-3.5 h-3.5" /> View Rankings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#386641]/15 bg-white/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#386641] hover:bg-[#2c5234] text-[#F2E8CF] font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
