import React, { useMemo, useState } from "react";
import { X, Coins, Flame, ShoppingBasket, ChefHat, Sparkles, Zap, Heart, Leaf, FlaskConical } from "lucide-react";
import {
  ALL_INGREDIENTS,
  ALL_RECIPES,
  BASIC_INGREDIENTS,
  FOREST_INGREDIENTS,
  MYSTERY_MUSH,
  SEASONINGS,
  isSeasoning,
} from "./ingredientsData";
import { IngredientItem, Recipe } from "../../types/pet";
import { sound } from "../../utils/audio";

interface CookingModalProps {
  dogName: string;
  inventory: Record<string, number>;
  coins: number;
  onCook: (recipe: Recipe) => void;
  onBuyIngredient: (ingredientId: string) => void;
  onClose: () => void;
}

const MAX_BASES = 2;
const MAX_SEASONINGS = 3;

/** Press-and-hold delay before a shelf item becomes draggable (touch friendly). */
const DRAG_HOLD_MS = 220;
const DRAG_MOVE_PX = 12;

interface DragGhost {
  id: string;
  icon: string;
  name: string;
  x: number;
  y: number;
}

export const CookingModal: React.FC<CookingModalProps> = ({
  dogName,
  inventory,
  coins,
  onCook,
  onBuyIngredient,
  onClose,
}) => {
  // Pot pyramid: 2 base squares on top, 3 seasoning squares below
  const [selectedBases, setSelectedBases] = useState<string[]>([]);
  const [selectedSeasonings, setSelectedSeasonings] = useState<string[]>([]);
  const [isCooking, setIsCooking] = useState(false);
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);

  // Press-hold-drag bookkeeping (works with mouse + touch, no keyboard needed)
  const pendingDrag = React.useRef<{
    id: string;
    startX: number;
    startY: number;
    timer: number | null;
    active: boolean;
  } | null>(null);
  const suppressClick = React.useRef(false);

  const ingredientMap = useMemo(() => {
    const m: Record<string, IngredientItem> = {};
    ALL_INGREDIENTS.forEach((i) => (m[i.id] = i));
    return m;
  }, []);

  const selected = useMemo(
    () => [...selectedBases, ...selectedSeasonings],
    [selectedBases, selectedSeasonings]
  );

  const toggleBase = (id: string) => {
    sound.playButtonTap();
    setSelectedBases((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id].slice(0, MAX_BASES)
    );
  };

  const toggleSeasoning = (id: string) => {
    sound.playButtonTap();
    setSelectedSeasonings((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id].slice(0, MAX_SEASONINGS)
    );
  };

  const clearPot = () => {
    sound.playButtonTap();
    setSelectedBases([]);
    setSelectedSeasonings([]);
  };

  const removeFromPot = (id: string) => {
    sound.playButtonTap();
    if (isSeasoning(id)) {
      setSelectedSeasonings((prev) => prev.filter((s) => s !== id));
    } else {
      setSelectedBases((prev) => prev.filter((s) => s !== id));
    }
  };

  const addToPot = (id: string, slotId?: string) => {
    if (isSeasoning(id)) {
      setSelectedSeasonings((prev) => {
        if (slotId?.startsWith("sea-")) {
          const idx = Number(slotId.slice(4));
          const next = [...prev];
          while (next.length <= idx) next.push("");
          next[idx] = id;
          return next.filter(Boolean).slice(0, MAX_SEASONINGS);
        }
        if (prev.includes(id)) return prev;
        return [...prev, id].slice(0, MAX_SEASONINGS);
      });
    } else {
      setSelectedBases((prev) => {
        if (slotId?.startsWith("base-")) {
          const idx = Number(slotId.slice(5));
          const next = [...prev];
          while (next.length <= idx) next.push("");
          next[idx] = id;
          return next.filter(Boolean).slice(0, MAX_BASES);
        }
        if (prev.includes(id)) return prev;
        return [...prev, id].slice(0, MAX_BASES);
      });
    }
  };

  const cancelPendingDrag = () => {
    const pending = pendingDrag.current;
    if (pending?.timer) window.clearTimeout(pending.timer);
    pendingDrag.current = null;
  };

  const beginShelfPress = (e: React.PointerEvent, ing: IngredientItem) => {
    // Don't fight with the buy button (it stops propagation)
    cancelPendingDrag();
    const startX = e.clientX;
    const startY = e.clientY;
    const pending = { id: ing.id, startX, startY, timer: null as number | null, active: false };
    pendingDrag.current = pending;
    pending.timer = window.setTimeout(() => {
      if (pendingDrag.current !== pending) return;
      pending.active = true;
      suppressClick.current = true;
      setDragGhost({ id: ing.id, icon: ing.icon, name: ing.name, x: startX, y: startY });
      sound.playButtonTap();
    }, DRAG_HOLD_MS);
  };

  // Global pointer tracking while a press is pending or dragging
  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const pending = pendingDrag.current;
      if (!pending) return;
      const moved = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
      if (!pending.active && moved > DRAG_MOVE_PX) {
        if (pending.timer) window.clearTimeout(pending.timer);
        pending.active = true;
        suppressClick.current = true;
        const ing = ingredientMap[pending.id];
        setDragGhost({ id: pending.id, icon: ing?.icon ?? "❓", name: ing?.name ?? "", x: e.clientX, y: e.clientY });
        sound.playButtonTap();
      } else if (pending.active) {
        setDragGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
      }
    };
    const onUp = (e: PointerEvent) => {
      const pending = pendingDrag.current;
      cancelPendingDrag();
      if (!pending?.active) {
        // Plain tap: let the click handler do the quick-add. Reset the
        // suppress flag after the click event has had a chance to fire.
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        setDragGhost(null);
        return;
      }
      setDragGhost(null);
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slot = el?.closest?.("[data-pot-slot]") as HTMLElement | null;
      if (slot?.dataset.potSlot) {
        addToPot(pending.id, slot.dataset.potSlot);
        sound.playCrunch();
      } else {
        const pot = el?.closest?.("[data-pot-panel]");
        if (pot) {
          addToPot(pending.id);
          sound.playCrunch();
        }
      }
      // Swallow the click that follows a real drag
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 50);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cancelPendingDrag);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cancelPendingDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matchedRecipe = useMemo(() => {
    if (selected.length === 0) return null;
    const set = new Set(selected);
    for (const r of ALL_RECIPES) {
      if (r.ingredients.length === selected.length && r.ingredients.every((i) => set.has(i))) {
        return r;
      }
    }
    return null;
  }, [selected]);

  const haveAllSelected = useMemo(
    () => selected.length > 0 && selected.every((id) => (inventory[id] || 0) > 0),
    [selected, inventory]
  );

  const canCookSelected = !!matchedRecipe && haveAllSelected;

  // Mystery mush: a filled pot with no known recipe still cooks something!
  const canCookMystery = !matchedRecipe && haveAllSelected;

  const handleCook = () => {
    if ((!canCookSelected && !canCookMystery) || isCooking) return;
    setIsCooking(true);
    sound.playCrunch();
    const dish: Recipe = matchedRecipe ?? { ...MYSTERY_MUSH, ingredients: [...selected] };
    setTimeout(() => {
      onCook(dish);
      clearPot();
      setIsCooking(false);
    }, 900);
  };

  const cookableRecipes = useMemo(
    () =>
      ALL_RECIPES.map((r) => ({
        recipe: r,
        haveAll: r.ingredients.every((id) => (inventory[id] || 0) > 0),
      })),
    [inventory]
  );

  const renderShelf = (
    title: string,
    icon: React.ReactNode,
    items: IngredientItem[],
    isPicked: (id: string) => boolean,
    onPick: (id: string) => void
  ) => (
    <div>
      <label className="text-xs font-black uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
        {icon} {title}
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {items.map((ing) => {
          const count = inventory[ing.id] || 0;
          const picked = isPicked(ing.id);
          const canAfford = coins >= ing.cost;
          return (
            <div
              key={ing.id}
              onPointerDown={(e) => beginShelfPress(e, ing)}
              className={`p-3 rounded-2xl border bg-white flex flex-col gap-1.5 transition-all select-none [touch-action:pan-y] ${
                picked
                  ? "border-orange-500 ring-2 ring-orange-400/50 shadow-md scale-[1.02]"
                  : "border-amber-200 hover:border-orange-300"
              }`}
            >
              <button
                onClick={() => {
                  if (suppressClick.current) return;
                  onPick(ing.id);
                }}
                className="text-left cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{ing.icon}</span>
                  <span
                    className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                      count > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                    }`}
                  >
                    x{count}
                  </span>
                </div>
                <div className="text-sm font-black mt-1">{ing.name}</div>
                <div className="text-[11px] text-amber-800/80 leading-snug">{ing.description}</div>
              </button>
              <button
                onClick={() => onBuyIngredient(ing.id)}
                disabled={!canAfford}
                title={`Buy 1 for ${ing.cost} coins`}
                className={`py-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition ${
                  canAfford
                    ? "bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                    : "bg-stone-200 text-stone-400 cursor-not-allowed"
                }`}
              >
                <Coins className="w-3 h-3" /> Buy {ing.cost}c
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPotSlot = (
    filledId: string | undefined,
    placeholder: string,
    kind: "base" | "seasoning",
    slotId: string
  ) => (
    <button
      data-pot-slot={slotId}
      onClick={() => filledId && removeFromPot(filledId)}
      title={filledId ? `${ingredientMap[filledId]?.name} — tap to remove` : `${placeholder} — drop here`}
      className={`aspect-square rounded-xl border-2 flex items-center justify-center text-3xl transition-all ${
        filledId
          ? kind === "base"
            ? "border-orange-500 bg-orange-100 shadow-inner cursor-pointer hover:scale-105"
            : "border-violet-400 bg-violet-100 shadow-inner cursor-pointer hover:scale-105"
          : "border-dashed border-amber-900/25 bg-amber-950/5 text-amber-900/30"
      }`}
    >
      {filledId ? ingredientMap[filledId]?.icon : <span className="text-lg font-black">+</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-[#FFF7ED] border border-amber-900/20 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden text-amber-950 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-700 via-amber-600 to-yellow-500 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black leading-tight">🍲 Kitchen Pot — Cook for {dogName}</h2>
              <p className="text-xs text-amber-100 font-medium">
                Pyramid pot: 2 bases on top + 3 seasonings below — hold & drag!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/25 rounded-full text-sm font-bold">
              <Coins className="w-4 h-4 text-yellow-300" />
              <span>{coins}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/15 hover:bg-white/30 transition cursor-pointer"
              aria-label="Close cooking"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
            {/* LEFT: the square pot (pyramid: 2 top + 3 bottom) */}
            <div
              data-pot-panel
              className="bg-amber-100/70 border border-amber-300 rounded-2xl p-4 flex flex-col gap-3 h-fit lg:sticky lg:top-0"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-4xl animate-bounce">🍲</span>
                <p className="font-black text-amber-950 text-sm">The Square Pot</p>
              </div>

              {/* Top squares: bases */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-1.5">
                  Bases (pick 2)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {renderPotSlot(selectedBases[0], "Base 1", "base", "base-0")}
                  {renderPotSlot(selectedBases[1], "Base 2", "base", "base-1")}
                </div>
              </div>

              {/* Bottom squares: seasonings (pyramid base) */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-violet-900 mb-1.5">
                  Seasonings (up to 3)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {renderPotSlot(selectedSeasonings[0], "Spice 1", "seasoning", "sea-0")}
                  {renderPotSlot(selectedSeasonings[1], "Spice 2", "seasoning", "sea-1")}
                  {renderPotSlot(selectedSeasonings[2], "Spice 3", "seasoning", "sea-2")}
                </div>
              </div>

              <p className="text-xs font-bold text-amber-950 min-h-8 leading-snug">
                {isCooking
                  ? "Cooking... stir that stew! 🔥"
                  : matchedRecipe
                    ? `Ready: ${matchedRecipe.icon} ${matchedRecipe.name}!`
                    : canCookMystery
                      ? "Unknown combo... risky, but exciting! ❓"
                      : selected.length === 0
                        ? "Tap ingredients on the right to fill the pot."
                        : "Keep adding... match a recipe to cook!"}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={handleCook}
                  disabled={(!canCookSelected && !canCookMystery) || isCooking}
                  className={`flex-1 px-4 py-2.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    (canCookSelected || canCookMystery) && !isCooking
                      ? "bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/30 cursor-pointer"
                      : "bg-amber-950/10 text-amber-950/35 cursor-not-allowed"
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  {isCooking ? "Cooking..." : canCookMystery ? "Risk it!" : "Cook!"}
                </button>
                {selected.length > 0 && !isCooking && (
                  <button
                    onClick={clearPot}
                    className="px-3 py-2.5 rounded-2xl text-xs font-black border border-amber-400 text-amber-900 hover:bg-amber-200/60 transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT: ingredient shelves + recipes */}
            <div className="space-y-5">
              {renderShelf(
                "Pantry basics",
                <ShoppingBasket className="w-3.5 h-3.5" />,
                BASIC_INGREDIENTS,
                (id) => selectedBases.includes(id),
                toggleBase
              )}
              {renderShelf(
                "Forest finds",
                <Leaf className="w-3.5 h-3.5" />,
                FOREST_INGREDIENTS,
                (id) => selectedBases.includes(id),
                toggleBase
              )}
              {renderShelf(
                "Seasoning shelf",
                <FlaskConical className="w-3.5 h-3.5" />,
                SEASONINGS,
                (id) => selectedSeasonings.includes(id),
                toggleSeasoning
              )}

              {/* Recipes */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-amber-800 mb-2 block">
                  Recipe book — match the pot to unlock the dish
                </label>
                <div className="space-y-2.5">
                  {cookableRecipes.map(({ recipe, haveAll }) => {
                    const isMatch = matchedRecipe?.id === recipe.id;
                    return (
                      <div
                        key={recipe.id}
                        className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${
                          isMatch
                            ? "bg-orange-50 border-orange-500 ring-2 ring-orange-400/40 shadow-md"
                            : "bg-white border-amber-200"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-3xl shrink-0">
                          {recipe.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black">{recipe.name}</h4>
                            {isMatch && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-600 text-white flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> MATCHED!
                              </span>
                            )}
                            {!haveAll && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                                Missing ingredients
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-amber-900/75 mt-0.5">{recipe.description}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[11px] font-bold bg-white border border-amber-200 rounded-full px-2 py-0.5">
                              {recipe.ingredients.map((id) => ingredientMap[id]?.icon).join(" + ")}
                            </span>
                            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5">
                              <Zap className="w-3 h-3" /> +{recipe.energyBoost}%
                            </span>
                            <span className="text-[11px] font-bold text-rose-700 flex items-center gap-0.5">
                              <Heart className="w-3 h-3" /> +{recipe.happinessBoost}%
                            </span>
                            <span className="text-[11px] font-bold text-amber-700">
                              −{recipe.hungerReduction}% hunger • +{recipe.xp} XP
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedBases(recipe.ingredients.filter((id) => !isSeasoning(id)));
                            setSelectedSeasonings(recipe.ingredients.filter((id) => isSeasoning(id)));
                            sound.playButtonTap();
                          }}
                          className="shrink-0 px-3 py-2 rounded-xl text-[11px] font-black bg-amber-100 hover:bg-amber-200 text-amber-900 transition cursor-pointer"
                        >
                          Load
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-white border-t border-amber-200 flex items-center justify-between text-xs text-amber-800">
          <span>Tap to add, or hold & drag into the pot. Cooked meals feed {dogName} instantly!</span>
          <button onClick={onClose} className="font-black hover:underline text-amber-950 cursor-pointer">
            Done
          </button>
        </div>
      </div>

      {/* Floating drag ghost (finger/mouse) */}
      {dragGhost && (
        <div
          className="fixed z-[60] pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: dragGhost.x, top: dragGhost.y }}
        >
          <div className="w-16 h-16 rounded-2xl bg-white border-2 border-orange-500 shadow-2xl flex items-center justify-center text-4xl scale-110">
            {dragGhost.icon}
          </div>
          <div className="mt-1 px-2 py-0.5 rounded-full bg-amber-950 text-white text-[10px] font-black whitespace-nowrap">
            {dragGhost.name}
          </div>
        </div>
      )}
    </div>
  );
};
