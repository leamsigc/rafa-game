/** Pure connect-four logic (the 3D board + tokens render in the game scene). */

export const CF_COLS = 7;
export const CF_ROWS = 6;
export type CF_Tok = 0 | 1 | null; // 0 = you (red), 1 = happy (yellow)
export const cfIndex = (r: number, c: number) => r * CF_COLS + c;

const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function cfWinner(cells: CF_Tok[], r: number, c: number): number[][] | null {
  const who = cells[cfIndex(r, c)];
  if (who == null) return null;
  for (const [dr, dc] of DIRS) {
    const line: number[][] = [[r, c]];
    for (const s of [1, -1]) {
      let rr = r + dr * s;
      let cc = c + dc * s;
      while (
        rr >= 0 && rr < CF_ROWS && cc >= 0 && cc < CF_COLS &&
        cells[cfIndex(rr, cc)] === who
      ) {
        line.push([rr, cc]);
        rr += dr * s;
        cc += dc * s;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

/** Lowest empty row in a column (bottom-first physics). -1 if full. */
export function cfDropRow(cells: CF_Tok[], c: number): number {
  for (let r = CF_ROWS - 1; r >= 0; r--) if (cells[cfIndex(r, c)] == null) return r;
  return -1;
}

export function cfSmartColumn(cells: CF_Tok[]): number {
  const valid = Array.from({ length: CF_COLS }, (_, c) => c).filter((c) => cfDropRow(cells, c) >= 0);
  if (!valid.length) return 0;
  const tryWin = (who: 0 | 1): number => {
    for (const c of valid) {
      const r = cfDropRow(cells, c);
      const g = [...cells];
      g[cfIndex(r, c)] = who;
      if (cfWinner(g, r, c)) return c;
    }
    return -1;
  };
  return (
    tryWin(1) >= 0 ? tryWin(1) :
    tryWin(0) >= 0 ? tryWin(0) :
    valid.includes(3) ? 3 :
    valid[Math.floor(Math.random() * valid.length)]
  );
}
