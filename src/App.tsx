import React, { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { ParkScene, RoomLayout, TimeOfDay, WeatherType } from "./features/dog3d/ParkScene";
import {
  BedColors,
  DogAction,
  DogBreed,
  HolidayId,
  HouseRoom,
  HouseViewMode,
  LinkedAccount,
  MiniGameType,
  PetStats,
  Recipe,
  SkillNode,
  TreatItem,
} from "./types/pet";
import { CookingModal, COOK_TIME_SECONDS, formatCookCountdown } from "./features/cooking/CookingModal";
import { SoupReadyModal } from "./features/cooking/SoupReadyModal";
import { MemoryAlbumModal } from "./features/album/MemoryAlbumModal";
import { ALL_INGREDIENTS, ALL_RECIPES, DEFAULT_INGREDIENTS } from "./features/cooking/ingredientsData";
import { CookingJob, MemoryPhoto } from "./types/pet";
import { deriveEmotion, getEmotionMeta } from "./features/emotions/emotion";
import { TRAINABLE_TRICKS, TrickId, trainSuccessChance, trainGain, trickTierFor } from "./features/training/trainingData";
import { TrainingModal, TrainResult } from "./features/training/TrainingModal";
import { PetActionButtons } from "./features/hud/PetActionButtons";
import { TreatsTray } from "./features/treats/TreatsTray";
import { PetChatModal } from "./features/chat/PetChatModal";
import { MiniGameSelectorModal } from "./features/minigames/MiniGameSelectorModal";
import { AgilityMiniGame } from "./features/minigames/AgilityMiniGame";
import { TreatCatchMiniGame } from "./features/minigames/TreatCatchMiniGame";
import { FetchMiniGame } from "./features/minigames/FetchMiniGame";
import { BoneRushRunner } from "./features/minigames/BoneRushRunner";
import { BoneRushStore } from "./features/minigames/BoneRushStore";
import { PawShuffleMiniGame } from "./features/minigames/PawShuffleMiniGame";
import { BackyardDiggerMiniGame } from "./features/minigames/BackyardDiggerMiniGame";
import { SupermarketMiniGame } from "./features/minigames/SupermarketMiniGame";
import { GymMiniGame } from "./features/minigames/GymMiniGame";
import { PetCustomizerModal } from "./features/hud/PetCustomizerModal";
import { SettingsModal } from "./features/hud/SettingsModal";
import { SkillTreeModal } from "./features/skills/SkillTreeModal";
import { HouseShopModal } from "./features/shop/HouseShopModal";
import { SleepOverlay } from "./features/hud/SleepOverlay";
import { IrisTransition, IrisPhase } from "./features/hud/IrisTransition";
import { CartoonTransition, CartoonPhase } from "./features/transitions/CartoonTransition";
import { EditModeBar } from "./features/hud/EditModeBar";
import { PhotoMode } from "./features/photomode/PhotoMode";
import { PhotoReviewModal } from "./features/photomode/PhotoReviewModal";
import { SecretCodeModal } from "./features/secret/SecretCodeModal";
import { SECRET_CODES, SecretCodeDef } from "./features/secret/secretCodes";
import { BreedJournal } from "./features/journal/BreedJournal";
import { ScoreboardModal } from "./features/account/ScoreboardModal";
import { getAccount, linkAccount, saveAccount } from "./features/account/AccountService";
import { getCurrentHoliday, holidayBlurb } from "./features/seasonal/holidays";
import { logDayEvent, bumpLifetime, getLifetime } from "./features/journal/dayJournal";
import { ACHIEVEMENTS, evaluateAchievements } from "./features/achievements/achievementsData";
import { getBoneBalance } from "./features/bonerush/boneRushData";
import { sound } from "./utils/audio";

const LAYOUT_STORAGE_KEY = "doghouse_layout_v1";
const ALBUM_STORAGE_KEY = "doghouse_memory_album_v1";
const MAX_ALBUM_PHOTOS = 30;
const SNAP_MAX_DIM = 480;
// Weather rotates to a new condition every few hours
const WEATHER_STORAGE_KEY = "doghouse_weather_v1";
const WEATHER_ROTATE_MS = 3 * 60 * 60 * 1000;
const WEATHER_ORDER: WeatherType[] = ["sunny", "rainy", "snowy"];

function pickNewWeather(current: WeatherType): WeatherType {
  const opts = WEATHER_ORDER.filter((w) => w !== current);
  return opts[Math.floor(Math.random() * opts.length)];
}

export function weatherBlurb(w: WeatherType): string {
  if (w === "rainy") return "Rainy! ☔ The dog feels lethargic — energy drains faster.";
  if (w === "snowy") return "Snowy! ❄️ Snow joy — extra happiness, everything looks magical!";
  return "Sunny! ☀️ Outdoor play costs less energy!";
}

/** Downscale a full-res snapshot so dozens fit comfortably in localStorage. */
function downscaleSnapshot(dataUrl: string, maxDim: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function loadSavedLayout(): RoomLayout | null {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as RoomLayout) : null;
  } catch {
    return null;
  }
}

