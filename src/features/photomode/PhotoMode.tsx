import React, { useState } from "react";
import { X, Grid3x3, Camera, RefreshCcw, Stamp, Sparkles } from "lucide-react";
import { DogAction } from "../../types/pet";
import { sound } from "../../utils/audio";

export interface PhotoFilter {
  id: string;
  name: string;
  icon: string;
  css: string;
}

export const PHOTO_FILTERS: PhotoFilter[] = [
  { id: "natural", name: "Natural", icon: "🌿", css: "" },
  { id: "golden", name: "Golden Hour", icon: "🌅", css: "sepia(0.35) saturate(1.35) contrast(1.05) brightness(1.08)" },
  { id: "vibrant", name: "Vibrant Pop", icon: "💥", css: "saturate(1.65) contrast(1.15)" },
  { id: "vintage", name: "Vintage Film", icon: "📼", css: "sepia(0.5) contrast(0.92) brightness(1.12) saturate(0.8)" },
  { id: "noir", name: "Noir B&W", icon: "🎞️", css: "grayscale(1) contrast(1.25)" },
];

interface PhotoModeProps {
  dogName: string;
  onExit: () => void;
  /** Command the 3D dog into a pose (pure animation, no stat cost). */
  onPose: (action: DogAction) => void;
  /** Render + capture the frame, bake filter & stamp, return a PNG data URL. */
  onCapture: (filterCss: string, withStamp: boolean) => Promise<string | null>;
  /** Called with the finished photo (opens the review modal). */
  onCaptured: (dataUrl: string) => void;
}

const POSES: { action: DogAction; label: string; icon: string }[] = [
  { action: "sit", label: "Sit", icon: "🐾" },
  { action: "jump", label: "Happy Jump", icon: "🤸" },
  { action: "handshake", label: "Paw Shake", icon: "✋" },
  { action: "spin", label: "Spin", icon: "💫" },
  { action: "dance", label: "Dance", icon: "🕺" },
  { action: "backflip", label: "Backflip", icon: "🪃" },
  { action: "rest", label: "Rest", icon: "💤" },
];

/**
 * Dedicated Photo Mode: hides the HUD for an unobstructed viewfinder with
 * pose controls, rule-of-thirds grid, aesthetic filters, and a big shutter
 * button with flash. Mouse-drag camera orbiting stays live in the 3D scene.
 */
export const PhotoMode: React.FC<PhotoModeProps> = ({ dogName, onExit, onPose, onCapture, onCaptured }) => {
  const [filter, setFilter] = useState(PHOTO_FILTERS[0]);
  const [grid, setGrid] = useState(true);
  const [stamp, setStamp] = useState(true);
  const [flash, setFlash] = useState(false);
  const [snapping, setSnapping] = useState(false);

  const handleShutter = async () => {
    if (snapping) return;
    setSnapping(true);
    setFlash(true);
    // Synthesized two-stage mechanical camera shutter
    sound.playCameraShutter();
    window.setTimeout(() => setFlash(false), 260);
    const photo = await onCapture(filter.css, stamp);
    setSnapping(false);
    if (photo) {
      onCaptured(photo);
    }
  };

  return (
    <div className="absolute inset-0 z-40 pointer-events-none select-none">
      {/* Rule-of-thirds framing grid */}
      {grid && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/40" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/40" />
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/40" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/40" />
        </div>
      )}

      {/* Screen flash on capture */}
      {flash && <div className="absolute inset-0 bg-white z-50 pointer-events-none animate-out fade-out duration-200" />}

      {/* Top bar: exit, grid toggle, stamp toggle, filter picker */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-1.5 bg-black/55 backdrop-blur-md rounded-2xl px-2 py-1.5 border border-white/15 shadow-xl max-w-[94vw]">
        <button
          onClick={onExit}
          title="Exit Photo Mode"
          className="p-2 rounded-xl hover:bg-white/15 text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setGrid((g) => !g); sound.playButtonTap(); }}
          title={grid ? "Hide Rule-of-Thirds grid" : "Show Rule-of-Thirds grid"}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${grid ? "bg-[#A7C957] text-[#386641]" : "hover:bg-white/15 text-white"}`}
        >
          <Grid3x3 className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setStamp((s) => !s); sound.playButtonTap(); }}
          title={stamp ? "Stamp on (name, level, breed, date)" : "Commemorative stamp off"}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${stamp ? "bg-[#A7C957] text-[#386641]" : "hover:bg-white/15 text-white"}`}
        >
          <Stamp className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-white/20 mx-0.5" />
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {PHOTO_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f); sound.playButtonTap(); }}
              title={`${f.name} filter`}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-colors cursor-pointer ${
                filter.id === f.id ? "bg-white text-[#386641]" : "text-white/85 hover:bg-white/15"
              }`}
            >
              {f.icon} {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Pose director (right edge) */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-auto flex flex-col gap-1.5 bg-black/55 backdrop-blur-md rounded-2xl p-2 border border-white/15 shadow-xl">
        <span className="text-[10px] font-black text-white/80 text-center mb-0.5 flex items-center gap-1 justify-center">
          <Sparkles className="w-3 h-3 text-[#A7C957]" /> Pose
        </span>
        {POSES.map((p) => (
          <button
            key={p.action}
            onClick={() => { onPose(p.action); sound.playButtonTap(); }}
            title={`Pose: ${p.label}`}
            className="w-11 h-11 rounded-xl bg-white/10 hover:bg-[#A7C957] hover:text-[#386641] text-white text-lg flex items-center justify-center transition-colors cursor-pointer active:scale-90"
          >
            {p.icon}
          </button>
        ))}
      </div>

      {/* Bottom: hint + big shutter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-2">
        <span className="text-[10px] font-bold text-white/80 bg-black/50 rounded-full px-3 py-1 border border-white/10">
          🖱️ Drag to orbit & frame {dogName} • 📸 Snap the moment
        </span>
        <button
          onClick={handleShutter}
          disabled={snapping}
          title="Snap the photo!"
          className="w-16 h-16 rounded-full bg-white border-4 border-[#386641] shadow-2xl flex items-center justify-center cursor-pointer active:scale-90 transition-transform disabled:opacity-60"
        >
          <Camera className="w-7 h-7 text-[#386641]" />
        </button>
      </div>

      {/* Viewfinder corners for that camera feel */}
      <div className="absolute top-16 left-4 w-8 h-8 border-t-2 border-l-2 border-white/50 pointer-events-none" />
      <div className="absolute top-16 right-4 w-8 h-8 border-t-2 border-r-2 border-white/50 pointer-events-none" />
      <div className="absolute bottom-24 left-4 w-8 h-8 border-b-2 border-l-2 border-white/50 pointer-events-none" />
      <div className="absolute bottom-24 right-4 w-8 h-8 border-b-2 border-r-2 border-white/50 pointer-events-none" />
    </div>
  );
};

/** Icon-only retry for "Snap another" — tiny helper re-exported for the review modal. */
export const SnapAnotherIcon = RefreshCcw;
