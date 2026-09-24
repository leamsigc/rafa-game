import React, { useState } from "react";
import {
  Sparkles,
  Volume2,
  VolumeX,
  Sun,
  Sunset,
  Moon,
  Camera,
  Settings,
  Heart,
  Zap,
  Utensils,
  Gamepad2,
  MessageCircle,
  Coins,
  Award,
  GraduationCap,
  CircleDot,
  Lock,
  Mic,
  Home,
  ShoppingBag,
  Lightbulb,
  Bed,
  Trees,
  Pencil,
  ChevronUp,
  ChevronDown,
  Axe,
  Aperture,
  Images,
  Focus,
  BookOpen,
  Flame,
} from "lucide-react";
import { DogAction, HolidayId, PetStats, HouseRoom, HouseViewMode } from "../../types/pet";
import { DogEmotion, getEmotionMeta } from "../emotions/emotion";
import { TimeOfDay, WeatherType } from "../dog3d/ParkScene";
import { WeatherWidget } from "./WeatherWidget";
import dogAvatar from "../../assets/images/dog_avatar_1788547305164.jpg";
import { SKILL_NODES } from "../skills/skillTreeData";

interface PetActionButtonsProps {
  stats: PetStats;
  emotion: DogEmotion;
  currentAction: DogAction;
  timeOfDay: TimeOfDay;
  soundEnabled: boolean;
  followCamera: boolean;
  viewMode?: HouseViewMode;
  houseRoom?: HouseRoom;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  onActionClick: (action: DogAction) => void;
  onFeedClick: () => void;
  onPlayFetch: () => void;
  onPetClick: () => void;
  onTrainClick: () => void;
  onOpenChat: () => void;
  onOpenMiniGames: () => void;
  onOpenCooking?: () => void;
  onSwitchRoom?: (room: HouseRoom) => void;
  onOpenCustomizer: () => void;
  onToggleTimeOfDay: () => void;
  onToggleSound: () => void;
  onToggleCamera: () => void;
  onOpenSkillTree: () => void;
  onOpenSettings: (tab?: "audio" | "pet" | "environment") => void;
  onToggleViewMode?: () => void;
  onOpenShop?: () => void;
  onGoToBed?: () => void;
  onToggleLamp?: () => void;
  onTakeSnapshot?: () => void;
  onOpenAlbum?: () => void;
  albumCount?: number;
  weather?: WeatherType;
  onCycleWeather?: () => void;
  /** Festive season — the weather widget shows holiday icons (❄️ at Christmas...). */
  holiday?: HolidayId;
  onOpenPhotoMode?: () => void;
  onOpenBreedJournal?: () => void;
  /** Consecutive login days (shows the 🔥 streak chip). */
  streakDays?: number;
}

interface TrickItem {
  action: DogAction;
  label: string;
  icon: string;
  energyCost: number;
  skillId?: string;
}

const ALL_TRICKS: TrickItem[] = [
  { action: "sit", label: "Sit & Stay", icon: "🐾", energyCost: 2 },
  { action: "bark", label: "Happy Bark", icon: "🐕", energyCost: 3 },
  { action: "roll", label: "Roll Over", icon: "🔄", energyCost: 6, skillId: "roll_over" },
  { action: "spin", label: "Spin Trick", icon: "💫", energyCost: 6, skillId: "tornado_spin" },
  { action: "dance", label: "Tap Dance", icon: "🕺", energyCost: 8, skillId: "tap_dance" },
  { action: "backflip", label: "Backflip", icon: "🤸", energyCost: 12, skillId: "aerial_backflip" },
  { action: "cuddle", label: "Cozy Cuddle", icon: "🧸", energyCost: 0, skillId: "cozy_cuddle" },
  { action: "zoomies", label: "Zoomies", icon: "⚡", energyCost: 10, skillId: "park_zoomies" },
  { action: "howl", label: "Heartfelt Awoo", icon: "🎶", energyCost: 4, skillId: "musical_howl" },
  { action: "handshake", label: "Give Paw", icon: "✋", energyCost: 4, skillId: "handshake_paw" },
  { action: "rest", label: "Take Nap", icon: "💤", energyCost: -20 }, // restores energy
];

