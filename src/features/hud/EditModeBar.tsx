import React from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpFromLine,
  ArrowDownToLine,
  RotateCw,
  RotateCcw,
  Check,
  Move3d,
} from "lucide-react";

interface EditModeBarProps {
  selectedName: string | null;
  onMove: (dx: number, dz: number) => void;
  onMoveY: (dy: number) => void;
  onRotate: (axis: "x" | "y" | "z") => void;
  onDone: () => void;
}

const PRETTY_NAMES: Record<string, string> = {
  bed: "🛏️ Bed",
  toy: "🧸 House toy",
  toycorner: "📦 Toy corner",
  lamp: "💡 Lamp",
  dresser: "🗄️ Dresser",
  bookshelf: "📚 Bookshelf",
  fridge: "❄️ Fridge",
  counters: "🍳 Counters",
  shelf: "🫙 Shelves",
  bowls: "🥣 Bowls",
  hurdle: "🏁 Agility course",
};

export const EditModeBar: React.FC<EditModeBarProps> = ({
  selectedName,
  onMove,
  onMoveY,
  onRotate,
  onDone,
}) => {
  const padBtn =
    "p-3 rounded-2xl bg-white/90 hover:bg-white active:bg-[#A7C957] text-[#386641] shadow-md border border-[#386641]/20 transition-all active:scale-95 cursor-pointer touch-none select-none";
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className="bg-[#1f2937]/90 backdrop-blur-md border border-white/15 rounded-3xl px-4 py-3 shadow-2xl text-[#F2E8CF] max-w-[94vw]">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-black flex items-center gap-1.5">
            <Move3d className="w-4 h-4 text-[#A7C957]" />
            Edit mode:{" "}
            {selectedName
              ? PRETTY_NAMES[selectedName] ||
                (selectedName.startsWith("tree") ? "🌲 Tree" : selectedName)
              : "tap anything (park + rooms)"}
          </span>
          <button
            onClick={onDone}
            className="px-3 py-1.5 rounded-full text-xs font-black bg-[#A7C957] hover:bg-[#97b949] text-[#1d3325] flex items-center gap-1 transition cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" /> Done
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          {/* Move pad */}
          <div className="grid grid-cols-3 gap-1">
            <span />
            <button className={padBtn} onClick={() => onMove(0, -0.25)} aria-label="Move forward">
              <ChevronUp className="w-5 h-5" />
            </button>
            <span />
            <button className={padBtn} onClick={() => onMove(-0.25, 0)} aria-label="Move left">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className={padBtn} onClick={() => onMove(0, 0.25)} aria-label="Move back">
              <ChevronDown className="w-5 h-5" />
            </button>
            <button className={padBtn} onClick={() => onMove(0.25, 0)} aria-label="Move right">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Lift pad (Y axis) */}
          <div className="flex flex-col gap-1">
            <button className={padBtn} onClick={() => onMoveY(0.25)} aria-label="Lift up" title="Lift up (Y axis)">
              <ArrowUpFromLine className="w-5 h-5" />
            </button>
            <button className={padBtn} onClick={() => onMoveY(-0.25)} aria-label="Lower down" title="Lower down (Y axis)">
              <ArrowDownToLine className="w-5 h-5" />
            </button>
          </div>

          {/* Rotate pad */}
          <div className="grid grid-cols-2 gap-1">
            <button className={padBtn} onClick={() => onRotate("y")} aria-label="Spin around" title="Spin (Y axis)">
              <RotateCw className="w-5 h-5" />
            </button>
            <button className={padBtn} onClick={() => onRotate("x")} aria-label="Tilt forward" title="Tilt (X axis)">
              <span className="text-sm font-black">X</span>
            </button>
            <button className={padBtn} onClick={() => onRotate("z")} aria-label="Tilt sideways" title="Tilt (Z axis)">
              <span className="text-sm font-black">Z</span>
            </button>
            <button
              className={padBtn}
              onClick={() => {
                onRotate("y");
                onRotate("y");
                onRotate("y");
              }}
              aria-label="Spin back"
              title="Spin back"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <p className="mt-2 text-center text-[10px] text-white/60 font-semibold leading-relaxed">
          👆 Drag moves • double-tap spins • two-finger tap tilts • pinch lifts/lowers • hold nudges up
          <br />
          ⌨️ Arrows move • Shift+Up/Down spins (Y) • Shift+Left/Right tilts (X/Z)
        </p>
      </div>
    </div>
  );
};
