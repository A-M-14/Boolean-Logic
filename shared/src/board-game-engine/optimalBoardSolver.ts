import { evaluateGate } from '../logic-gate-handler';
import { BOARD_SIZE } from './boardInitializer';
import type { BitValue, Cell, OptimalSolveResult } from './types';

/**
 * Bit columns within each row.
 *
 * Bit cells are at positions where (row + col) % 2 === 0.
 * - Even rows (0, 2, 4, 6): bits at columns 0, 2, 4, 6  (4 bits → mask ∈ [0, 15])
 * - Odd  rows (1, 3, 5):    bits at columns 1, 3, 5     (3 bits → mask ∈ [0,  7])
 *
 * A mask bit at local index i corresponds to the column at BIT_COLS[row % 2][i].
 */
const BIT_COLS: readonly [readonly number[], readonly number[]] = [
  [0, 2, 4, 6], // even rows
  [1, 3, 5],    // odd rows
];

function getBitCols(row: number): readonly number[] {
  return BIT_COLS[row % 2];
}

function numBitsInRow(row: number): number {
  return row % 2 === 0 ? 4 : 3;
}

/**
 * Extracts the bit value (0 or 1) for column `col` from a row bitmask.
 * Returns -1 if `col` is not a bit column in the given bit-columns list.
 */
function getBitFromMask(mask: number, bitCols: readonly number[], col: number): number {
  const idx = bitCols.indexOf(col);
  return idx === -1 ? -1 : (mask >> idx) & 1;
}

/**
 * Score contribution from one gate direction in solo mode.
 *
 * Gate at (gr, gc) evaluates inputs [b1, b2].
 * Solo scoring: gateVal = gate(b1, b2). Each input bit earns +1 if it equals gateVal, else −1.
 */
function soloGateScore(
  cells: Cell[][],
  gr: number,
  gc: number,
  b1: number,
  b2: number,
): number {
  const cell = cells[gr][gc];
  if (cell.type !== 'gate') return 0;
  const gateOutput = evaluateGate(cell.gate, [b1 === 1, b2 === 1]);
  const gateVal = gateOutput ? 1 : 0;
  return (b1 === gateVal ? 1 : -1) + (b2 === gateVal ? 1 : -1);
}

/**
 * Horizontal score for all gates in `row` given the row's bitmask.
 *
 * A gate at (row, gc) scores horizontally only if both (row, gc−1) and (row, gc+1) exist.
 * Gate columns in even rows: {1, 3, 5} — all have both neighbours (c∈[1,5]).
 * Gate columns in odd  rows: {0, 2, 4, 6} — only 2 and 4 have both neighbours.
 */
function hScore(cells: Cell[][], row: number, mask: number): number {
  const bitCols = getBitCols(row);
  let score = 0;

  // Gate cells in this row: (row + c) % 2 === 1 → c ∈ {odd} if row even, {even} if row odd.
  const gateCols = row % 2 === 0 ? [1, 3, 5] : [0, 2, 4, 6];

  for (const gc of gateCols) {
    if (gc - 1 < 0 || gc + 1 >= BOARD_SIZE) continue; // no horizontal neighbours
    const b1 = getBitFromMask(mask, bitCols, gc - 1);
    const b2 = getBitFromMask(mask, bitCols, gc + 1);
    if (b1 === -1 || b2 === -1) continue;
    score += soloGateScore(cells, row, gc, b1, b2);
  }

  return score;
}

/**
 * Vertical score for all gates in `gateRow` given the bitmasks of the rows above and below.
 *
 * A gate at (gateRow, gc) evaluates bit (gateRow−1, gc) and bit (gateRow+1, gc).
 * Returns 0 if gateRow−1 < 0 or gateRow+1 ≥ BOARD_SIZE (edge rows with no vertical partner).
 */
function vScore(
  cells: Cell[][],
  gateRow: number,
  aboveMask: number,
  belowMask: number,
): number {
  const aboveRow = gateRow - 1;
  const belowRow = gateRow + 1;
  if (aboveRow < 0 || belowRow >= BOARD_SIZE) return 0;

  const aboveBitCols = getBitCols(aboveRow);
  const belowBitCols = getBitCols(belowRow);
  const gateCols = gateRow % 2 === 0 ? [1, 3, 5] : [0, 2, 4, 6];

  let score = 0;
  for (const gc of gateCols) {
    const bAbove = getBitFromMask(aboveMask, aboveBitCols, gc);
    const bBelow = getBitFromMask(belowMask, belowBitCols, gc);
    if (bAbove === -1 || bBelow === -1) continue;
    score += soloGateScore(cells, gateRow, gc, bAbove, bBelow);
  }
  return score;
}

