import React from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  RotateCcw,
  Check,
  Move3d,
} from "lucide-react";

interface EditModeBarProps {
  selectedName: string | null;
  onMove: (dx: number, dz: number) => void;
  onRotate: (axis: "x" | "y" | "z") => void;
  onDone: () => void;
}

const PRETTY_NAMES: Record<string, string> = {
  bed: "🛏️ Bed",
  toy: "🧸 House toy",
  toycorner: "📦 Toy corner",
  lamp: "💡 Lamp",
};

export const EditModeBar: React.FC<EditModeBarProps> = ({
  selectedName,
  onMove,
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
            Edit mode: {selectedName ? PRETTY_NAMES[selectedName] || selectedName : "tap furniture"}
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

        <p className="mt-2 text-center text-[10px] text-white/60 font-semibold">
          Drag furniture with a finger • double-tap spins • keyboard: arrows move, Shift+arrows turn
        </p>
      </div>
    </div>
  );
};