const DEFAULT_STATS: PetStats = {
  name: "Happy",
  breed: "golden",
  collarColor: "#e11d48",
  energy: 85,
  happiness: 95,
  hunger: 20,
  level: 1,
  xp: 45,
  coins: 150, // ample starting coins to explore shop, accessories & bed colors
  treatsInventory: {
    biscuit: 5,
    beef_jerky: 3,
    cheddar: 2,
    carrot: 4,
    chicken_drum: 1,
  },
  lastFed: Date.now(),
  lastInteractionAt: Date.now(),
  trickProgress: {},
  unlockedSkills: ["fetch_master", "handshake_paw"],
  trainingPoints: 5,
  bedColors: {
    cushion: "#dc2626",
    frame: "#854d0e",
    blanket: "#fef3c7",
  },
  ownedAccessories: ["bowtie"],
  equippedAccessory: "bowtie",
  houseToy: "bone",
  unlockedBedStyles: ["classic"],
  currentBedStyle: "classic",
  ingredientsInventory: { ...DEFAULT_INGREDIENTS },
  ownedTools: [] as string[],
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const parkSceneRef = useRef<ParkScene | null>(null);

  // Persistent Pet state
  const [stats, setStats] = useState<PetStats>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("pet_game_stats_v3");
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...DEFAULT_STATS,
            ...parsed,
            unlockedSkills: parsed.unlockedSkills || DEFAULT_STATS.unlockedSkills,
            trainingPoints: parsed.trainingPoints ?? DEFAULT_STATS.trainingPoints,
            bedColors: parsed.bedColors || DEFAULT_STATS.bedColors,
            ownedAccessories: parsed.ownedAccessories || DEFAULT_STATS.ownedAccessories,
            equippedAccessory: parsed.equippedAccessory ?? DEFAULT_STATS.equippedAccessory,
            houseToy: parsed.houseToy || DEFAULT_STATS.houseToy,
            lastInteractionAt: parsed.lastInteractionAt ?? Date.now(),
            trickProgress: parsed.trickProgress || {},
            ownedTools: parsed.ownedTools || [],
            ingredientsInventory: {
              ...DEFAULT_INGREDIENTS,
              ...(parsed.ingredientsInventory || {}),
            },
          };
        }
      } catch (e) {
        console.warn("Failed to load saved pet stats", e);
      }
    }
    return DEFAULT_STATS;
  });

  // ===== New feature states =====
  // Seasonal holiday (drives Easter eggs everywhere)
  const [holiday] = useState<HolidayId>(() => getCurrentHoliday());
  // Daily Login Streak (consecutive days the app was opened)
  const [streakDays, setStreakDays] = useState<number>(1);
  // Google-linked trainer account
  const [account, setAccount] = useState<LinkedAccount | null>(() => getAccount());
  // Photo Mode
  const [photoMode, setPhotoMode] = useState<boolean>(false);
  const [reviewPhoto, setReviewPhoto] = useState<string | null>(null);
  // Secret code easter egg
  const [activeSecretCode, setActiveSecretCode] = useState<SecretCodeDef | null>(null);
  // Cartoon black-screen chunk transitions (stairs, car rides)
  const [cartoonPhase, setCartoonPhase] = useState<CartoonPhase>(null);
  const [cartoonLabel, setCartoonLabel] = useState("Loading... 🐾");
  // New modals
  const [showBreedJournal, setShowBreedJournal] = useState<boolean>(false);
  const [showScoreboard, setShowScoreboard] = useState<boolean>(false);
  const [showBoneRushStore, setShowBoneRushStore] = useState<boolean>(false);
  const [boneRushTick, setBoneRushTick] = useState<number>(0);
  // Achievements re-evaluation tick (bumped whenever lifetime counters change)
  const [achTick, setAchTick] = useState<number>(0);

  // Action & Environment States
  const [currentAction, setCurrentAction] = useState<DogAction>("idle");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");
  // Weather: rotates automatically every few hours, persisted across visits
  const [weatherState, setWeatherState] = useState<{ w: WeatherType; next: number }>(() => {
    try {
      const raw = localStorage.getItem(WEATHER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { w: WeatherType; next: number };
        if (parsed && WEATHER_ORDER.includes(parsed.w) && typeof parsed.next === "number") {
          if (parsed.next > Date.now()) return parsed;
          // Timer expired while away: roll to a fresh condition now
          const w = pickNewWeather(parsed.w);
          return { w, next: Date.now() + WEATHER_ROTATE_MS };
        }
      }
    } catch {
      // ignore
    }
    return { w: "sunny" as WeatherType, next: Date.now() + WEATHER_ROTATE_MS };
  });
  const weather = weatherState.w;
  const weatherRef = useRef<WeatherType>(weather);
  weatherRef.current = weather;
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [followCamera, setFollowCamera] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<HouseViewMode>("park");
  const [houseRoom, setHouseRoom] = useState<HouseRoom>("living");
  const [showCookingModal, setShowCookingModal] = useState<boolean>(false);
  // Timed cooking: 2:00 countdown, then the park house glows red with a pot
  const [activeCookJob, setActiveCookJob] = useState<CookingJob | null>(() => {
    try {
      const raw = localStorage.getItem("doghouse_cookjob_v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CookingJob;
      if (!parsed || !parsed.endsAt) return null;
      return parsed;
    } catch {
      return null;
    }
  });
  // Memory Album: snapshots of the dog, persisted in localStorage
  const [photos, setPhotos] = useState<MemoryPhoto[]>(() => {
    try {
      const raw = localStorage.getItem(ALBUM_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as MemoryPhoto[]).slice(0, MAX_ALBUM_PHOTOS) : [];
    } catch {
      return [];
    }
  });
  const [showAlbum, setShowAlbum] = useState<boolean>(false);
  const [readyMeal, setReadyMeal] = useState<CookingJob | null>(() => {
    try {
      const raw = localStorage.getItem("doghouse_readymeal_v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CookingJob;
      if (!parsed || !parsed.recipeId) return null;
      return parsed;
    } catch {
      return null;
    }
  });
  const [showReadyModal, setShowReadyModal] = useState<boolean>(false);
  const [beaconClickTick, setBeaconClickTick] = useState<number>(0);
  const [cookMsLeft, setCookMsLeft] = useState<number>(0);

  // Modals, Shop & Sleep States
  const [showTreatsTray, setShowTreatsTray] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [showMiniGameSelector, setShowMiniGameSelector] = useState<boolean>(false);
  const [activeMiniGame, setActiveMiniGame] = useState<MiniGameType>("none");
  const [showCustomizer, setShowCustomizer] = useState<boolean>(false);
  const [showSkillTree, setShowSkillTree] = useState<boolean>(false);
  const [showTrainingModal, setShowTrainingModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showShopModal, setShowShopModal] = useState<boolean>(false);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const isSleepingRef = useRef<boolean>(false);
  isSleepingRef.current = isSleeping;
  const [irisPhase, setIrisPhase] = useState<IrisPhase>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"audio" | "pet" | "environment" | "achievements" | "account">("audio");

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Passive Bonuses Helper
  const hasSkill = (skillId: string) => stats.unlockedSkills?.includes(skillId);

  // Initialize looping park ambient audio on first user gesture (gentle breeze & soft singing birds)
  useEffect(() => {
    const handleFirstGesture = () => {
      sound.startAmbient();
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };
    window.addEventListener("click", handleFirstGesture);
    window.addEventListener("keydown", handleFirstGesture);
    window.addEventListener("touchstart", handleFirstGesture);
    return () => {
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };
  }, []);

  // Save pet stats to localStorage (FIX: now saves to the same key it loads)
  useEffect(() => {
    try {
      localStorage.setItem("pet_game_stats_v3", JSON.stringify(stats));
    } catch (e) {
      console.warn("Failed to save pet stats", e);
    }
  }, [stats]);

  // Daily Login Streak: consecutive-day tracking with milestone bonuses
  useEffect(() => {
    try {
      const KEY = "doghouse_streak_v1";
      const today = new Date().toDateString();
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) as { last: string; count: number; claimed: number[] } : null;
      let count = 1;
      if (parsed) {
        if (parsed.last === today) {
          count = parsed.count;
        } else {
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          count = parsed.last === yesterday ? parsed.count + 1 : 1;
        }
      }
      localStorage.setItem(KEY, JSON.stringify({ last: today, count, claimed: parsed?.claimed || [] }));
      setStreakDays(count);
      // Milestone bonuses at 3 / 7 / 30 day streaks (claimed once per streak)
      const milestones: Record<number, number> = { 3: 25, 7: 60, 30: 150 };
      const claimed = new Set(parsed?.claimed || []);
      if (milestones[count] && !claimed.has(count)) {
        claimed.add(count);
        localStorage.setItem(KEY, JSON.stringify({ last: today, count, claimed: [...claimed] }));
        const bonus = milestones[count];
        bumpLifetime("coinsEarned", bonus);
        setStats((prev) => ({ ...prev, coins: prev.coins + bonus }));
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.4 } });
        sound.playRewardFanfare();
        showToast(`🔥 ${count}-day login streak! +${bonus} Treat Coins!`);
      } else if (count > 1 && parsed?.last !== today) {
        showToast(`🔥 Daily streak: Day ${count}! Come back tomorrow!`);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Achievements: re-evaluate milestone badges after every meaningful event
  useEffect(() => {
    const already = stats.unlockedAchievements || [];
    const newly = evaluateAchievements(
      { stats, lifetime: getLifetime(), holiday },
      already
    );
    if (newly.length === 0) return;
    setStats((prev) => ({
      ...prev,
      unlockedAchievements: [...(prev.unlockedAchievements || []), ...newly],
      coins: prev.coins + newly.length * 10, // badge bonus
    }));
    newly.forEach((id) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) {
        confetti({ particleCount: 70, spread: 75, origin: { y: 0.5 } });
        showToast(`🏅 Achievement unlocked: ${a.name}! (+10 Coins)`);
        sound.playRewardFanfare();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.energy, stats.happiness, stats.trickProgress, stats.foundSecretCodes, achTick, holiday]);

  // Persist the Memory Album (guarded: photos can be big, drop oldest if full)
  useEffect(() => {
    try {
      localStorage.setItem(ALBUM_STORAGE_KEY, JSON.stringify(photos));
    } catch (e) {
      console.warn("Album full, dropping oldest non-favorite", e);
      setPhotos((prev) => {
        if (prev.length === 0) return prev;
        const idx = prev.findIndex((p) => !p.favorite);
        const next = [...prev];
        next.splice(idx >= 0 ? idx : prev.length - 1, 1);
        return next;
      });
    }
  }, [photos]);

  // Stamp a meaningful interaction (feeds emotion + neglect tracking)
  const stampInteraction = () => {
    setStats((prev) => ({ ...prev, lastInteractionAt: Date.now() }));
  };

  // Current emotion, recomputed whenever stats change
  const emotion = React.useMemo(
    () =>
      deriveEmotion({
        energy: stats.energy,
        happiness: stats.happiness,
        hunger: stats.hunger,
        lastInteractionAt: stats.lastInteractionAt,
        isSleeping,
      }),
    [stats.energy, stats.happiness, stats.hunger, stats.lastInteractionAt, isSleeping]
  );

  // Natural slow metabolism over time (+ loneliness when ignored)
  // Rain makes the dog lethargic: energy drains twice as fast.
  useEffect(() => {
    const timer = setInterval(() => {
      const rainy = weatherRef.current === "rainy";
      setStats((prev) => {
        const newHunger = Math.min(100, prev.hunger + 1);
        const drain = (newHunger > 70 ? 2 : 1) * (rainy ? 2 : 1);
        const newEnergy = Math.max(10, prev.energy - drain);
        const neglected = Date.now() - (prev.lastInteractionAt || Date.now()) > 3 * 60 * 1000;
        return {
          ...prev,
          hunger: newHunger,
          energy: newEnergy,
          happiness: neglected ? Math.max(0, prev.happiness - 4) : prev.happiness,
        };
      });
    }, 45000);
    return () => clearInterval(timer);
  }, []);

  // Persist furniture layout from edit mode
  const saveLayout = () => {
    const scene = parkSceneRef.current;
    if (!scene) return;
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(scene.getLayout()));
    } catch (e) {
      console.warn("Failed to save furniture layout", e);
    }
  };

  // Anime iris transition helper (stairs: black circle closes, room swaps, opens)
  const playIrisTransition = (swapRoom: () => void, arrivedToast: string) => {
    setIrisPhase("closing");
    window.setTimeout(() => {
      swapRoom();
      setIrisPhase("opening");
      showToast(arrivedToast);
      window.setTimeout(() => setIrisPhase(null), 1100);
    }, 1050);
  };

  /**
   * Cartoon black-screen chunk loader: the screen goes dark with a bouncing
   * cartoon pup 🐾, the chunk swaps behind the darkness, then the black
   * screen disappears cartoon-style. (Stairs, car rides.)
   */
  const playCartoonTransition = (label: string, swapWorld: () => void, arrivedToast?: string) => {
    setCartoonLabel(label);
    setCartoonPhase("closing");
    window.setTimeout(() => {
      swapWorld();
      setCartoonPhase("opening");
      if (arrivedToast) showToast(arrivedToast);
      window.setTimeout(() => setCartoonPhase(null), 950);
    }, 750);
  };

  // Initialize Three.js Park Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new ParkScene(
      mountRef.current,
      stats.breed,
      stats.collarColor,
      undefined,
      undefined,
      undefined,
      loadSavedLayout()
    );
    parkSceneRef.current = scene;

    scene.onFetchSuccess = (points) => {
      sound.playRewardFanfare();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });

      const coinMultiplier = hasSkill("treasure_hunter") ? 1.5 : 1.0;
      const coinsEarned = Math.round(15 * coinMultiplier);
      // Weather shapes the fetch payoff: sunshine boosts, rain drags, snow joys
      const w = weatherRef.current;
      const fetchEnergyCost = w === "sunny" ? 3 : w === "rainy" ? 12 : 8;
      const fetchJoy = w === "snowy" ? 15 : 10;

      logDayEvent("fetches", "Caught a fetch ball");
      bumpLifetime("coinsEarned", coinsEarned);
      setAchTick((t) => t + 1);
      showToast(
        `Good dog, ${stats.name}! Caught the ball! (+${points} XP, +${coinsEarned} Coins)` +
          (w === "sunny" ? " ☀️ Sunshine boost!" : w === "rainy" ? " ☔ Rainy-day drag..." : "")
      );

      setStats((prev) => {
        const nextXp = prev.xp + points;
        const newLevel = Math.floor(nextXp / 100) + 1;
        const leveledUp = newLevel > prev.level;
        if (leveledUp) {
          showToast(`🌟 Level Up! ${prev.name} is now Level ${newLevel}! (+1 Training Point)`);
        }
        return {
          ...prev,
          xp: nextXp,
          level: newLevel,
          trainingPoints: leveledUp ? prev.trainingPoints + 1 : prev.trainingPoints,
          coins: prev.coins + coinsEarned,
          happiness: Math.min(100, prev.happiness + fetchJoy),
          energy: Math.max(0, prev.energy - fetchEnergyCost),
        };
      });
    };

    scene.onPetClicked = () => {
      handlePetClick();
    };

    // Apply saved accessories, bed colors and house toy
    if (stats.equippedAccessory) {
      scene.dog.setAccessory(stats.equippedAccessory);
    }
    if (stats.bedColors) {
      scene.updateBedColors(stats.bedColors);
    }
    if (stats.houseToy) {
      scene.updateHouseToy(stats.houseToy);
    }

    scene.onHouseEntered = () => {
      setViewMode("house");
      setHouseRoom(scene.houseRoom || "living");
      showToast("Entered the Dog House! Living room + Kitchen — click the 🍲 KITCHEN mat!");
    };

    scene.onRoomChanged = (room) => {
      setHouseRoom(room);
      if (room === "kitchen") {
        showToast("Welcome to the Kitchen! Click the big pot in the middle to cook! 🍲");
      } else if (room === "hallway") {
        showToast("The hallway! Doors to every room — and stairs going up... 👀");
      } else if (room === "upstairs") {
        showToast("The upstairs bedroom! Shhh... the bed is up here. 🛏️");
      }
    };

    scene.onStairsClimbed = () => {
      playCartoonTransition(
        "Loading the bedroom... 🐾",
        () => {
          scene.enterUpstairs();
        },
        `Upstairs bedroom! ${stats.name} made it to the top! 🛏️✨`
      );
    };

    scene.onDescendClicked = () => {
      playCartoonTransition(
        "Back downstairs... 🐾",
        () => {
          scene.enterHallway();
        },
        "Back down in the hallway! 🐾"
      );
    };

    // ---- The little car: a fully 3D cinematic ride seen from the side ----
    // Park drive-off → forest highway (side view) → city parking lot.
    scene.onCarRideMidway = () => {
      playCartoonTransition(
        "Cruising down the highway... 🚗💨",
        () => {
          scene.startHighwayToCity();
        }
      );
    };
    scene.onCityApproach = () => {
      playCartoonTransition(
        "Arriving in the city... 🏙️",
        () => {
          scene.startLotPullIn();
        }
      );
    };
    scene.onArrivedInCity = () => {
      setViewMode("city");
      logDayEvent("carRides", "Rode the car to the City Park");
      bumpLifetime("carRides", 1);
      setAchTick((t) => t + 1);
      showToast(`🏙️ Parked at the City lot! Tap the 🛒 Supermarket or 🏋️ Gym — or the car to go home!`);
    };
    scene.onCarReturnMidway = () => {
      playCartoonTransition(
        "Cruising home through the forest... 🌲🚗",
        () => {
          scene.startHighwayHome();
        }
      );
    };
    scene.onHomeApproach = () => {
      playCartoonTransition(
        "Almost home... 🏡",
        () => {
          scene.startHomeArrival();
        }
      );
    };
    scene.onArrivedHome = () => {
      setViewMode("park");
      setHouseRoom("living");
      showToast("Home sweet home! 🏡");
    };

    // ---- City buildings open their minigames ----
    scene.onSupermarketClicked = () => {
      setActiveMiniGame("supermarket");
    };
    scene.onGymClicked = () => {
      setActiveMiniGame("gym");
    };

    // ---- The bedroom ARCADE MACHINE: zoom in & teleport to the Galaxy Arcade ----
    scene.onArcadeClicked = () => {
      scene.zoomToBedroomArcade(() => {
        playCartoonTransition(
          "Zooming into the Galaxy Arcade... 🌌",
          () => {
            scene.enterArcadeWorld("upstairs");
          },
          "🌌 Welcome to the Galaxy Arcade! Tap a machine to play — or the 🏠 HOME portal to leave!"
        );
      });
    };

    // ---- Arcade machines: zoom into the screen, then the game covers the whole screen ----
    scene.onArcadeGameSelected = (gameId) => {
      scene.zoomToArcadeGame(gameId, () => {
        const game = gameId as MiniGameType;
        setActiveMiniGame(game);
        stampInteraction();
      });
    };

    // ---- HOME portal: back to the bedroom (or the park) ----
    scene.onArcadeExitClicked = () => {
      scene.zoomToObject(scene.dog.group.position.clone().set(0, 1.6, 3.6), () => {
        playCartoonTransition(
          "Heading home from the arcade... 🐾",
          () => {
            scene.exitArcadeWorld();
            if (scene.viewMode === "house") {
              setViewMode("house");
              setHouseRoom("upstairs");
            } else {
              setViewMode("park");
            }
          },
          "Back from the arcade! 🐾"
        );
      });
    };

    // ---- Seasonal holiday Easter eggs ----
    scene.setHoliday(holiday);
    scene.dog.setHolidayHat(holiday === "christmas" ? "santa" : "none");
    if (holiday !== "none") {
      showToast(holidayBlurb(holiday));
    }

    scene.onEditChanged = (selectedId) => {
      setSelectedEditId(selectedId);
      saveLayout();
    };

    // Axe state + tree chopping rewards
    try {
      const savedStats = localStorage.getItem("pet_game_stats_v3");
      scene.hasAxe = savedStats ? (JSON.parse(savedStats).ownedTools || []).includes("axe") : false;
    } catch {
      scene.hasAxe = false;
    }
    scene.onTreeClickedNoAxe = () => {
      showToast("That tree needs an axe! Buy the 🪓 Lumberjack Axe in the Shop (Tools, 50 coins).");
      sound.playBark("low");
    };
    scene.onTreeChopped = () => {
      confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } });
      setStats((prev) => ({
        ...prev,
        coins: prev.coins + 8,
        ingredientsInventory: {
          ...(prev.ingredientsInventory || {}),
          yellow_acorn: ((prev.ingredientsInventory || {}).yellow_acorn || 0) + 1,
          red_mushroom: ((prev.ingredientsInventory || {}).red_mushroom || 0) + 1,
        },
        xp: prev.xp + 6,
      }));
      showToast(`TIMBER! 🪓 +8 coins, +1 Golden Acorn, +1 Red Mushroom!`);
    };
    scene.onCookBeaconClicked = () => {
      setShowCookingModal(false);
      setShowReadyModal(true);
      showToast("The red pot is steaming! Opening your soup... 🍲");
      setBeaconClickTick((t) => t + 1);
    };

    scene.onPotClicked = () => {
      setShowCookingModal(true);
      showToast(`The pot is bubbling! Cook something tasty for ${stats.name}! 🍳`);
    };

    scene.onHouseExited = () => {
      setViewMode("park");
      showToast("Back out in the park sunshine!");
    };

    scene.onBedClicked = () => {
      if (!isSleepingRef.current) {
        handleTriggerSleep();
      }
    };

    scene.onToyClicked = () => {
      showToast(`*${stats.name} squeaks and chews the toy happily!*`);
      setStats((prev) => ({
        ...prev,
        happiness: Math.min(100, prev.happiness + 8),
      }));
    };

    return () => {
      scene.destroy();
      parkSceneRef.current = null;
    };
  }, []);

  // Sync Breed & Collar color changes to 3D scene
  useEffect(() => {
    if (parkSceneRef.current) {
      parkSceneRef.current.dog.setBreed(stats.breed);
      parkSceneRef.current.dog.setCollarColor(stats.collarColor);
    }
  }, [stats.breed, stats.collarColor]);

  const anyModalOpen =
    showTreatsTray ||
    showChatModal ||
    showMiniGameSelector ||
    activeMiniGame !== "none" ||
    showCustomizer ||
    showSkillTree ||
    showSettingsModal ||
    showShopModal ||
    showCookingModal ||
    showReadyModal ||
    showAlbum ||
    showTrainingModal ||
    showBreedJournal ||
    showScoreboard ||
    showBoneRushStore ||
    !!activeSecretCode ||
    !!reviewPhoto ||
    isSleeping;

  // Keep the 3D scene's axe flag in sync with the shop purchase
  useEffect(() => {
    if (parkSceneRef.current) {
      parkSceneRef.current.hasAxe = (stats.ownedTools || []).includes("axe");
    }
  }, [stats.ownedTools]);

  // Cooking countdown: tick from 2:00, then the park house glows red + pot
  useEffect(() => {
    if (!activeCookJob) {
      setCookMsLeft(0);
      try {
        localStorage.removeItem("doghouse_cookjob_v1");
      } catch {
        // ignore
      }
      return;
    }
    try {
      localStorage.setItem("doghouse_cookjob_v1", JSON.stringify(activeCookJob));
    } catch {
      // ignore
    }
    const tick = () => {
      const left = activeCookJob.endsAt - Date.now();
      setCookMsLeft(left);
      if (left <= 0) {
        setReadyMeal(activeCookJob);
        setActiveCookJob(null);
        setShowReadyModal(true);
        setShowCookingModal(false);
        sound.playRewardFanfare();
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        showToast(`🍲 ${activeCookJob.recipeName} is ready! Look for the RED pot over the house! 🏠🔴`);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [activeCookJob]);

  // Weather: push the condition into the 3D scene + rain audio
  useEffect(() => {
    parkSceneRef.current?.setWeather(weather);
    sound.setRainWanted(weather === "rainy");
    try {
      localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(weatherState));
    } catch {
      // ignore
    }
  }, [weather, weatherState]);

  // Weather: automatically roll to a new condition every few hours
  useEffect(() => {
    const id = window.setInterval(() => {
      setWeatherState((prev) => {
        if (Date.now() < prev.next) return prev;
        return { w: pickNewWeather(prev.w), next: Date.now() + WEATHER_ROTATE_MS };
      });
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  // Announce every weather change (auto rotations + manual cycles)
  const firstWeatherRender = useRef(true);
  useEffect(() => {
    if (firstWeatherRender.current) {
      firstWeatherRender.current = false;
      return;
    }
    showToast(`🌤️ The weather changed! ${weatherBlurb(weather)}`);
    sound.playRewardFanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather]);

  // Manually cycle the weather from the HUD button (restarts the timer)
  const handleCycleWeather = () => {
    sound.playButtonTap();
    setWeatherState((prev) => {
      const idx = WEATHER_ORDER.indexOf(prev.w);
      return {
        w: WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length],
        next: Date.now() + WEATHER_ROTATE_MS,
      };
    });
  };

  // Show / hide the red cooking-ready beacon above the park dog house
  useEffect(() => {
    parkSceneRef.current?.setCookBeaconVisible(!!readyMeal);
    try {
      if (readyMeal) localStorage.setItem("doghouse_readymeal_v1", JSON.stringify(readyMeal));
      else localStorage.removeItem("doghouse_readymeal_v1");
    } catch {
      // ignore
    }
  }, [readyMeal, viewMode, beaconClickTick]);

  // Edit-mode keyboard controls:
  // arrows move the object on the ground, Shift+arrows turn it:
  // Shift+Up/Down spins on the Y (up) axis, Shift+Left/Right tilt X / Z.
  // (On touch: drag moves, double-tap spins, two-finger tap tilts,
  // pinch lifts/lowers, long-press nudges up — plus the on-screen pad.)
  useEffect(() => {
    if (!editMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const scene = parkSceneRef.current;
      if (!scene || anyModalOpen) return;
      const step = 0.25;
      const turn = 15;
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (e.shiftKey) scene.rotateSelected("y", turn);
          else scene.moveSelected(0, -step);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (e.shiftKey) scene.rotateSelected("y", -turn);
          else scene.moveSelected(0, step);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) scene.rotateSelected("x", turn);
          else scene.moveSelected(-step, 0);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) scene.rotateSelected("z", turn);
          else scene.moveSelected(step, 0);
          break;
        case "Escape":
          handleToggleEditMode();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Handle Action Trigger on 3D Dog
  const handleTriggerAction = (action: DogAction) => {
    if (!parkSceneRef.current) return;

    if (action === "fetch") {
      handlePlayFetch();
      return;
    }

    let duration = 0;
    let energyChange = 0;
    let happinessChange = 0;
    let xpGain = 0;

    switch (action) {
      case "sit":
        duration = 5.0;
        energyChange = -2;
        happinessChange = 5;
        showToast(`*${stats.name} sits down politely with ears perked*`);
        break;
      case "stay":
        duration = 4.5;
        energyChange = -2;
        happinessChange = 6;
        showToast(`*${stats.name} freezes like a furry statue — not even the tail moves!* 🗿`);
        break;
      case "bark":
        duration = 1.2;
        energyChange = -3;
        happinessChange = 5;
        sound.playBark("high");
        break;
      case "roll":
        duration = 3.5;
        energyChange = -6;
        happinessChange = 12;
        showToast(`*${stats.name} rolls onto their back for belly rubs!* 🐾`);
        break;
      case "spin":
        duration = 2.8;
        energyChange = -5;
        happinessChange = 10;
        showToast(`*${stats.name} spins like a whirlwind chasing their tail!* 💫`);
        break;
      case "handshake":
        duration = 3.5;
        energyChange = -3;
        happinessChange = 8;
        showToast(`*${stats.name} offers a polite front paw for a handshake!* 🤝`);
        break;
      case "dance":
        duration = 4.5;
        energyChange = -8;
        happinessChange = 16;
        xpGain = 15;
        sound.playWhistle();
        showToast(`*${stats.name} stands on hind legs and tap-dances!* 🕺 (+16 Joy)`);
        break;
      case "backflip":
        duration = 2.5;
        energyChange = -12;
        happinessChange = 22;
        xpGain = 25;
        sound.playRewardFanfare();
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        showToast(`*${stats.name} does a stunning 360-degree aerial backflip!* 🤸 (+22 Joy, +25 XP)`);
        break;
      case "cuddle":
        duration = 5.5;
        energyChange = 0;
        happinessChange = 25; // Massive temporary mood boost requested!
        showToast(`*Cozy snuggle with ${stats.name}!* 🧸 (+25 Joy Mood Boost!)`);
        sound.playSoftWoof();
        break;
      case "zoomies":
        duration = 4.2;
        energyChange = -10;
        happinessChange = 18;
        xpGain = 10;
        showToast(`*${stats.name} explodes into chaotic park zoomies!* ⚡`);
        break;
      case "howl":
        duration = 4.0;
        energyChange = -4;
        happinessChange = 14;
        sound.playBark("low");
        showToast(`*${stats.name} lifts their snout and howls a soulful awoo!* 🎶`);
        break;
      case "rest":
        duration = 8.0;
        // Deep Zen Rest perk boosts recovery
        energyChange = hasSkill("deep_zen_nap") ? 40 : 25;
        happinessChange = 6;
        showToast(`*${stats.name} takes a peaceful nap in the grass* 💤 (+${energyChange}% Energy)`);
        break;
      default:
        duration = 2.0;
    }

    // Weather effects on effort:
    // rain = lethargic (all effort costs more), sun = outdoor play costs less
    if (energyChange < 0) {
      if (weather === "rainy") {
        energyChange = Math.round(energyChange * 1.5);
      } else if (
        weather === "sunny" &&
        (action === "zoomies" || action === "spin" || action === "dance" || action === "backflip")
      ) {
        energyChange = Math.ceil(energyChange * 0.5);
      }
    }
    if (weather === "snowy") {
      happinessChange = Math.round(happinessChange * 1.25);
    }

    if (energyChange < 0 && stats.energy < Math.abs(energyChange)) {
      showToast(`${stats.name} is too tired right now! Feed a treat or let them rest.`);
      sound.playBark("low");
      return;
    }

    parkSceneRef.current.dog.setAction(action, duration);
    setCurrentAction(action);
    stampInteraction();

    setStats((prev) => ({
      ...prev,
      energy: Math.min(100, Math.max(0, prev.energy + energyChange)),
      happiness: Math.min(100, prev.happiness + happinessChange),
      xp: prev.xp + xpGain,
    }));

    if (duration > 0) {
      setTimeout(() => {
        setCurrentAction("idle");
      }, duration * 1000);
    }
  };

  // 1. BUTTON: Pet Dog Action
  const handlePetClick = () => {
    if (!parkSceneRef.current) return;
    parkSceneRef.current.triggerPetAffection();

    logDayEvent("pets", "Got pets & cuddles");
    // Pure Heart perk gives double Joy!
    const joyBoost = hasSkill("pure_heart") ? 16 : 8;
    sound.playSoftWoof();
    stampInteraction();
    showToast(`*Scritches behind ${stats.name}'s ears!* ❤️ (+${joyBoost} Joy)`);

    setStats((prev) => ({
      ...prev,
      happiness: Math.min(100, prev.happiness + joyBoost),
      xp: prev.xp + 5,
    }));
  };

  // 2. BUTTON: Play Fetch Action
  const handlePlayFetch = () => {
    if (!parkSceneRef.current) return;

    if (stats.energy < 8) {
      showToast(`${stats.name} is too tired to fetch! Feed a treat to restore energy.`);
      sound.playBark("low");
      return;
    }

    sound.playWhistle();
    stampInteraction();
    parkSceneRef.current.throwBall(9.0, (Math.random() - 0.5) * 0.8);
    setCurrentAction("fetch");
    showToast(`Threw the ball! Run, ${stats.name}, run! 🎾`);
  };

  // 3. BUTTON: Feed Action
  const handleFeedAction = () => {
    // If treats in inventory, do quick feed of a biscuit or open pantry
    const hasBiscuit = (stats.treatsInventory["biscuit"] || 0) > 0;
    if (hasBiscuit) {
      handleFeedTreat({
        id: "biscuit",
        name: "Crunchy Biscuit",
        icon: "🦴",
        energyBoost: 20,
        happinessBoost: 10,
        hungerReduction: 25,
        cost: 10,
        description: "Classic golden biscuit",
      });
    } else {
      setShowTreatsTray(true);
    }
  };

  // Feed treat handler
  const handleFeedTreat = (treat: TreatItem) => {
    if (!parkSceneRef.current) return;
    const count = stats.treatsInventory[treat.id] || 0;
    if (count <= 0) {
      setShowTreatsTray(true);
      return;
    }

    // Trigger 3D feed animation
    parkSceneRef.current.feedTreat();
    stampInteraction();
    sound.playCrunch();
    logDayEvent("feeds", `Ate a ${treat.name}`);
    confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });

    // Iron Stomach passive gives +25% extra energy boost
    const energyMultiplier = hasSkill("iron_stomach") ? 1.25 : 1.0;
    const finalEnergy = Math.round(treat.energyBoost * energyMultiplier);

    showToast(`Fed ${treat.name}! Energy +${finalEnergy}%, Hunger -${treat.hungerReduction}%`);

    setStats((prev) => {
      const nextCount = (prev.treatsInventory[treat.id] || 1) - 1;
      const nextInventory = { ...prev.treatsInventory, [treat.id]: nextCount };
      const nextEnergy = Math.min(100, prev.energy + finalEnergy);
      const nextHappiness = Math.min(100, prev.happiness + treat.happinessBoost);
      const nextHunger = Math.max(0, prev.hunger - treat.hungerReduction);

      return {
        ...prev,
        treatsInventory: nextInventory,
        energy: nextEnergy,
        happiness: nextHappiness,
        hunger: nextHunger,
        xp: prev.xp + 15,
        lastFed: Date.now(),
      };
    });
  };

  // 4. BUTTON: Train Action — opens the trick training modal
  const handleTrainAction = () => {
    stampInteraction();
    sound.playWhistle();
    showToast(`Training time with ${stats.name}! Pick a trick below. 🎓`);
    setShowTrainingModal(true);
  };

  // One trick training session: success roll -> proficiency gain + 3D demo
  const handleTrainTrick = (trickId: TrickId): TrainResult | null => {
    const trick = TRAINABLE_TRICKS.find((tr) => tr.id === trickId);
    if (!trick || !parkSceneRef.current) return null;
    if (stats.energy < trick.energyCost) return null;

    const prevProficiency = Math.round(stats.trickProgress[trickId] || 0);
    const chance = trainSuccessChance({
      proficiency: prevProficiency,
      energy: stats.energy,
      happiness: stats.happiness,
    });
    const success = Math.random() < chance;
    const gain = trainGain(success, stats.energy);
    const nextProficiency = Math.min(100, prevProficiency + gain);
    const leveledUp = trickTierFor(nextProficiency) !== trickTierFor(prevProficiency);

    // Demo the trick in 3D (fetch throws a real ball in the park!)
    if (trick.id === "fetch") {
      handlePlayFetch();
    } else {
      parkSceneRef.current.dog.setAction(trick.action, 3.0);
      setCurrentAction(trick.action);
      setTimeout(() => setCurrentAction("idle"), 3200);
    }
    if (success) {
      sound.playRewardFanfare();
      confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } });
    } else {
      sound.playSoftWoof();
    }

    stampInteraction();
    logDayEvent("trainingSessions", `Tricked ${trick.name}`);
    setStats((prev) => ({
      ...prev,
      energy: Math.max(0, prev.energy - trick.energyCost),
      happiness: Math.min(100, prev.happiness + (success ? 8 : 2)),
      xp: prev.xp + (success ? trick.xpReward : 2),
      trickProgress: { ...(prev.trickProgress || {}), [trickId]: nextProficiency },
    }));

    return { trickId, success, gain, proficiency: nextProficiency, leveledUp };
  };

  // Unlock Skill in Skill Tree
  const handleUnlockSkill = (skill: SkillNode) => {
    if (stats.coins < skill.cost) {
      showToast("Not enough coins! Win mini-games to earn rewards.");
      return;
    }

    setStats((prev) => {
      const nextCoins = prev.coins - skill.cost;
      const nextSkills = [...(prev.unlockedSkills || []), skill.id];
      const nextXp = prev.xp + 30;
      const nextLevel = Math.floor(nextXp / 100) + 1;

      return {
        ...prev,
        coins: nextCoins,
        unlockedSkills: nextSkills,
        xp: nextXp,
        level: nextLevel,
        happiness: Math.min(100, prev.happiness + 20),
      };
    });

    showToast(`🎉 Unlocked ${skill.name}! ${skill.benefit}`);

    // If it unlocks an action trick, demo it immediately!
    if (skill.actionUnlocked) {
      setTimeout(() => {
        handleTriggerAction(skill.actionUnlocked!);
      }, 500);
    }
  };

  // Buy treat with coins
  const handleBuyTreat = (treat: TreatItem) => {
    if (stats.coins < treat.cost) {
      showToast("Not enough coins! Play mini-games to earn more.");
      return;
    }

    sound.playWhistle();
    showToast(`Purchased 1x ${treat.name}!`);

    setStats((prev) => ({
      ...prev,
      coins: prev.coins - treat.cost,
      treatsInventory: {
        ...prev.treatsInventory,
        [treat.id]: (prev.treatsInventory[treat.id] || 0) + 1,
      },
    }));
  };

  // Time of Day toggle
  const handleToggleTimeOfDay = () => {
    const nextTime: TimeOfDay =
      timeOfDay === "day" ? "sunset" : timeOfDay === "sunset" ? "night" : "day";
    setTimeOfDay(nextTime);
    sound.setNightMode(nextTime === "night");
    if (parkSceneRef.current) {
      parkSceneRef.current.setTimeOfDay(nextTime);
    }
  };

  // Sound toggle
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setEnabled(next);
    if (next) {
      sound.startAmbient();
    } else {
      sound.stopAmbient();
    }
  };

  // Camera mode toggle
  const handleToggleCamera = () => {
    const next = !followCamera;
    setFollowCamera(next);
    if (parkSceneRef.current) {
      parkSceneRef.current.followDog = next;
    }
  };

  // Toggle View Mode: Between Park, House, City and the Galaxy Arcade
  const handleToggleViewMode = () => {
    if (!parkSceneRef.current) return;
    if (viewMode === "arcade") {
      playCartoonTransition(
        "Leaving the Galaxy Arcade... 🐾",
        () => {
          parkSceneRef.current!.exitArcadeWorld();
          if (parkSceneRef.current!.viewMode === "house") {
            setViewMode("house");
            setHouseRoom("upstairs");
          } else {
            setViewMode("park");
          }
        },
        "Back in the real world! 🐾"
      );
      return;
    }
    if (viewMode === "city") {
      // Quick trip home from the city (full cinematic is via the car)
      playCartoonTransition("Heading home... 🚗", () => {
        parkSceneRef.current!.exitCityInstant();
      }, "Back at the park! 🌳");
      setViewMode("park");
      return;
    }
    if (viewMode === "park") {
      parkSceneRef.current.enterHouse();
      setHouseRoom("living");
    } else {
      parkSceneRef.current.exitToPark();
    }
  };

  // Switch between house rooms (living <-> hallway <-> kitchen, upstairs via stairs)
  const handleSwitchRoom = (room: HouseRoom) => {
    if (!parkSceneRef.current) return;
    if (viewMode !== "house") {
      parkSceneRef.current.enterHouse();
      setViewMode("house");
    }
    if (room === "kitchen") {
      parkSceneRef.current.enterKitchen();
    } else if (room === "hallway") {
      parkSceneRef.current.enterHallway();
    } else if (room === "upstairs") {
      parkSceneRef.current.enterUpstairs();
    } else {
      parkSceneRef.current.enterLivingRoom();
    }
    setHouseRoom(room);
  };

  // Edit mode: rearrange ANYTHING outside + inside (only dog house + pot stay put)
  const handleToggleEditMode = () => {
    const scene = parkSceneRef.current;
    if (!scene) return;
    const next = !editMode;
    if (!next) saveLayout();
    scene.setEditMode(next);
    setEditMode(next);
    setSelectedEditId(null);
    showToast(
      next
        ? viewMode === "house"
          ? "Edit mode: tap anything to move it! (Dog house + pot stay put) 🛋️"
          : "Edit mode in the park: tap trees, bowls & hurdles to move them! 🌲"
        : "Furniture saved! ✨"
    );
  };

  const handleEditMove = (dx: number, dz: number) => {
    parkSceneRef.current?.moveSelected(dx, dz);
  };

  const handleEditMoveY = (dy: number) => {
    parkSceneRef.current?.moveSelectedVertical(dy);
  };

  const handleEditRotate = (axis: "x" | "y" | "z") => {
    parkSceneRef.current?.rotateSelected(axis, 15);
  };

  // Cooking: buy any ingredient (basics, forest finds, seasonings) with coins
  const handleBuyIngredient = (ingredientId: string) => {
    const ing = ALL_INGREDIENTS.find((i) => i.id === ingredientId);
    if (!ing) return;
    if (stats.coins < ing.cost) {
      showToast("Not enough coins! Play mini-games to earn more.");
      return;
    }
    sound.playWhistle();
    setStats((prev) => ({
      ...prev,
      coins: prev.coins - ing.cost,
      ingredientsInventory: {
        ...(prev.ingredientsInventory || {}),
        [ingredientId]: ((prev.ingredientsInventory || {})[ingredientId] || 0) + 1,
      },
    }));
    showToast(`Bought 1x ${ing.icon} ${ing.name}!`);
  };

  // Cooking: drop ingredients in the pot -> 2:00 countdown -> red house beacon -> serve
  const handleCookRecipe = (recipe: Recipe) => {
    if (activeCookJob) {
      showToast("The pot is already bubbling! Wait for the countdown to finish. ⏳");
      return;
    }
    if (readyMeal) {
      showToast("A soup is already ready! Serve it first! 🍲");
      return;
    }
    const inv = stats.ingredientsInventory || {};
    const missing = recipe.ingredients.filter((id) => (inv[id] || 0) <= 0);
    if (missing.length > 0) {
      showToast("Missing ingredients for that recipe!");
      return;
    }
    // Deduct ingredients now, meal lands when the countdown ends
    setStats((prev) => {
      const nextInv = { ...(prev.ingredientsInventory || {}) };
      recipe.ingredients.forEach((id) => {
        nextInv[id] = Math.max(0, (nextInv[id] || 1) - 1);
      });
      return { ...prev, ingredientsInventory: nextInv };
    });
    stampInteraction();
    sound.playCrunch();
    const now = Date.now();
    setActiveCookJob({
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeIcon: recipe.icon,
      ingredients: [...recipe.ingredients],
      energyBoost: recipe.energyBoost,
      happinessBoost: recipe.happinessBoost,
      hungerReduction: recipe.hungerReduction,
      xp: recipe.xp,
      description: recipe.description,
      startedAt: now,
      endsAt: now + COOK_TIME_SECONDS * 1000,
    });
    showToast(
      `${recipe.icon} ${recipe.name} is bubbling! Ready in 2:00 — go play outside and watch the house! 🏠`
    );
  };

  // Serve the finished soup (from the red-beacon reveal modal)
  const handleServeReadyMeal = () => {
    const meal = readyMeal;
    if (!meal) return;
    if (parkSceneRef.current) {
      parkSceneRef.current.feedTreat();
    }
    stampInteraction();
    sound.playRewardFanfare();
    confetti({ particleCount: 70, spread: 75, origin: { y: 0.65 } });
    setStats((prev) => {
      const nextXp = prev.xp + meal.xp;
      const newLevel = Math.floor(nextXp / 100) + 1;
      if (newLevel > prev.level) {
        showToast(`🌟 Level Up! ${prev.name} is now Level ${newLevel}!`);
      }
      return {
        ...prev,
        energy: Math.min(100, prev.energy + meal.energyBoost),
        happiness: Math.min(100, prev.happiness + meal.happinessBoost),
        hunger: Math.max(0, prev.hunger - meal.hungerReduction),
        xp: nextXp,
        level: newLevel,
        coins: prev.coins + 5,
        lastFed: Date.now(),
      };
    });
    showToast(
      `${meal.recipeIcon} Served ${meal.recipeName}! ${stats.name} munches happily! (+${meal.energyBoost}% Energy, +${meal.xp} XP)`
    );
    setReadyMeal(null);
    setShowReadyModal(false);
    parkSceneRef.current?.setCookBeaconVisible(false);
  };

  // Shop: buy the lumberjack axe (50 coins) for chopping park trees
  const handleBuyTool = (toolId: string, cost: number) => {
    if ((stats.ownedTools || []).includes(toolId)) {
      showToast("You already own that tool!");
      return;
    }
    if (stats.coins < cost) {
      showToast("Not enough coins! Play mini-games to earn more.");
      return;
    }
    sound.playRewardFanfare();
    setStats((prev) => ({
      ...prev,
      coins: prev.coins - cost,
      ownedTools: [...(prev.ownedTools || []), toolId],
    }));
    showToast(`🪓 Bought the Lumberjack Axe! Tap any park tree to chop it!`);
  };

  // Memory Album: snapshot the 3D scene at any time, straight into the gallery
  const handleTakeSnapshot = async () => {
    const scene = parkSceneRef.current;
    if (!scene) {
      showToast("The camera isn't ready yet — try again in a second! 📷");
      return;
    }
    const raw = scene.captureSnapshot();
    if (!raw) {
      showToast("Snapshot failed — try again! 📷");
      return;
    }
    sound.playCameraShutter();
    const small = await downscaleSnapshot(raw, SNAP_MAX_DIM);
    const meta = getEmotionMeta(emotion);
    const photo: MemoryPhoto = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dataUrl: small,
      timestamp: Date.now(),
      dogName: stats.name,
      level: stats.level,
      emotionLabel: meta.label,
      favorite: false,
    };
    logDayEvent("photosTaken", "Snapped a Memory Album photo");
    setPhotos((prev) => {
      const next = [photo, ...prev];
      // Album cap: drop the oldest non-favorite first
      while (next.length > MAX_ALBUM_PHOTOS) {
        const idx = next.map((p) => !p.favorite).lastIndexOf(true);
        next.splice(idx >= 0 ? idx : next.length - 1, 1);
      }
      return next;
    });
    stampInteraction();
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    showToast(`📸 Saved to Memory Album! (${photos.length + 1}/${MAX_ALBUM_PHOTOS})`);
  };

  const handleToggleFavoritePhoto = (id: string) => {
    sound.playButtonTap();
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)));
  };

  const handleDeletePhoto = (id: string) => {
    sound.playButtonTap();
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    showToast("Photo deleted from the album. 🗑️");
  };

  // Toggle Ceiling Lamp inside House
  const handleToggleLamp = () => {
    if (parkSceneRef.current) {
      parkSceneRef.current.toggleCeilingLamp();
    }
  };

  // Sleeping Routine: Dog curls up on bed, screen fades into night with "Good Night", then morning with full energy!
  const handleTriggerSleep = () => {
    if (isSleepingRef.current) return;
    setIsSleeping(true);
    isSleepingRef.current = true;

    if (parkSceneRef.current) {
      parkSceneRef.current.goToBed();
    }
  };

  const handleWakeUp = () => {
    setIsSleeping(false);
    isSleepingRef.current = false;
    setTimeOfDay("day");
    sound.setNightMode(false);
    if (parkSceneRef.current) {
      parkSceneRef.current.setTimeOfDay("day");
      parkSceneRef.current.wakeUp();
    }

    setStats((prev) => ({
      ...prev,
      energy: 100,
      happiness: Math.min(100, prev.happiness + 20),
      coins: prev.coins + 25, // Daily wake-up bonus
    }));

    logDayEvent("sleeps", "Slept soundly and woke up fresh");
    showToast(`☀️ Good Morning! ${stats.name} woke up on a fresh day with 100% full energy! (+25 Coins)`);
  };

  // Shop Handlers
  const handleUpdateBedColors = (colors: BedColors) => {
    setStats((prev) => ({
      ...prev,
      bedColors: colors,
    }));
    if (parkSceneRef.current) {
      parkSceneRef.current.updateBedColors(colors);
    }
  };

  const handleBuyAccessory = (accessoryId: string, cost: number) => {
    if (stats.coins < cost) {
      showToast("Not enough coins to buy this accessory!");
      return;
    }

    setStats((prev) => ({
      ...prev,
      coins: prev.coins - cost,
      ownedAccessories: [...(prev.ownedAccessories || []), accessoryId],
      equippedAccessory: accessoryId,
    }));

    if (parkSceneRef.current) {
      parkSceneRef.current.dog.setAccessory(accessoryId);
    }
    showToast(`Purchased and wearing accessory!`);
  };

  const handleEquipAccessory = (accessoryId: string | undefined) => {
    setStats((prev) => ({
      ...prev,
      equippedAccessory: accessoryId,
    }));
    if (parkSceneRef.current) {
      parkSceneRef.current.dog.setAccessory(accessoryId || null);
    }
  };

  const handleBuyToy = (toy: "bone" | "duck" | "bear" | "ball", cost: number) => {
    if (cost > 0 && stats.coins < cost) {
      showToast("Not enough coins!");
      return;
    }
    setStats((prev) => ({
      ...prev,
      coins: cost > 0 ? prev.coins - cost : prev.coins,
      houseToy: toy,
    }));
    if (parkSceneRef.current) {
      parkSceneRef.current.updateHouseToy(toy);
    }
    showToast(`Placed ${toy} on the house rug!`);
  };

  // ===== Photo Mode: bake the filter + commemorative stamp into the shot =====
  const handlePhotoCapture = async (filterCss: string, withStamp: boolean): Promise<string | null> => {
    const scene = parkSceneRef.current;
    if (!scene) return null;
    const raw = scene.captureSnapshot();
    if (!raw) return null;

    return new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          // Aesthetic photo filters (Natural / Golden Hour / Vibrant / Vintage / Noir)
          if (filterCss) {
            try { ctx.filter = filterCss; } catch { /* unsupported filter — skip */ }
          }
          ctx.drawImage(img, 0, 0);
          ctx.filter = "none";
          // Commemorative stamp: pup name, level, breed & date
          if (withStamp) {
            const breedNames: Record<DogBreed, string> = {
              golden: "Golden Retriever", chocolate: "Chocolate Lab", husky: "Siberian Husky",
              dalmatian: "Dalmatian", corgi: "Pembroke Corgi",
            };
            const stampText = `🐾 ${stats.name} • Lv ${stats.level} • ${breedNames[stats.breed]} • ${new Date().toLocaleDateString()}`;
            const pad = Math.round(canvas.width * 0.025);
            const fontSize = Math.max(14, Math.round(canvas.width * 0.022));
            ctx.font = `900 ${fontSize}px sans-serif`;
            const textW = ctx.measureText(stampText).width;
            ctx.fillStyle = "rgba(56, 102, 65, 0.82)";
            ctx.beginPath();
            ctx.roundRect(pad, canvas.height - pad - fontSize * 1.9, textW + fontSize * 1.2, fontSize * 1.6, fontSize * 0.5);
            ctx.fill();
            ctx.fillStyle = "#F2E8CF";
            ctx.textBaseline = "middle";
            ctx.fillText(stampText, pad + fontSize * 0.6, canvas.height - pad - fontSize * 1.1);
          }
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(raw);
        }
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    });
  };

  const handlePhotoCaptured = (dataUrl: string) => {
    bumpLifetime("photoCaptures", 1);
    logDayEvent("photosTaken", "Captured a Photo Mode shot");
    setAchTick((t) => t + 1);
    setReviewPhoto(dataUrl);
  };

  // Save a Photo Mode shot into the Memory Album
  const handleSavePhotoToAlbum = async (dataUrl: string) => {
    const small = await downscaleSnapshot(dataUrl, SNAP_MAX_DIM);
    const meta = getEmotionMeta(emotion);
    const photo: MemoryPhoto = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dataUrl: small,
      timestamp: Date.now(),
      dogName: stats.name,
      level: stats.level,
      emotionLabel: meta.label,
      favorite: false,
    };
    setPhotos((prev) => {
      const next = [photo, ...prev];
      while (next.length > MAX_ALBUM_PHOTOS) {
        const idx = next.map((p) => !p.favorite).lastIndexOf(true);
        next.splice(idx >= 0 ? idx : next.length - 1, 1);
      }
      return next;
    });
    showToast(`📸 Added to the Memory Album! (${photos.length + 1}/${MAX_ALBUM_PHOTOS})`);
  };

  // ===== Secret codes: found from chat — reward coins + collect the badge =====
  const handleSecretCodeFound = (codeId: string) => {
    const def = SECRET_CODES.find((c) => c.id === codeId);
    if (!def) return;
    setStats((prev) => ({
      ...prev,
      foundSecretCodes: [...new Set([...(prev.foundSecretCodes || []), codeId])],
      coins: prev.coins + def.rewardCoins,
      happiness: Math.min(100, prev.happiness + 10),
    }));
    bumpLifetime("coinsEarned", def.rewardCoins);
    setActiveSecretCode(def);
    setAchTick((t) => t + 1);
  };

  // ===== Google Account Linking: popup flow, +100 XP & +50 Coins on first link =====
  const handleLinkAccount = async () => {
    const acc = await linkAccount();
    if (!acc) {
      showToast("Account linking cancelled.");
      return;
    }
    const alreadyLinked = !!stats.linkedAccount;
    setAccount(acc);
    if (!alreadyLinked) {
      setStats((prev) => {
        const nextXp = prev.xp + 100;
        const newLevel = Math.floor(nextXp / 100) + 1;
        return {
          ...prev,
          linkedAccount: acc,
          xp: nextXp,
          level: newLevel,
          coins: prev.coins + 50,
        };
      });
      bumpLifetime("coinsEarned", 50);
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.4 } });
      sound.playRewardFanfare();
      showToast(`✅ Google account linked! +100 XP, +50 Coins — verified shield earned!`);
      setAchTick((t) => t + 1);
    } else {
      setStats((prev) => ({ ...prev, linkedAccount: acc }));
      showToast(`✅ Synced with ${acc.name}!`);
    }
  };

  const handleUnlinkAccount = () => {
    saveAccount(null);
    setAccount(null);
    setStats((prev) => ({ ...prev, linkedAccount: undefined }));
    showToast("Account unlinked.");
  };

  // ===== Bone Rush store refresh helper =====
  const refreshBoneRush = () => setBoneRushTick((t) => t + 1);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#2d4734] font-sans">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Anime iris transition for stair travel */}
      <IrisTransition phase={irisPhase} />

      {/* Cartoon black-screen chunk loader (stairs, car rides to the City) */}
      <CartoonTransition phase={cartoonPhase} label={cartoonLabel} />


      {/* Edit-mode touch controls (mobile friendly, no keyboard needed) */}
      {editMode && !anyModalOpen && (
        <EditModeBar
          selectedName={selectedEditId}
          onMove={handleEditMove}
          onMoveY={handleEditMoveY}
          onRotate={handleEditRotate}
          onDone={handleToggleEditMode}
        />
      )}

      {/* Cooking countdown chip (visible while the pot bubbles, opens the pot) */}
      {activeCookJob && !showCookingModal && !showReadyModal && (
        <button
          onClick={() => setShowCookingModal(true)}
          className="absolute top-20 sm:top-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-full bg-[#F50A26] hover:bg-[#C2081F] text-white text-xs sm:text-sm font-black shadow-2xl border-2 border-white/40 transition-all active:scale-95 cursor-pointer animate-pulse"
          title="Soup is cooking — tap to open the pot"
        >
          <span className="text-base">🍲</span>
          <span>{activeCookJob.recipeName} — {formatCookCountdown(cookMsLeft)}</span>
        </button>
      )}

      {/* Ready-meal beacon chip (outside the house, tap to reveal) */}
      {readyMeal && !showReadyModal && (
        <button
          onClick={() => setShowReadyModal(true)}
          className="absolute top-20 sm:top-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-full bg-[#F50A26] hover:bg-[#C2081F] text-white text-xs sm:text-sm font-black shadow-2xl border-2 border-yellow-300 transition-all active:scale-95 cursor-pointer animate-bounce"
          title="Soup is ready — tap to reveal!"
        >
          <span className="text-base">🍲</span>
          <span>{readyMeal.recipeName} is ready! Tap me!</span>
        </button>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-[#386641] border border-[#A7C957]/40 text-[#F2E8CF] font-bold text-xs sm:text-sm px-4 py-2 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Photo Mode: unobstructed viewfinder with poses, grid & filters */}
      {photoMode && !anyModalOpen && (
        <PhotoMode
          dogName={stats.name}
          onExit={() => { setPhotoMode(false); showToast("Back to the game! 🐾"); }}
          onPose={(action) => parkSceneRef.current?.dog.setAction(action, 6.0)}
          onCapture={handlePhotoCapture}
          onCaptured={handlePhotoCaptured}
        />
      )}

      {/* Interactive HUD & Actions Layer (hidden during Photo Mode) */}
      {!photoMode && <PetActionButtons
        stats={stats}
        emotion={emotion}
        currentAction={currentAction}
        timeOfDay={timeOfDay}
        soundEnabled={soundEnabled}
        followCamera={followCamera}
        viewMode={viewMode}
        houseRoom={houseRoom}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
        onActionClick={handleTriggerAction}
        onFeedClick={handleFeedAction}
        onPlayFetch={handlePlayFetch}
        onPetClick={handlePetClick}
        onTrainClick={handleTrainAction}
        onOpenChat={() => {
          stampInteraction();
          setShowChatModal(true);
        }}
        onOpenMiniGames={() => setShowMiniGameSelector(true)}
        onOpenCooking={() => setShowCookingModal(true)}
        onSwitchRoom={handleSwitchRoom}
        onOpenCustomizer={() => {
          setSettingsInitialTab("pet");
          setShowSettingsModal(true);
        }}
        onOpenSkillTree={() => setShowSkillTree(true)}
        onOpenSettings={(tab) => {
          setSettingsInitialTab(tab || "audio");
          setShowSettingsModal(true);
        }}
        onToggleTimeOfDay={handleToggleTimeOfDay}
        onToggleSound={handleToggleSound}
        onToggleCamera={handleToggleCamera}
        onToggleViewMode={handleToggleViewMode}
        onOpenShop={() => setShowShopModal(true)}
        onGoToBed={handleTriggerSleep}
        onToggleLamp={handleToggleLamp}
        onTakeSnapshot={handleTakeSnapshot}
        onOpenAlbum={() => setShowAlbum(true)}
        albumCount={photos.length}
        weather={weather}
        onCycleWeather={handleCycleWeather}
        holiday={holiday}
        onOpenPhotoMode={() => { stampInteraction(); setPhotoMode(true); }}
        onOpenBreedJournal={() => setShowBreedJournal(true)}
        streakDays={streakDays}
      />}

      {/* Canine Skill Tree Modal */}
      {showSkillTree && (
        <SkillTreeModal
          stats={stats}
          onUnlockSkill={handleUnlockSkill}
          onTryTrick={(act) => handleTriggerAction(act)}
          onClose={() => setShowSkillTree(false)}
        />
      )}

      {/* Treats & Energy Pantry Drawer Modal */}
      {showTreatsTray && (
        <TreatsTray
          dogName={stats.name}
          inventory={stats.treatsInventory}
          coins={stats.coins}
          energy={stats.energy}
          onFeed={handleFeedTreat}
          onBuy={handleBuyTreat}
          onClose={() => setShowTreatsTray(false)}
        />
      )}

      {/* Conversational Gemini Pet Chatbot Modal (with Live Voice API) */}
      {showChatModal && (
        <PetChatModal
          petStats={stats}
          holiday={holiday}
          onSecretCodeFound={handleSecretCodeFound}
          onClose={() => setShowChatModal(false)}
          onTriggerDogAction={(act) => {
            handleTriggerAction(act);
          }}
        />
      )}

      {/* Mini-Games Selector Modal */}
      {showMiniGameSelector && (
        <MiniGameSelectorModal
          dogName={stats.name}
          boneBalance={getBoneBalance()}
          onSelectGame={(game) => {
            setShowMiniGameSelector(false);
            stampInteraction();
            setActiveMiniGame(game);
          }}
          onOpenBoneRushStore={() => setShowBoneRushStore(true)}
          onOpenGalaxyArcade={() => {
            setShowMiniGameSelector(false);
            const scene = parkSceneRef.current;
            if (!scene) return;
            playCartoonTransition(
              "Teleporting to the Galaxy Arcade... 🌌",
              () => {
                scene.enterArcadeWorld(viewMode === "house" ? "upstairs" : "park");
              },
              "🌌 Galaxy Arcade! Tap a machine to play — or the 🏠 HOME portal to leave!"
            );
            setViewMode("arcade");
          }}
          onClose={() => setShowMiniGameSelector(false)}
        />
      )}

      {/* Active Mini-Game 1: Agility Park Course */}
      {activeMiniGame === "agility" && (
        <AgilityMiniGame
          dogName={stats.name}
          dogEnergy={stats.energy}
          onClose={() => setActiveMiniGame("none")}
          onGameComplete={(score, coinsEarned, energyUsed) => {
            const coinMultiplier = hasSkill("treasure_hunter") ? 1.5 : 1.0;
            const finalCoins = Math.round(coinsEarned * coinMultiplier);
            // Sunny outdoor play costs less energy, rain costs more
            const spent =
              weather === "sunny"
                ? Math.max(1, Math.ceil(energyUsed * 0.5))
                : weather === "rainy"
                  ? Math.round(energyUsed * 1.5)
                  : energyUsed;
            stampInteraction();
            setStats((prev) => ({
              ...prev,
              coins: prev.coins + finalCoins,
              xp: prev.xp + score,
              energy: Math.max(5, prev.energy - spent),
              happiness: Math.min(100, prev.happiness + 15),
            }));
            showToast(`Agility complete! +${finalCoins} Coins, +${score} XP`);
          }}
        />
      )}

      {/* Active Mini-Game: 3D Fetch Arena */}
      {activeMiniGame === "fetch" && (
        <FetchMiniGame
          dogName={stats.name}
          dogEnergy={stats.energy}
          onClose={() => setActiveMiniGame("none")}
          onGameComplete={(score, coinsEarned, energyUsed) => {
            const coinMultiplier = hasSkill("treasure_hunter") ? 1.5 : 1.0;
            const finalCoins = Math.round(coinsEarned * coinMultiplier);
            const spent =
              weather === "sunny"
                ? Math.max(1, Math.ceil(energyUsed * 0.5))
                : weather === "rainy"
                  ? Math.round(energyUsed * 1.5)
                  : energyUsed;
            stampInteraction();
            setStats((prev) => ({
              ...prev,
              coins: prev.coins + finalCoins,
              xp: prev.xp + score,
              energy: Math.max(0, prev.energy - spent),
              happiness: Math.min(100, prev.happiness + 18),
            }));
            showToast(`Fetch complete! +${finalCoins} Coins, +${score} XP`);
          }}
        />
      )}

      {/* Training Modal: teach sit / stay / fetch */}
      {showTrainingModal && (
        <TrainingModal
          dogName={stats.name}
          dogEnergy={stats.energy}
          trickProgress={stats.trickProgress || {}}
          trainingPoints={stats.trainingPoints}
          onTrain={handleTrainTrick}
          onOpenSkillTree={() => {
            setShowTrainingModal(false);
            setShowSkillTree(true);
          }}
          onClose={() => setShowTrainingModal(false)}
        />
      )}

      {/* Active Mini-Game: Subway Pup — Bone Rush (3D lane runner + wallet) */}
      {activeMiniGame === "boneRush" && (
        <BoneRushRunner
          dogName={stats.name}
          dogEnergy={stats.energy}
          walletTick={boneRushTick}
          onOpenStore={() => setShowBoneRushStore(true)}
          onClose={() => setActiveMiniGame("none")}
          onGameComplete={(score, coinsEarned, energyUsed) => {
            const coinMultiplier = hasSkill("treasure_hunter") ? 1.5 : 1.0;
            const finalCoins = Math.round(coinsEarned * coinMultiplier);
            stampInteraction();
            logDayEvent("miniGames", `Bone Rush run: ${score} bones banked`);
            if (score >= 20) logDayEvent("wins", `Bone Rush run with ${score} bones!`);
            bumpLifetime("coinsEarned", finalCoins);
            setStats((prev) => ({
              ...prev,
              coins: prev.coins + finalCoins,
              xp: prev.xp + score,
              energy: Math.max(0, prev.energy - energyUsed),
              happiness: Math.min(100, prev.happiness + 15),
            }));
            refreshBoneRush();
            setAchTick((t) => t + 1);
            showToast(`Bone Rush complete! 🦴 +${score} bones banked, +${finalCoins} Coins`);
          }}
        />
      )}

      {/* Bone Rush Store (launched from the runner or the game selector) */}
      {showBoneRushStore && (
        <BoneRushStore
          onClose={() => setShowBoneRushStore(false)}
          onChange={refreshBoneRush}
        />
      )}

      {/* Active Mini-Game: Paw Shuffle (Find the Hidden Treat) */}
      {activeMiniGame === "pawShuffle" && (
        <PawShuffleMiniGame
          dogName={stats.name}
          onClose={() => setActiveMiniGame("none")}
          onGameComplete={(score, coinsEarned, energyUsed) => {
            const finalCoins = Math.round(coinsEarned * (hasSkill("treasure_hunter") ? 1.5 : 1.0));
            bumpLifetime("coinsEarned", finalCoins);
            setStats((prev) => ({
              ...prev,
              coins: prev.coins + finalCoins,
              xp: prev.xp + score * 5,
              energy: Math.max(0, prev.energy - energyUsed),
              happiness: Math.min(100, prev.happiness + 12),
            }));
            refreshBoneRush();
            setAchTick((t) => t + 1);
            showToast(`Paw Shuffle done! +${finalCoins} Coins, +${score * 5} XP`);
          }}
        />
      )}

      {/* Active Mini-Game: Backyard Digger (5x5 buried treasure) */}
      {activeMiniGame === "backyardDigger" && (
        <BackyardDiggerMiniGame
          dogName={stats.name}
          onClose={() => setActiveMiniGame("none")}
          onGameComplete={(coinsEarned, xpEarned, energyUsed, fossils) => {
            const finalCoins = Math.round(coinsEarned * (hasSkill("treasure_hunter") ? 1.5 : 1.0));
            logDayEvent("digs", `Digger haul: +${coinsEarned} coins`);
            bumpLifetime("coinsEarned", finalCoins);
            if (fossils > 0) bumpLifetime("fossilsFound", fossils);
            setStats((prev) => ({
              ...prev,
              coins: prev.coins + finalCoins,
              xp: prev.xp + xpEarned,
              energy: Math.max(0, prev.energy - energyUsed),
              happiness: Math.min(100, prev.happiness + Math.min(25, 5 + coinsEarned / 4)),
            }));
            setAchTick((t) => t + 1);
            showToast(`Dig complete! 🏺 +${finalCoins} Coins, +${xpEarned} XP${fossils ? `, 🦕 ${fossils} fossil${fossils > 1 ? "s" : ""}!` : ""}`);
          }}
        />
      )}

      {/* City Supermarket: shopping dash (score 5/10 → take home 5 foods) */}
      {activeMiniGame === "supermarket" && (
        <SupermarketMiniGame
          dogName={stats.name}
          onClose={() => setActiveMiniGame("none")}
          onGameComplete={(score, foodId) => {
            setStats((prev) => {
              const next: PetStats = {
                ...prev,
                coins: prev.coins + 10,
                xp: prev.xp + score * 3,
                happiness: Math.min(100, prev.happiness + 10),
              };
              if (foodId) {
                next.ingredientsInventory = {
                  ...(prev.ingredientsInventory || {}),
                  [foodId]: ((prev.ingredientsInventory || {})[foodId] || 0) + 5,
                };
              }
              return next;
            });
            bumpLifetime("coinsEarned", 10);
            setAchTick((t) => t + 1);
            showToast(
              foodId
                ? `🛒 Shopping done! 5× ${ALL_INGREDIENTS.find((i) => i.id === foodId)?.name || "food"} added to your pantry!`
                : `🛒 Shopping done! ${score}/10 — come back for the 5/10 reward!`
            );
          }}
        />
      )}

      {/* City Gym: train with MAX the muscular coach dog! */}
      {activeMiniGame === "gym" && (
        <GymMiniGame
          dogName={stats.name}
          onClose={() => setActiveMiniGame("none")}
          onDogAction={(act) => {
            // The real 3D dog trains behind the modal too
            parkSceneRef.current?.dog.setAction(act, 5.5);
          }}
          onComplete={(xp, coins) => {
            bumpLifetime("gymSessions", 1);
            bumpLifetime("coinsEarned", coins);
            setStats((prev) => ({
              ...prev,
              xp: prev.xp + xp,
              coins: prev.coins + coins,
              energy: Math.max(0, prev.energy - 5),
              happiness: Math.min(100, prev.happiness + 12),
            }));
            setAchTick((t) => t + 1);
            showToast(`🏋️ Training complete! +${xp} XP, +${coins} Doggy Coins!`);
          }}
        />
      )}

      {/* Active Mini-Game 2: Treat Catch Frenzy */}
      {activeMiniGame === "treatCatch" && (
        <TreatCatchMiniGame
          dogName={stats.name}
          dogEnergy={stats.energy}
          onClose={() => setActiveMiniGame("none")}
          onGameComplete={(score, coinsEarned, energyBoost) => {
            const coinMultiplier = hasSkill("treasure_hunter") ? 1.5 : 1.0;
            const finalCoins = Math.round(coinsEarned * coinMultiplier);
            stampInteraction();
            setStats((prev) => ({
              ...prev,
              coins: prev.coins + finalCoins,
              xp: prev.xp + score,
              energy: Math.min(100, prev.energy + energyBoost),
              happiness: Math.min(100, prev.happiness + 20),
            }));
            showToast(`Treat Catch complete! +${finalCoins} Coins, +${energyBoost}% Energy`);
          }}
        />
      )}

      {/* Settings Menu Modal (Volume Sliders, Looping Park Ambiance, Pet Customization) */}
      {showSettingsModal && (
        <SettingsModal
          currentBreed={stats.breed}
          currentCollar={stats.collarColor}
          dogName={stats.name}
          timeOfDay={timeOfDay}
          followCamera={followCamera}
          stats={stats}
          account={account}
          holiday={holiday}
          onUpdateTimeOfDay={(newTime: TimeOfDay) => {
            setTimeOfDay(newTime);
            sound.setNightMode(newTime === "night");
            if (parkSceneRef.current) {
              parkSceneRef.current.setTimeOfDay(newTime);
            }
          }}
          onUpdateFollowCamera={(follow: boolean) => {
            setFollowCamera(follow);
            if (parkSceneRef.current) {
              parkSceneRef.current.followDog = follow;
            }
          }}
          onLinkAccount={handleLinkAccount}
          onOpenBreedJournal={() => {
            setShowSettingsModal(false);
            setShowBreedJournal(true);
          }}
          onOpenScoreboard={() => {
            setShowSettingsModal(false);
            setShowScoreboard(true);
          }}
          onUpdateBreed={(breed: DogBreed) => {
            setStats((prev) => ({ ...prev, breed }));
          }}
          onUpdateCollar={(collar: string) => {
            setStats((prev) => ({ ...prev, collarColor: collar }));
          }}
          onUpdateName={(name: string) => {
            setStats((prev) => ({ ...prev, name }));
          }}
          onClose={() => setShowSettingsModal(false)}
          initialTab={settingsInitialTab}
        />
      )}

      {/* Pet Styling & Breed Customizer Modal */}
      {showCustomizer && (
        <PetCustomizerModal
          currentBreed={stats.breed}
          currentCollar={stats.collarColor}
          dogName={stats.name}
          onUpdateBreed={(breed: DogBreed) => {
            setStats((prev) => ({ ...prev, breed }));
          }}
          onUpdateCollar={(collar: string) => {
            setStats((prev) => ({ ...prev, collarColor: collar }));
          }}
          onUpdateName={(name: string) => {
            setStats((prev) => ({ ...prev, name }));
          }}
          onClose={() => setShowCustomizer(false)}
        />
      )}

      {/* House Shop Modal: bed, accessories, toys + lumberjack axe tools */}
      {showShopModal && (
        <HouseShopModal
          stats={stats}
          onClose={() => setShowShopModal(false)}
          onUpdateBedColors={handleUpdateBedColors}
          onBuyAccessory={handleBuyAccessory}
          onEquipAccessory={handleEquipAccessory}
          onBuyToy={handleBuyToy}
          onBuyTool={handleBuyTool}
        />
      )}

      {/* Kitchen Cooking Modal: pyramid pot (2 top + 3 bottom) + 2:00 countdown */}
      {showCookingModal && (
        <CookingModal
          dogName={stats.name}
          inventory={stats.ingredientsInventory || {}}
          coins={stats.coins}
          activeJob={activeCookJob}
          jobMsLeft={cookMsLeft}
          onCook={handleCookRecipe}
          onBuyIngredient={handleBuyIngredient}
          onClose={() => setShowCookingModal(false)}
        />
      )}

      {/* Memory Album: snapshots gallery with favorites */}
      {showAlbum && (
        <MemoryAlbumModal
          photos={photos}
          maxPhotos={MAX_ALBUM_PHOTOS}
          onTakeSnapshot={handleTakeSnapshot}
          onToggleFavorite={handleToggleFavoritePhoto}
          onDelete={handleDeletePhoto}
          onClose={() => setShowAlbum(false)}
        />
      )}

      {/* Soup-ready reveal: pot spins, lid slides off, dish info appears */}
      {showReadyModal && readyMeal && (
        <SoupReadyModal
          job={readyMeal}
          dogName={stats.name}
          onServe={handleServeReadyMeal}
          onClose={() => setShowReadyModal(false)}
        />
      )}

      {/* Secret code easter-egg reveal (e.g. the legendary HaPpY m3aL) */}
      {activeSecretCode && (
        <SecretCodeModal
          code={activeSecretCode}
          dogName={stats.name}
          onClose={() => setActiveSecretCode(null)}
        />
      )}

      {/* Breed Discovery Journal */}
      {showBreedJournal && (
        <BreedJournal
          dogName={stats.name}
          dogBreed={stats.breed}
          level={stats.level}
          accountName={account?.name}
          onClose={() => setShowBreedJournal(false)}
          onOpenScoreboard={() => {
            setShowBreedJournal(false);
            setShowScoreboard(true);
          }}
          onLinkAccount={handleLinkAccount}
        />
      )}

      {/* Online Scoreboard (global trainers + Google-verified shields) */}
      {showScoreboard && (
        <ScoreboardModal
          dogName={stats.name}
          level={stats.level}
          xp={stats.xp}
          accountName={account?.name}
          googleVerified={account?.googleVerified}
          onClose={() => setShowScoreboard(false)}
          onLinkAccount={handleLinkAccount}
        />
      )}

      {/* Photo Mode review: save to device / clipboard / album / snap another */}
      {reviewPhoto && (
        <PhotoReviewModal
          photoUrl={reviewPhoto}
          dogName={stats.name}
          onSaveToAlbum={() => handleSavePhotoToAlbum(reviewPhoto)}
          onSnapAnother={() => {
            setReviewPhoto(null);
            if (!photoMode) setPhotoMode(true);
          }}
          onClose={() => setReviewPhoto(null)}
          onToast={showToast}
        />
      )}

      {/* Good Night & Fresh Day Sleep Transition Overlay */}
      {isSleeping && (
        <SleepOverlay
          dogName={stats.name}
          onWakeUp={handleWakeUp}
        />
      )}
    </div>
  );
}
