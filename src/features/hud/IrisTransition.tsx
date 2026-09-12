import React from "react";

export type IrisPhase = "closing" | "opening" | null;

interface IrisTransitionProps {
  phase: IrisPhase;
}

/**
 * Anime-style iris transition: the screen goes black through a shrinking
 * circle (closing) and comes back through a growing one (opening).
 */
export const IrisTransition: React.FC<IrisTransitionProps> = ({ phase }) => {
  if (!phase) return null;
  return (
    <>
      <style>{`
        @keyframes dog-iris-close {
          from { clip-path: circle(150% at 50% 50%); }
          to { clip-path: circle(0% at 50% 50%); }
        }
        @keyframes dog-iris-open {
          from { clip-path: circle(0% at 50% 50%); }
          to { clip-path: circle(150% at 50% 50%); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[70] bg-black pointer-events-auto"
        style={{
          animation:
            phase === "closing"
              ? "dog-iris-close 1s ease-in-out forwards"
              : "dog-iris-open 1s ease-in-out forwards",
        }}
      >
        {phase === "closing" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl animate-bounce">🐾</span>
          </div>
        )}
      </div>
    </>
  );
};
