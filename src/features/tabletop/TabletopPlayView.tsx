import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, DoorOpen, Trophy } from "lucide-react";
import { ParkScene } from "../dog3d/ParkScene";
import { GameResult, gameMeta, TabletopGameId } from "./tabletopData";
import {
  Cell, tttWinner, tttBest, tttIndex, tttRowCol,
} from "./games/TicTacToe";
import {
  Board as ChessBoard, Color, Mv, initialBoard, genMoves, applyOn, allMovesFor, aiPick, chessAt,
  Elo, ELO_LEVELS,
} from "./games/Chess";
import {
  CF_Tok, cfIndex, cfWinner, cfDropRow, cfSmartColumn,
} from "./games/ConnectFour";
import { sound } from "../../utils/audio";

interface Props {
  scene: ParkScene | null;
  gameId: TabletopGameId;
  dogName: string;
  onBack: () => void; // back to the game-package menu
}

/**
 * Drives an in-world tabletop game. The 3D board lives in the park scene
 * (real fog / wind / weather); this only runs the rules, the opponent AI, and
 * a small status + result overlay.
 */
export const TabletopPlayView: React.FC<Props> = ({ scene, gameId, dogName, onBack }) => {
  const meta = gameMeta(gameId);
  const [phase, setPhase] = useState<"build" | "play" | "over">("build");
  const [turn, setTurn] = useState<0 | 1>(0);
  const [result, setResult] = useState<GameResult | null>(null);
  // Chess difficulty: how strong Happy plays (and thus how high his Elo is).
  const [elo, setElo] = useState<Elo>(() => {
    try {
      const saved = Number(localStorage.getItem("pet_chess_elo"));
      if (saved === 500 || saved === 1000 || saved === 3000) return saved;
    } catch {
      /* ignore */
    }
    return 1000;
  });
  const eloRef = useRef(elo);
  eloRef.current = elo;

  // per-game state
  const [ttt, setTtt] = useState<Cell[]>(Array(9).fill(null));
  const [chess, setChess] = useState<ChessBoard>(initialBoard);
  const [chessSel, setChessSel] = useState<{ r: number; c: number } | null>(null);
  const [cf, setCf] = useState<CF_Tok[]>(Array(42).fill(null));

  // mirrors for timeout-safe reads
  const tttRef = useRef(ttt); tttRef.current = ttt;
  const chessRef = useRef(chess); chessRef.current = chess;
  const cfRef = useRef(cf); cfRef.current = cf;
  // The scene's cell handler is installed once, so it must never read state
  // directly (it would be frozen at the first render — every tap ignored).
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const turnRef = useRef<0 | 1>(turn); turnRef.current = turn;
  const chessSelRef = useRef(chessSel); chessSelRef.current = chessSel;

  const endGame = (kind: GameResult["kind"], highlight: { r: number; c: number }[] = []) => {
    setPhase("over");
    setResult({ kind });
    if (highlight.length) scene?.tabletopHighlight(highlight);
  };

  // ----- Enter / leave the world board -----
  useEffect(() => {
    if (!scene) return;
    scene.enterTabletopGame(gameId, () => setPhase("play"));
    scene.onTabletopCell = handleCell;
    return () => {
      scene.onTabletopCell = undefined;
      scene.exitTabletopGame();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, gameId]);

  const restart = () => {
    if (!scene) return;
    setPhase("build");
    setResult(null);
    setTurn(0);
    setTtt(Array(9).fill(null));
    setChess(initialBoard());
    setChessSel(null);
    setCf(Array(42).fill(null));
    scene.enterTabletopGame(gameId, () => setPhase("play"));
  };

  // ----- TIC-TAC-TOE -----
  const tttPlay = (i: number, who: 0 | 1) => {
    const next = [...tttRef.current];
    next[i] = who;
    setTtt(next); tttRef.current = next;
    scene?.tttPlace(tttRowCol(i).r, tttRowCol(i).c, who, meta.youPiece, meta.happyPiece);
    const w = tttWinner(next);
    if (w) return endGame(who === 0 ? "you" : "happy", w.line.map((n) => tttRowCol(n)));
    if (next.every((c) => c != null)) return endGame("draw");
    setTurn(who === 0 ? 1 : 0);
  };

  useEffect(() => {
    if (gameId !== "tictactoe" || turn !== 1 || phase !== "play") return;
    const t = setTimeout(() => {
      const i = tttBest(tttRef.current);
      if (i >= 0) tttPlay(i, 1);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase]);

  // ----- CHESS -----
  const chessMove = (fr: { r: number; c: number }, to: Mv, who: Color) => {
    const cur = chessRef.current;
    const captured = cur[chessAt(to.r, to.c)]?.t === "k";
    const nb = applyOn(cur, fr, to);
    setChess(nb); chessRef.current = nb;
    setChessSel(null);
    scene?.chessMove(fr.r, fr.c, to.r, to.c, to.cap);
    // King captured = checkmate. Wait for the queen-kick animation to finish
    // before the result banner slides in.
    if (captured) return setTimeout(() => endGame(who === 0 ? "you" : "happy"), 2100);
    if (allMovesFor(nb, who === 0 ? 1 : 0).length === 0) return endGame("draw");
    setTurn(who === 0 ? 1 : 0);
  };

  useEffect(() => {
    if (gameId !== "chess" || turn !== 1 || phase !== "play") return;
    const t = setTimeout(() => {
      const mv = aiPick(chessRef.current, eloRef.current);
      if (mv) chessMove(mv.from, mv.to, 1);
    }, 1050);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, elo]);

  // ----- CONNECT FOUR -----
  const cfPlay = (col: number, who: 0 | 1) => {
    const cur = cfRef.current;
    const row = cfDropRow(cur, col);
    if (row < 0) return;
    const next = [...cur];
    next[cfIndex(row, col)] = who;
    setCf(next); cfRef.current = next;
    scene?.c4Drop(col, row, who);
    const w = cfWinner(next, row, col);
    if (w) return endGame(who === 0 ? "you" : "happy", w.map(([r, c]) => ({ r, c })));
    if (next.every((v) => v != null)) return endGame("draw");
    setTurn(who === 0 ? 1 : 0);
  };

  useEffect(() => {
    if (gameId !== "fourinarow" || turn !== 1 || phase !== "play") return;
    const t = setTimeout(() => {
      cfPlay(cfSmartColumn(cfRef.current), 1);
    }, 560);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase]);

  // ----- Cell dispatch -----
  function handleCell(p: { r: number; c: number; col: number }) {
    if (phaseRef.current !== "play" || turnRef.current !== 0) return;
    const sel = chessSelRef.current;
    if (gameId === "tictactoe") {
      if (tttRef.current[tttIndex(p.r, p.c)] == null) tttPlay(tttIndex(p.r, p.c), 0);
    } else if (gameId === "chess") {
      if (sel && genMoves(chessRef.current, sel.r, sel.c).some((m) => m.r === p.r && m.c === p.c)) {
        chessMove(sel, { r: p.r, c: p.c, cap: !!chessRef.current[chessAt(p.r, p.c)] }, 0);
      } else {
        const piece = chessRef.current[chessAt(p.r, p.c)];
        if (piece && piece.c === 0) setChessSel({ r: p.r, c: p.c });
        else setChessSel(null);
      }
    } else {
      cfPlay(p.col, 0);
    }
  }

  const statusText =
    phase === "build"
      ? `🔨 ${dogName} is building up the ${meta.name} board…`
      : phase === "over"
        ? ""
        : turn === 0
          ? "Your move — tap the board"
          : `${dogName} is thinking… 🐾`;

  const banner =
    result?.kind === "you"
      ? { title: "🎉 You win!", sub: `${dogName} wags and concedes. Champion!` }
      : result?.kind === "happy"
        ? { title: `🦴 ${dogName} wins!`, sub: "Victory zoomies incoming. Rematch?" }
        : { title: "🤝 It's a draw!", sub: "A perfectly matched pair." };

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex flex-col">
      {/* Top bar */}
      <div className="flex items-start justify-between p-3 sm:p-4">
        <button
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/45 hover:bg-black/65 text-[#ffedd5] font-bold text-sm border border-white/10 transition-colors cursor-pointer backdrop-blur"
        >
          <ArrowLeft className="w-4 h-4" /> Games
        </button>
        <div className="px-3 py-1.5 rounded-xl bg-black/45 border border-white/10 text-center">
          <h3 className="text-sm font-black text-[#ffedd5] leading-none">
            {meta.emoji} {meta.name}
          </h3>
          <p className="text-[10px] text-[#fed7aa] font-bold mt-0.5">
            You {meta.youPiece} · {dogName} {meta.happyPiece}
          </p>
        </div>
        <div className="w-20" />
      </div>

      {/* Status pill */}
      {statusText && (
        <div className="flex justify-center px-4 -mt-1">
          <div className="pointer-events-auto px-4 py-2 rounded-full bg-[#7c2d12]/85 border border-[#fbbf24]/30 text-[#ffedd5] text-xs font-black backdrop-blur shadow-lg">
            {statusText}
          </div>
        </div>
      )}

      {/* Chess: pick Happy's Elo + a hint that the board can be orbited */}
      {gameId === "chess" && phase !== "over" && (
        <div className="flex flex-col items-center gap-1.5 px-4 mt-2">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 p-1 rounded-full bg-black/50 border border-white/15 backdrop-blur">
            <span className="px-2 text-[10px] font-black uppercase tracking-wider text-[#fed7aa]">
              Happy's Elo
            </span>
            {ELO_LEVELS.map((lvl) => (
              <button
                key={lvl.elo}
                onClick={() => {
                  sound.playButtonTap();
                  setElo(lvl.elo);
                  try {
                    localStorage.setItem("pet_chess_elo", String(lvl.elo));
                  } catch {
                    /* ignore */
                  }
                }}
                title={lvl.blurb}
                className={`px-3 py-1.5 rounded-full text-[11px] font-black transition-colors cursor-pointer ${
                  elo === lvl.elo
                    ? "bg-[#fbbf24] text-[#7c2d12] shadow"
                    : "text-white/75 hover:text-white hover:bg-white/10"
                }`}
              >
                {lvl.emoji} {lvl.label} · {lvl.elo}
              </button>
            ))}
          </div>
          <p className="text-[10px] font-bold text-white/70 drop-shadow">
            Drag to orbit the board · scroll to zoom in and scan the position
          </p>
        </div>
      )}

      <div className="flex-1" />

      {/* Result */}
      {result && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 backdrop-blur-sm pointer-events-auto">
          <div className="bg-[#F2E8CF] rounded-3xl border-2 border-[#a16207]/40 shadow-2xl p-6 w-[min(92vw,340px)] text-center text-[#386641]">
            <Trophy className="w-9 h-9 mx-auto text-[#f59e0b] mb-2" />
            <h3 className="text-xl font-black mb-1">{banner?.title}</h3>
            <p className="text-sm text-[#386641]/75 mb-5">{banner?.sub}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={restart}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#7c2d12] hover:bg-[#9a3412] text-[#F2E8CF] font-black text-sm transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Play again
              </button>
              <button
                onClick={onBack}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-white border border-[#7c2d12]/20 text-[#386641] font-bold text-sm hover:bg-[#fffbeb] transition-colors cursor-pointer"
              >
                <DoorOpen className="w-4 h-4" /> Back to games
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
