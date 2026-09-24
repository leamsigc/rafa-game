export type CartoonPhase = null | "closing" | "opening";

interface CartoonTransitionProps {
  phase: CartoonPhase;
  /** Cute label like "Loading the bedroom...". */
  label?: string;
}

/**
 * Cartoon black-screen chunk loader: the screen goes black with a bouncing
 * cartoon pup + paw trail, the new chunk loads behind the darkness, then the
 * black screen disappears cartoon-style. Used for stairs, car rides, etc.
 */
export function CartoonTransition({ phase, label = "Loading... 🐾" }: CartoonTransitionProps) {
  if (!phase) return null;

  return (
    <div
      className="fixed inset-0 z-[65] bg-black flex flex-col items-center justify-center gap-5 overflow-hidden"
      style={{
        animation: phase === "closing" ? "cartoonFadeIn 0.65s ease-out forwards" : "cartoonFadeOut 0.85s ease-in forwards",
        pointerEvents: "auto",
      }}
    >
      {/* Cartoon paw trail walking across */}
      <div className="flex items-end gap-2 text-3xl sm:text-4xl select-none">
        <span className="animate-paw-step" style={{ animationDelay: "0s" }}>🐾</span>
        <span className="animate-paw-step" style={{ animationDelay: "0.15s" }}>🐾</span>
        <span className="animate-paw-step" style={{ animationDelay: "0.3s" }}>🐾</span>
        <span className="text-5xl sm:text-6xl animate-pup-bounce inline-block">🐕</span>
      </div>

      {/* Bouncy loading label */}
      <div className="text-[#F2E8CF] font-black text-sm sm:text-base tracking-wide px-6 text-center">
        <span className="inline-block animate-pup-bounce" style={{ animationDelay: "0.1s" }}>
          {label}
        </span>
      </div>

      {/* Cartoon progress dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-[#A7C957] animate-bounce"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>

      <style>{`
        @keyframes cartoonFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cartoonFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes pawStep {
          0%, 100% { opacity: 0.25; transform: translateY(0) scale(0.9); }
          50% { opacity: 1; transform: translateY(-8px) scale(1.1); }
        }
        @keyframes pupBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        .animate-paw-step { display: inline-block; animation: pawStep 0.9s ease-in-out infinite; }
        .animate-pup-bounce { display: inline-block; animation: pupBounce 1s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
