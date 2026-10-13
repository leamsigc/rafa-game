/** Pure chess logic (the 3D board + pieces render inside the game scene). */

export type Color = 0 | 1; // 0 = you (white, near side), 1 = Happy (black, across)
export type PieceType = "k" | "q" | "r" | "b" | "n" | "p";
export interface Piece { t: PieceType; c: Color }
export type Board = (Piece | null)[];
export interface Mv { r: number; c: number; cap: boolean }

export const N = 8;
export const chessAt = (r: number, c: number) => r * N + c;
export const inB = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;

export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 1000 };

export function initialBoard(): Board {
  const b: Board = Array(N * N).fill(null);
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let c = 0; c < N; c++) {
    b[chessAt(0, c)] = { t: back[c], c: 1 };
    b[chessAt(1, c)] = { t: "p", c: 1 };
    b[chessAt(6, c)] = { t: "p", c: 0 };
    b[chessAt(7, c)] = { t: back[c], c: 0 };
  }
  return b;
}

const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

export function genMoves(board: Board, r: number, c: number): Mv[] {
  const p = board[chessAt(r, c)];
  if (!p) return [];
  const moves: Mv[] = [];
  const push = (rr: number, cc: number): boolean => {
    if (!inB(rr, cc)) return false;
    const q = board[chessAt(rr, cc)];
    if (q && q.c === p.c) return false;
    moves.push({ r: rr, c: cc, cap: !!q });
    return !q;
  };
  const slide = (dirs: number[][]) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (push(rr, cc)) { rr += dr; cc += dc; }
    }
  };
  switch (p.t) {
    case "p": {
      const dir = p.c === 0 ? -1 : 1;
      const start = p.c === 0 ? 6 : 1;
      const one = r + dir;
      if (inB(one, c) && !board[chessAt(one, c)]) {
        moves.push({ r: one, c, cap: false });
        const two = r + dir * 2;
        if (r === start && !board[chessAt(two, c)]) moves.push({ r: two, c, cap: false });
      }
      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (inB(one, cc)) {
          const q = board[chessAt(one, cc)];
          if (q && q.c !== p.c) moves.push({ r: one, c: cc, cap: true });
        }
      }
      break;
    }
    case "n": KNIGHT.forEach(([dr, dc]) => push(r + dr, c + dc)); break;
    case "b": slide(DIAG); break;
    case "r": slide(ORTH); break;
    case "q": slide(DIAG.concat(ORTH)); break;
    case "k": DIAG.concat(ORTH).forEach(([dr, dc]) => push(r + dr, c + dc)); break;
  }
  return moves;
}

export function allMovesFor(board: Board, color: Color): { from: { r: number; c: number }; to: Mv }[] {
  const out: { from: { r: number; c: number }; to: Mv }[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const p = board[chessAt(r, c)];
      if (p && p.c === color) for (const to of genMoves(board, r, c)) out.push({ from: { r, c }, to });
    }
  return out;
}

export function applyOn(board: Board, fr: { r: number; c: number }, to: Mv): Board {
  const nb = [...board];
  const p = nb[chessAt(fr.r, fr.c)]!;
  nb[chessAt(fr.r, fr.c)] = null;
  let moved = p;
  if (p.t === "p" && (to.r === 0 || to.r === N - 1)) moved = { t: "q", c: p.c };
  nb[chessAt(to.r, to.c)] = moved;
  return nb;
}

export function aiPick(board: Board): { from: { r: number; c: number }; to: Mv } | null {
  const moves = allMovesFor(board, 1);
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    let score = Math.random() * 0.4;
    if (m.to.cap) {
      const cap = board[chessAt(m.to.r, m.to.c)];
      if (cap?.t === "k") return m;
      score += (cap ? PIECE_VALUE[cap.t] : 0) * 10;
    }
    score += m.to.r * 0.1;
    if (m.to.c >= 2 && m.to.c <= 5) score += 0.2;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}