/**
 * Encodes a (prevMask, currMask) DP state as a single integer.
 * prevMask may be −1 (sentinel for "no previous row").
 */
function encodeState(prevMask: number, currMask: number): number {
  return (prevMask + 1) * 17 + (currMask + 1);
}

interface TraceEntry {
  parentKey: number;
  nextMask: number;
}

/**
 * Row-by-row DP with traceback.
 *
 * Returns the maximum achievable score and the optimal bit placement grid.
 * Call once at game start and store the result for the lifetime of the game.
 */
export function computeOptimalSolution(cells: Cell[][]): OptimalSolveResult {
  const SENTINEL = -1;

  // dp: encoded (prevMask, currMask) → maximum score accumulated so far
  let dp = new Map<number, number>();

  // trace[r] for r >= 1: newKey → {parentKey, nextMask that was chosen for row r}
  // trace[0] is unused (a placeholder); row 0 masks can be decoded directly from their key.
  const trace: Array<Map<number, TraceEntry>> = [new Map()];

  // Base case: row 0 — each mask produces a unique key, so no collision possible.
  const numBits0 = numBitsInRow(0);
  for (let mask = 0; mask < (1 << numBits0); mask++) {
    const score = hScore(cells, 0, mask);
    dp.set(encodeState(SENTINEL, mask), score);
  }

  // Transitions: add row r (r = 1 .. BOARD_SIZE−1)
  for (let r = 1; r < BOARD_SIZE; r++) {
    const newDp = new Map<number, number>();
    const traceR = new Map<number, TraceEntry>();
    const numBitsR = numBitsInRow(r);

    for (const [key, accumulated] of dp) {
      const prevMask = Math.floor(key / 17) - 1; // row r−2 bits (or SENTINEL)
      const currMask = (key % 17) - 1;           // row r−1 bits

      for (let nextMask = 0; nextMask < (1 << numBitsR); nextMask++) {
        const scoreH = hScore(cells, r, nextMask);
        const scoreV = vScore(cells, r - 1, prevMask, nextMask);
        const total = accumulated + scoreH + scoreV;
        const newKey = encodeState(currMask, nextMask);
        const best = newDp.get(newKey) ?? -Infinity;
        if (total > best) {
          newDp.set(newKey, total);
          traceR.set(newKey, { parentKey: key, nextMask });
        }
      }
    }

    dp = newDp;
    trace.push(traceR);
  }

  // Find the best final state
  let maxScore = -Infinity;
  let bestFinalKey = -1;
  for (const [key, score] of dp) {
    if (score > maxScore) {
      maxScore = score;
      bestFinalKey = key;
    }
  }

  // Traceback: recover the row masks from BOARD_SIZE-1 down to 1, then 0.
  const rowMasks = new Array<number>(BOARD_SIZE);
  let currentKey = bestFinalKey;

  for (let r = BOARD_SIZE - 1; r >= 1; r--) {
    const entry = trace[r].get(currentKey)!;
    rowMasks[r] = entry.nextMask;
    currentKey = entry.parentKey;
  }
  // Row 0: currentKey encodes (SENTINEL, row0Mask) — decode directly.
  rowMasks[0] = (currentKey % 17) - 1;

  return { optimalScore: maxScore, solution: buildSolutionGrid(rowMasks) };
}

/**
 * Converts per-row bitmasks into a 7×7 solution grid.
 * Bit cell positions receive their optimal value; gate cell positions are null.
 */
function buildSolutionGrid(rowMasks: number[]): (BitValue | null)[][] {
  const grid: (BitValue | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
    new Array<BitValue | null>(BOARD_SIZE).fill(null),
  );
  for (let r = 0; r < BOARD_SIZE; r++) {
    const bitCols = getBitCols(r);
    bitCols.forEach((col, idx) => {
      grid[r][col] = ((rowMasks[r] >> idx) & 1) as BitValue;
    });
  }
  return grid;
}