export const PetActionButtons: React.FC<PetActionButtonsProps> = ({
  stats,
  emotion,
  currentAction,
  timeOfDay,
  soundEnabled,
  followCamera,
  viewMode = "park",
  houseRoom = "living",
  editMode = false,
  onToggleEditMode,
  onActionClick,
  onFeedClick,
  onPlayFetch,
  onPetClick,
  onTrainClick,
  onOpenChat,
  onOpenMiniGames,
  onOpenCooking,
  onSwitchRoom,
  onOpenCustomizer,
  onToggleTimeOfDay,
  onToggleSound,
  onToggleCamera,
  onOpenSkillTree,
  onOpenSettings,
  onToggleViewMode,
  onOpenShop,
  onGoToBed,
  onToggleLamp,
  onTakeSnapshot,
  onOpenAlbum,
  albumCount = 0,
  weather = "sunny",
  onCycleWeather,
  holiday = "none",
  onOpenPhotoMode,
  onOpenBreedJournal,
  streakDays = 1,
}) => {
  const unlockedSet = new Set(stats.unlockedSkills || []);
  const hasAxe = (stats.ownedTools || []).includes("axe");
  const isHouse = viewMode === "house";
  const isCity = viewMode === "city";
  const isArcade = viewMode === "arcade";
  const isAway = isCity || isArcade; // away-from-home worlds (city & galaxy arcade)
  const isKitchen = isHouse && houseRoom === "kitchen";
  const isHallway = isHouse && houseRoom === "hallway";
  const roomLabel = isArcade
    ? "🌌 Galaxy Arcade"
    : isCity
    ? "🏙️ City Park"
    : !isHouse
    ? "🌳 Park"
    : houseRoom === "kitchen"
      ? "🍳 Kitchen"
      : houseRoom === "hallway"
        ? "🚪 Hallway"
        : houseRoom === "upstairs"
          ? "🛏️ Upstairs"
          : "🛋️ Living Room";

  // Mobile-friendly collapsible panels: little arrows hide/show each
  // control group (top, tricks, bottom). Tap ▼ to slide down, ▲ to bring up.
  const [topHidden, setTopHidden] = useState(false);
  const [tricksHidden, setTricksHidden] = useState(false);
  const [bottomHidden, setBottomHidden] = useState(false);

  const arrowBtn =
    "pointer-events-auto p-2 rounded-full bg-[#1f2937]/80 hover:bg-[#1f2937] text-white shadow-lg border border-white/20 transition-all active:scale-95 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center";

  return (
    <div
      className="absolute inset-0 pointer-events-none flex flex-col justify-between gap-2 p-3 sm:p-4 select-none"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {/* Top HUD: Vitality, Skills Level & Environment Settings */}
      {topHidden ? (
        <div className="flex justify-center pointer-events-auto">
          <button className={arrowBtn} onClick={() => setTopHidden(false)} aria-label="Show top controls" title="Show stats & settings">
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      ) : (
      <div className="flex items-start justify-between gap-2 pointer-events-auto">
        <div className="flex flex-col gap-1.5">
          <button className={`${arrowBtn} self-start !min-w-[32px] !min-h-[32px] !p-1.5`} onClick={() => setTopHidden(true)} aria-label="Hide top controls" title="Hide stats (tap ▼ to bring back)">
            <ChevronUp className="w-4 h-4" />
          </button>
        {/* Left: Pet profile & status meters */}
        <div className="bg-[#F2E8CF]/95 backdrop-blur-md border border-[#386641]/20 rounded-3xl p-3 sm:p-3.5 shadow-xl shadow-[#386641]/10 flex items-center gap-3.5 max-w-sm sm:max-w-md text-[#386641]">
          {/* Avatar button */}
          <button
            onClick={() => onOpenSettings("pet")}
            title="Open Pet Styling & Settings"
            className="relative group shrink-0 cursor-pointer"
          >
            <img
              src={dogAvatar}
              alt={stats.name}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl object-cover border-2 border-[#BC4749] shadow-sm group-hover:scale-105 transition-transform"
            />
            <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-[#386641] text-[#F2E8CF] border border-white shadow-xs">
              <Settings className="w-3 h-3" />
            </span>
          </button>

          {/* Details & Bars */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 truncate">
                <h1 className="text-sm font-black text-[#386641] truncate">{stats.name}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#A7C957]/40 text-[#386641] border border-[#6A994E]/30">
                  Lvl {stats.level}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  {roomLabel}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {streakDays >= 2 && (
                  <span
                    title={`Daily Login Streak: ${streakDays} days in a row! Bonuses at 3, 7 and 30 days.`}
                    className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-0.5"
                  >
                    <Flame className="w-3 h-3 text-orange-500 fill-orange-400" /> {streakDays}d
                  </span>
                )}
                <span
                  title={getEmotionMeta(emotion).blurb}
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getEmotionMeta(emotion).badge}`}
                >
                  {getEmotionMeta(emotion).emoji} {stats.name} feels {getEmotionMeta(emotion).label}
                </span>
              </div>

              {/* Coin Rewards / Shop */}
              <button
                id="hud-coins-button"
                onClick={onOpenShop || onOpenSkillTree}
                title="Click to open Shop & Bed Customizer"
                className="flex items-center gap-1 text-xs font-black text-[#386641] bg-white hover:bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 shadow-xs shrink-0 cursor-pointer transition-colors"
              >
                <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{stats.coins}</span>
                <span className="text-[9px] text-amber-800 uppercase">Coins</span>
              </button>
            </div>

            {/* Vitality Meters */}
            <div className="mt-2 grid grid-cols-3 gap-2">
              {/* Energy */}
              <div title={`Energy: ${stats.energy}%`}>
                <div className="flex items-center justify-between text-[10px] font-bold text-[#386641]/90 mb-0.5">
                  <span className="flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5 text-[#6A994E]" />
                    Energy
                  </span>
                  <span>{stats.energy}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#386641]/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#A7C957] transition-all duration-300"
                    style={{ width: `${Math.min(100, stats.energy)}%` }}
                  />
                </div>
              </div>

              {/* Happiness */}
              <div title={`Happiness / Joy: ${stats.happiness}%`}>
                <div className="flex items-center justify-between text-[10px] font-bold text-[#386641]/90 mb-0.5">
                  <span className="flex items-center gap-0.5">
                    <Heart className="w-2.5 h-2.5 text-[#BC4749]" />
                    Joy
                  </span>
                  <span>{stats.happiness}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#386641]/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#6A994E] transition-all duration-300"
                    style={{ width: `${Math.min(100, stats.happiness)}%` }}
                  />
                </div>
              </div>

              {/* Hunger */}
              <div title={`Hunger: ${stats.hunger}%`}>
                <div className="flex items-center justify-between text-[10px] font-bold text-[#386641]/90 mb-0.5">
                  <span className="flex items-center gap-0.5">
                    <Utensils className="w-2.5 h-2.5 text-[#BC4749]" />
                    Hunger
                  </span>
                  <span>{stats.hunger}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#386641]/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#BC4749] transition-all duration-300"
                    style={{ width: `${Math.min(100, stats.hunger)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Right: Environment & Audio Controls */}
        <div className="flex items-center justify-end flex-wrap gap-1.5 max-w-[46vw] sm:max-w-none bg-[#F2E8CF]/95 backdrop-blur-md border border-[#386641]/20 rounded-3xl p-1.5 shadow-xl shadow-[#386641]/10 text-[#386641]">
          {/* Shop button */}
          <button
            id="hud-shop-button"
            onClick={onOpenShop}
            title="Open House Shop: Bed Colors, Hats, Bowties, Toys"
            className={`px-3 py-2 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
              isHouse
                ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-amber-500/30 scale-105"
                : "bg-white/80 hover:bg-white text-amber-900"
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-amber-600 fill-amber-500" />
            <span>Shop</span>
          </button>

          {/* Toggle House / Park Button */}
          {onToggleViewMode && (
            <button
              id="hud-toggle-viewmode-button"
              onClick={onToggleViewMode}
              title={isAway ? "Head back home" : isHouse ? "Exit to Outdoor Park Lawn" : "Enter Dog House Room"}
              className="p-2.5 rounded-2xl bg-white/80 hover:bg-white text-[#386641] transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
            >
              {isAway ? (
                <>
                  <Home className="w-4 h-4 text-amber-700" />
                  <span className="hidden sm:inline">Go Home</span>
                </>
              ) : isHouse ? (
                <>
                  <Trees className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Park</span>
                </>
              ) : (
                <>
                  <Home className="w-4 h-4 text-amber-700" />
                  <span className="hidden sm:inline">House</span>
                </>
              )}
            </button>
          )}

          {/* If inside house: Sleep in Bed Button */}
          {isHouse && onGoToBed && (
            <button
              id="hud-bed-sleep-button"
              onClick={onGoToBed}
              title="Put Dog to Sleep in Bed (Restores 100% Energy)"
              className="p-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
            >
              <Bed className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Sleep</span>
            </button>
          )}

          {/* If inside house: Ceiling Lamp Button */}
          {isHouse && onToggleLamp && (
            <button
              id="hud-lamp-toggle-button"
              onClick={onToggleLamp}
              title="Toggle Ceiling Lamp"
              className="p-2.5 rounded-2xl hover:bg-white active:bg-[#F2E8CF] text-amber-600 transition-colors cursor-pointer"
            >
              <Lightbulb className="w-4 h-4" />
            </button>
          )}

          {/* Skill Tree Quick Button */}
          <button
            onClick={onOpenSkillTree}
            title="Canine Skill Tree"
            className="p-2.5 rounded-2xl bg-white/80 hover:bg-white text-[#386641] transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
          >
            <GraduationCap className="w-4 h-4 text-[#386641]" />
            <span className="hidden sm:inline">Skills</span>
          </button>

          {/* Dynamic Weather Widget: icon reacts to weather + time of day +
              festive season (❄️ Christmas, 🎃 Halloween, 🇺🇸 July 4...) */}
          {onCycleWeather && (
            <WeatherWidget
              weather={weather}
              timeOfDay={timeOfDay}
              holiday={holiday}
              onCycleWeather={onCycleWeather}
            />
          )}

          {/* Time of day toggle */}
          <button
            onClick={onToggleTimeOfDay}
            title={`Current: ${timeOfDay}. Click to change atmosphere`}
            className="p-2.5 rounded-2xl hover:bg-white active:bg-[#F2E8CF] text-[#386641] transition-colors cursor-pointer"
          >
            {timeOfDay === "day" ? (
              <Sun className="w-4 h-4 text-[#D4A373]" />
            ) : timeOfDay === "sunset" ? (
              <Sunset className="w-4 h-4 text-[#BC4749]" />
            ) : (
              <Moon className="w-4 h-4 text-[#386641]" />
            )}
          </button>

          {/* Audio toggle & volume controls */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? "Mute All Audio (Click Settings for Volume Sliders)" : "Unmute Audio"}
            className="p-2.5 rounded-2xl hover:bg-white active:bg-[#F2E8CF] text-[#386641] transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#6A994E]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#386641]/40" />
            )}
          </button>

          {/* Settings & Volume Sliders Menu button */}
          <button
            onClick={() => onOpenSettings("audio")}
            title="Settings & Audio Volume Sliders"
            className="p-2.5 rounded-2xl hover:bg-white active:bg-[#F2E8CF] text-[#386641] transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Camera follow toggle */}
          <button
            onClick={onToggleCamera}
            title={followCamera ? "Camera: Following Pet" : "Camera: Free Orbit"}
            className={`p-2.5 rounded-2xl transition-colors cursor-pointer ${
              followCamera ? "bg-[#386641] text-[#F2E8CF]" : "hover:bg-white active:bg-[#F2E8CF] text-[#386641]"
            }`}
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Furniture edit mode toggle */}
          {onToggleEditMode && (
            <button
              onClick={onToggleEditMode}
              title={editMode ? "Exit furniture edit mode" : "Edit mode: move & rotate furniture"}
              className={`p-2.5 rounded-2xl transition-colors cursor-pointer ${
                editMode ? "bg-amber-500 text-white" : "hover:bg-white active:bg-[#F2E8CF] text-[#386641]"
              }`}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}

          {/* Memory Album: snap a photo anytime */}
          {onTakeSnapshot && (
            <button
              onClick={onTakeSnapshot}
              title="Take a snapshot of your dog right now!"
              className="p-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 transition-colors cursor-pointer"
            >
              <Aperture className="w-4 h-4" />
            </button>
          )}

          {/* PHOTO MODE: dedicated unobstructed viewfinder & pose director */}
          {onOpenPhotoMode && (
            <button
              onClick={onOpenPhotoMode}
              title="Photo Mode: hide the HUD, pose your dog, pick filters & snap a photo!"
              className="px-3 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-violet-500 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <Focus className="w-4 h-4" />
              <span className="hidden sm:inline">Photo Mode</span>
            </button>
          )}

          {/* Breed Discovery Journal */}
          {onOpenBreedJournal && (
            <button
              onClick={onOpenBreedJournal}
              title="Breed Discovery Journal — trivia, origins & the Online Scoreboard"
              className="p-2.5 rounded-2xl bg-white/80 hover:bg-white text-[#386641] transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          )}

          {/* Memory Album gallery */}
          {onOpenAlbum && (
            <button
              onClick={onOpenAlbum}
              title={`Open Memory Album (${albumCount} photos)`}
              className="relative p-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 transition-colors cursor-pointer"
            >
              <Images className="w-4 h-4" />
              {albumCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center border border-white">
                  {albumCount > 99 ? "99+" : albumCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
      )}

      {/* Multi-room House switcher: Living <-> Hallway <-> Kitchen */}
      {isHouse && onSwitchRoom && (
        <div className="pointer-events-auto self-start flex items-center gap-1.5 bg-[#1f2937]/85 backdrop-blur-md border border-white/15 rounded-full p-1.5 shadow-xl">
          <button
            onClick={() => onSwitchRoom("living")}
            title="Go to Living Room (toys, lamp)"
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              houseRoom === "living" ? "bg-[#F2E8CF] text-[#386641] shadow" : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
          >
            🛋️ Living
          </button>
          <button
            onClick={() => onSwitchRoom("hallway")}
            title="Go to Hallway (doors + stairs up)"
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              isHallway ? "bg-violet-500 text-white shadow" : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
          >
            🚪 Hall
          </button>
          <button
            onClick={() => onSwitchRoom("kitchen")}
            title="Go to Kitchen (cooking pot)"
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              isKitchen ? "bg-orange-500 text-white shadow" : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
          >
            🍳 Kitchen
          </button>
          {onOpenCooking && (
            <button
              onClick={onOpenCooking}
              title={`Open cooking pot to cook for ${stats.name}`}
              className="px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-400 hover:bg-amber-300 text-amber-950 transition-all cursor-pointer shadow"
            >
              🍲 Cook!
            </button>
          )}
        </div>
      )}

      {/* Floating Canine Tricks Panel (Right Side) — collapsible via little arrows */}
      {tricksHidden ? (
        <div className="self-end pointer-events-auto">
          <button className={arrowBtn} onClick={() => setTricksHidden(false)} aria-label="Show tricks" title="Show tricks panel">
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      ) : (
      <div className="self-end pointer-events-auto flex flex-col gap-1.5 max-h-[38vh] sm:max-h-[46vh] overflow-y-auto no-scrollbar py-1">
        <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-[#386641] text-[#F2E8CF] rounded-full self-end mb-1 shadow-sm">
          <button
            onClick={() => setTricksHidden(true)}
            aria-label="Hide tricks"
            title="Hide tricks (tap ▲ to bring back)"
            className="p-1 rounded-full hover:bg-white/15 transition cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-black uppercase tracking-wider">Tricks & Behavior</span>
          <button
            onClick={onOpenSkillTree}
            title="Unlock more tricks in Skill Tree"
            className="text-[10px] underline hover:text-[#A7C957] cursor-pointer"
          >
            Tree 🌳
          </button>
        </div>

        {ALL_TRICKS.map((trick) => {
          const isSkillUnlocked = !trick.skillId || unlockedSet.has(trick.skillId);
          const isActive = currentAction === trick.action;
          const isLowEnergy = trick.energyCost > 0 && stats.energy < trick.energyCost;

          if (!isSkillUnlocked) {
            // Locked trick button
            return (
              <button
                key={trick.action}
                onClick={onOpenSkillTree}
                title={`Locked! Unlock in Skill Tree to teach ${stats.name} this trick.`}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-[#e8dcb8]/60 hover:bg-[#e8dcb8] text-[#386641]/60 border border-[#386641]/15 backdrop-blur-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm opacity-60">{trick.icon}</span>
                  <span>{trick.label}</span>
                </div>
                <Lock className="w-3 h-3 text-[#386641]/50" />
              </button>
            );
          }

          return (
            <button
              key={trick.action}
              onClick={() => onActionClick(trick.action)}
              disabled={isLowEnergy}
              title={
                isLowEnergy
                  ? `Too tired for this trick! Feed a treat to restore energy.`
                  : trick.energyCost < 0
                  ? `Restores +20% Energy`
                  : `Cost: -${trick.energyCost}% Energy`
              }
              className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-2xl text-xs font-bold shadow-xs backdrop-blur-md border transition-all active:scale-95 cursor-pointer ${
                isActive
                  ? "bg-[#386641] text-white border-[#386641] shadow-[#386641]/30 scale-105"
                  : isLowEnergy
                  ? "bg-[#F2E8CF]/60 text-[#386641]/40 border-[#386641]/10 cursor-not-allowed opacity-60"
                  : "bg-white/90 hover:bg-white text-[#386641] border-[#386641]/15 shadow-[#386641]/5 hover:border-[#A7C957]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm group-hover:scale-110 transition-transform">
                  {trick.icon}
                </span>
                <span className="whitespace-nowrap">{trick.label}</span>
              </div>

              {trick.energyCost > 0 ? (
                <span className="text-[10px] text-[#6A994E] group-hover:text-[#386641]">
                  -{trick.energyCost}⚡
                </span>
              ) : trick.energyCost < 0 ? (
                <span className="text-[10px] text-[#A7C957] font-black">+⚡</span>
              ) : null}
            </button>
          );
        })}
      </div>
      )}

      {/* Park axe hint: chop trees when you own the axe */}
      {!isHouse && hasAxe && !tricksHidden && (
        <div className="self-end pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-900/85 text-emerald-100 text-[11px] font-bold border border-emerald-300/30 shadow-lg">
          <Axe className="w-3.5 h-3.5" />
          <span>Tap a 🌲 tree to chop it!</span>
        </div>
      )}

      {/* Primary Action Buttons Bar (Feed, Play/Cook, Pet, Train, Dog Chat, Games/Sleep) */}
      {bottomHidden ? (
        <div className="pointer-events-auto w-full flex justify-center">
          <button className={arrowBtn} onClick={() => setBottomHidden(false)} aria-label="Show action bar" title="Show action buttons">
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      ) : (
      <div className="pointer-events-auto w-full max-w-4xl mx-auto">
        <div className="flex justify-center mb-1">
          <button
            onClick={() => setBottomHidden(true)}
            aria-label="Hide action bar"
            title="Hide actions (tap ▲ to bring back)"
            className="p-1.5 rounded-full bg-[#1f2937]/80 hover:bg-[#1f2937] text-white border border-white/20 shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-[#F2E8CF]/95 backdrop-blur-md border border-[#386641]/20 rounded-3xl p-2 sm:p-2.5 shadow-2xl shadow-[#386641]/20 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {/* 1. Feed */}
          <button
            onClick={onFeedClick}
            title="Feed tasty treats to restore hunger and energy"
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-white hover:bg-[#A7C957]/20 active:bg-white border border-[#386641]/15 rounded-2xl shadow-xs transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#6A994E]/15 group-hover:bg-[#6A994E] text-[#386641] group-hover:text-[#F2E8CF] flex items-center justify-center transition-colors">
              <Utensils className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-[#386641]">Feed</span>
            <span className="text-[9px] font-bold text-[#6A994E] -mt-0.5">+Energy</span>
          </button>

          {/* 2. Play Fetch (Park) / Toy (Living) / Cook (Kitchen) / Games (City) */}
          {isAway ? (
            <button
              onClick={onOpenMiniGames}
              title="Mini-Games: Subway Pup Bone Rush, Paw Shuffle, Backyard Digger & more!"
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-white hover:bg-[#A7C957]/20 active:bg-white border border-[#386641]/15 rounded-2xl shadow-xs transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-[#A7C957]/30 group-hover:bg-[#386641] text-[#386641] group-hover:text-[#F2E8CF] flex items-center justify-center transition-colors">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-black text-[#386641]">Games</span>
              <span className="text-[9px] font-bold text-[#386641]/70 -mt-0.5">Mini-Games</span>
            </button>
          ) : !isHouse ? (
            <button
              onClick={onPlayFetch}
              title="Throw tennis ball across the 3D park for dog to retrieve"
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-white hover:bg-[#A7C957]/20 active:bg-white border border-[#386641]/15 rounded-2xl shadow-xs transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-[#A7C957]/30 group-hover:bg-[#386641] text-[#386641] group-hover:text-[#F2E8CF] flex items-center justify-center transition-colors text-base">
                🎾
              </div>
              <span className="text-xs font-black text-[#386641]">Play Fetch</span>
              <span className="text-[9px] font-bold text-[#386641]/70 -mt-0.5">+Fun & Coins</span>
            </button>
          ) : isKitchen ? (
            <button
              id="kitchen-cook-button"
              onClick={() => onOpenCooking?.()}
              title={`Cook in the central pot for ${stats.name}`}
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white border border-orange-400 rounded-2xl shadow-md transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-white/25 text-white flex items-center justify-center transition-colors text-base">
                🍲
              </div>
              <span className="text-xs font-black text-white">Cook</span>
              <span className="text-[9px] font-bold text-amber-100 -mt-0.5">Pot Meal</span>
            </button>
          ) : (
            <button
              id="house-toy-button"
              onClick={() => onActionClick("eat")}
              title="Play and squeak the house toy on the rug"
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-white hover:bg-amber-100 active:bg-white border border-amber-300 rounded-2xl shadow-xs transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-100 group-hover:bg-amber-500 text-amber-800 group-hover:text-white flex items-center justify-center transition-colors text-base">
                🦴
              </div>
              <span className="text-xs font-black text-[#386641]">Toy</span>
              <span className="text-[9px] font-bold text-amber-700 -mt-0.5">Squeak!</span>
            </button>
          )}

          {/* 3. Pet */}
          <button
            onClick={onPetClick}
            title="Pet and cuddle your dog to boost happiness and bond"
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-white hover:bg-[#BC4749]/10 active:bg-white border border-[#386641]/15 rounded-2xl shadow-xs transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#BC4749]/15 group-hover:bg-[#BC4749] text-[#BC4749] group-hover:text-white flex items-center justify-center transition-colors">
              <Heart className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-xs font-black text-[#386641]">Pet</span>
            <span className="text-[9px] font-bold text-[#BC4749] -mt-0.5">+Joy</span>
          </button>

          {/* 4. Train */}
          <button
            onClick={onTrainClick}
            title="Train obedience tricks & spend in-game rewards in the Skill Tree"
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-[#6A994E] hover:bg-[#58813f] active:bg-[#486b34] text-[#F2E8CF] border border-[#386641]/20 rounded-2xl shadow-md transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 group-hover:bg-white/30 text-[#F2E8CF] flex items-center justify-center transition-colors">
              <GraduationCap className="w-4 h-4 text-[#F2E8CF]" />
            </div>
            <span className="text-xs font-black text-white">Train</span>
            <span className="text-[9px] font-bold text-[#A7C957] -mt-0.5">Skill Tree</span>
          </button>

          {/* 5. Dog Chat — named after YOUR dog (always visible) */}
          <button
            onClick={onOpenChat}
            title={`Chat with ${stats.name} — Conversational Gemini Chatbot & Live Voice`}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-[#386641] hover:bg-[#2c5234] active:bg-[#224028] text-[#F2E8CF] border border-[#386641] rounded-2xl shadow-md transition-all active:scale-95 group cursor-pointer relative overflow-hidden"
          >
            <div className="w-8 h-8 rounded-xl bg-[#A7C957]/30 text-[#F2E8CF] flex items-center justify-center transition-colors">
              <MessageCircle className="w-4 h-4 fill-current text-[#A7C957]" />
            </div>
            <span className="text-xs font-black text-[#F2E8CF] flex items-center gap-1 max-w-full">
              <span className="truncate max-w-[64px]">{stats.name}</span>
              <Mic className="w-3 h-3 text-[#A7C957] shrink-0" />
            </span>
            <span className="text-[9px] font-bold text-[#A7C957] -mt-0.5">Chat 💬</span>
          </button>

          {/* 6. Bed Sleep (in House) or Mini-Games (in Park) */}
          {isHouse ? (
            <button
              id="house-bottom-sleep-button"
              onClick={onGoToBed}
              title="Put dog to sleep in the bed for a fresh day with 100% energy"
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 rounded-2xl shadow-md transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 group-hover:bg-white/30 text-white flex items-center justify-center transition-colors">
                <Bed className="w-4 h-4" />
              </div>
              <span className="text-xs font-black text-white">Sleep</span>
              <span className="text-[9px] font-bold text-indigo-200 -mt-0.5">Full Energy</span>
            </button>
          ) : (
            <button
              onClick={onOpenMiniGames}
              title="Agility Course, Treat Catch, and Fetch Challenges"
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-[#A7C957] hover:bg-[#97b949] active:bg-[#86a63d] text-[#386641] border border-[#6A994E]/40 rounded-2xl shadow-xs transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-white/40 group-hover:bg-white/60 text-[#386641] flex items-center justify-center transition-colors">
                <Gamepad2 className="w-4 h-4 text-[#386641]" />
              </div>
              <span className="text-xs font-black text-[#386641]">Games</span>
              <span className="text-[9px] font-bold text-[#386641]/80 -mt-0.5">Earn Coins</span>
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
