import React, { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { ParkScene, RoomLayout, TimeOfDay } from "./features/dog3d/ParkScene";
import {
  BedColors,
  DogAction,
  DogBreed,
  HouseRoom,
  HouseViewMode,
  MiniGameType,
  PetStats,
  Recipe,
  SkillNode,
  TreatItem,
} from "./types/pet";
import { CookingModal } from "./features/cooking/CookingModal";
import { ALL_INGREDIENTS, DEFAULT_INGREDIENTS } from "./features/cooking/ingredientsData";
import { deriveEmotion } from "./features/emotions/emotion";
import { TRAINABLE_TRICKS, TrickId, trainSuccessChance, trainGain, trickTierFor } from "./features/training/trainingData";
import { TrainingModal, TrainResult } from "./features/training/TrainingModal";
import { PetActionButtons } from "./features/hud/PetActionButtons";
import { TreatsTray } from "./features/treats/TreatsTray";
import { PetChatModal } from "./features/chat/PetChatModal";
import { MiniGameSelectorModal } from "./features/minigames/MiniGameSelectorModal";
import { AgilityMiniGame } from "./features/minigames/AgilityMiniGame";
import { TreatCatchMiniGame } from "./features/minigames/TreatCatchMiniGame";
import { FetchMiniGame } from "./features/minigames/FetchMiniGame";
import { PetCustomizerModal } from "./features/hud/PetCustomizerModal";
import { SettingsModal } from "./features/hud/SettingsModal";
import { SkillTreeModal } from "./features/skills/SkillTreeModal";
import { HouseShopModal } from "./features/shop/HouseShopModal";
import { SleepOverlay } from "./features/hud/SleepOverlay";
import { IrisTransition, IrisPhase } from "./features/hud/IrisTransition";
import { EditModeBar } from "./features/hud/EditModeBar";
import { sound } from "./utils/audio";

const LAYOUT_STORAGE_KEY = "doghouse_layout_v1";

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

  // Action & Environment States
  const [currentAction, setCurrentAction] = useState<DogAction>("idle");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [followCamera, setFollowCamera] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<HouseViewMode>("park");
  const [houseRoom, setHouseRoom] = useState<HouseRoom>("living");
  const [showCookingModal, setShowCookingModal] = useState<boolean>(false);

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
  const [settingsInitialTab, setSettingsInitialTab] = useState<"audio" | "pet" | "environment">("audio");

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

  // Save pet stats to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("pet_game_stats_v2", JSON.stringify(stats));
    } catch (e) {
      console.warn("Failed to save pet stats", e);
    }
  }, [stats]);

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
  useEffect(() => {
    const timer = setInterval(() => {
      setStats((prev) => {
        const newHunger = Math.min(100, prev.hunger + 1);
        const newEnergy = Math.max(10, prev.energy - (newHunger > 70 ? 2 : 1));
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

      showToast(`Good dog, ${stats.name}! Caught the ball! (+${points} XP, +${coinsEarned} Coins)`);

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
          happiness: Math.min(100, prev.happiness + 10),
          energy: Math.max(0, prev.energy - 8),
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
      playIrisTransition(() => {
        scene.enterUpstairs();
      }, `Upstairs bedroom! ${stats.name} made it to the top! 🛏️✨`);
    };

    scene.onDescendClicked = () => {
      playIrisTransition(() => {
        scene.enterHallway();
      }, "Back down in the hallway! 🐾");
    };

    scene.onEditChanged = (selectedId) => {
      setSelectedEditId(selectedId);
      saveLayout();
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
    showTrainingModal ||
    isSleeping;

  // Edit-mode keyboard controls: arrows move, Shift+arrows rotate
  // (Up/Down = turn on the Y axis, Left = X axis, Right = Z axis)
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

  // Toggle View Mode: Between Park and House
  const handleToggleViewMode = () => {
    if (!parkSceneRef.current) return;
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

  // Edit mode: rearrange furniture (keyboard arrows + touch controls)
  const handleToggleEditMode = () => {
    const scene = parkSceneRef.current;
    if (!scene) return;
    if (!editMode && viewMode !== "house") {
      showToast("Enter the dog house first to rearrange furniture! 🏠");
      return;
    }
    const next = !editMode;
    if (!next) saveLayout();
    scene.setEditMode(next);
    setEditMode(next);
    setSelectedEditId(null);
    showToast(next ? "Edit mode: tap furniture, then move it! 🛋️" : "Furniture saved! ✨");
  };

  const handleEditMove = (dx: number, dz: number) => {
    parkSceneRef.current?.moveSelected(dx, dz);
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

  // Cooking: combine basic ingredients into a meal that feeds the dog
  const handleCookRecipe = (recipe: Recipe) => {
    const inv = stats.ingredientsInventory || {};
    const missing = recipe.ingredients.filter((id) => (inv[id] || 0) <= 0);
    if (missing.length > 0) {
      showToast("Missing ingredients for that recipe!");
      return;
    }
    if (parkSceneRef.current) {
      parkSceneRef.current.feedTreat();
    }
    stampInteraction();
    sound.playRewardFanfare();
    confetti({ particleCount: 70, spread: 75, origin: { y: 0.65 } });

    setStats((prev) => {
      const nextInv = { ...(prev.ingredientsInventory || {}) };
      recipe.ingredients.forEach((id) => {
        nextInv[id] = Math.max(0, (nextInv[id] || 1) - 1);
      });
      const nextXp = prev.xp + recipe.xp;
      const newLevel = Math.floor(nextXp / 100) + 1;
      if (newLevel > prev.level) {
        showToast(`🌟 Level Up! ${prev.name} is now Level ${newLevel}!`);
      }
      return {
        ...prev,
        ingredientsInventory: nextInv,
        energy: Math.min(100, prev.energy + recipe.energyBoost),
        happiness: Math.min(100, prev.happiness + recipe.happinessBoost),
        hunger: Math.max(0, prev.hunger - recipe.hungerReduction),
        xp: nextXp,
        level: newLevel,
        coins: prev.coins + 5,
        lastFed: Date.now(),
      };
    });
    showToast(
      `${recipe.icon} Cooked ${recipe.name}! ${stats.name} munches happily! (+${recipe.energyBoost}% Energy, +${recipe.xp} XP)`
    );
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#2d4734] font-sans">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Anime iris transition for stair travel */}
      <IrisTransition phase={irisPhase} />

      {/* Edit-mode touch controls (mobile friendly, no keyboard needed) */}
      {editMode && !anyModalOpen && (
        <EditModeBar
          selectedName={selectedEditId}
          onMove={handleEditMove}
          onRotate={handleEditRotate}
          onDone={handleToggleEditMode}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-[#386641] border border-[#A7C957]/40 text-[#F2E8CF] font-bold text-xs sm:text-sm px-4 py-2 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Interactive HUD & Actions Layer */}
      <PetActionButtons
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
      />

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
          onSelectGame={(game) => {
            setShowMiniGameSelector(false);
            stampInteraction();
            setActiveMiniGame(game);
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
            stampInteraction();
            setStats((prev) => ({
              ...prev,
              coins: prev.coins + finalCoins,
              xp: prev.xp + score,
              energy: Math.max(5, prev.energy - energyUsed),
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
            stampInteraction();
            setStats((prev) => ({
              ...prev,
              coins: prev.coins + finalCoins,
              xp: prev.xp + score,
              energy: Math.max(0, prev.energy - energyUsed),
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
          onUpdateBreed={(breed: DogBreed) => {
            setStats((prev) => ({ ...prev, breed }));
          }}
          onUpdateCollar={(collar: string) => {
            setStats((prev) => ({ ...prev, collarColor: collar }));
          }}
          onUpdateName={(name: string) => {
            setStats((prev) => ({ ...prev, name }));
          }}
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

      {/* House Shop Modal: 3 Bed Parts (Cushion, Frame, Blanket) Color Customizer, Accessories (Hats, Bowties, Glasses), and House Toys */}
      {showShopModal && (
        <HouseShopModal
          stats={stats}
          onClose={() => setShowShopModal(false)}
          onUpdateBedColors={handleUpdateBedColors}
          onBuyAccessory={handleBuyAccessory}
          onEquipAccessory={handleEquipAccessory}
          onBuyToy={handleBuyToy}
        />
      )}

      {/* Kitchen Cooking Modal: central pot + basic ingredients */}
      {showCookingModal && (
        <CookingModal
          dogName={stats.name}
          inventory={stats.ingredientsInventory || {}}
          coins={stats.coins}
          onCook={handleCookRecipe}
          onBuyIngredient={handleBuyIngredient}
          onClose={() => setShowCookingModal(false)}
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
