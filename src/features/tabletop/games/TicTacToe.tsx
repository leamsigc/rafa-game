/** Pure tic-tac-toe logic (the 3D board renders inside the game scene). */

export type Cell = 0 | 1 | null; // 0 = you, 1 = happy

export const TTT_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function tttWinner(cells: Cell[]): { who: Cell; line: number[] } | null {
  for (const line of TTT_LINES) {
    const [a, b, c] = line;
    if (cells[a] != null && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { who: cells[a], line };
    }
  }
  return null;
}

/** Happy's move: win, block, center, corner, else random. */
export function tttBest(cells: Cell[]): number {
  const empty = cells.map((c, i) => (c == null ? i : -1)).filter((i) => i >= 0);
  if (!empty.length) return -1;
  for (const i of empty) {
    const t = [...cells]; t[i] = 1;
    if (tttWinner(t)?.who === 1) return i;
  }
  for (const i of empty) {
    const t = [...cells]; t[i] = 0;
    if (tttWinner(t)?.who === 0) return i;
  }
  if (cells[4] == null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => cells[i] == null);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return empty[Math.floor(Math.random() * empty.length)];
}

/** Map (row, col) 0..2 to flat index 0..8. */
export const tttIndex = (r: number, c: number) => r * 3 + c;
export const tttRowCol = (i: number) => ({ r: Math.floor(i / 3), c: i % 3 });
