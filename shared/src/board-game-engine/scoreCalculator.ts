import { evaluateGate } from '../logic-gate-handler';
import { BOARD_SIZE } from './boardInitializer';
import type { BitCell, Cell, GateCell, PlayerScores } from './types';

function getBitCell(cells: Cell[][], row: number, col: number): BitCell | null {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  const cell = cells[row][col];
  return cell.type === 'bit' ? cell : null;
}

function getGateCell(cells: Cell[][], row: number, col: number): GateCell | null {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  const cell = cells[row][col];
  return cell.type === 'gate' ? cell : null;
}

/**
 * Scores a single gate direction (horizontal or vertical).
 *
 * A direction is only scored when BOTH adjacent bit cells in that direction have a placed value.
 * Returns null if the direction is incomplete (one or both bits are unplaced) or invalid (neighbor
 * cells are out of bounds or are not bit cells).
 *
 * Scoring rule:
 *   gateOutput = evaluate(gate, [bit1, bit2])
 *   For each bit: if bitValue === gateOutput → player earns +1, else → player loses −1.
 */
function scoreGateDirection(
  cells: Cell[][],
  gateRow: number,
  gateCol: number,
  direction: 'horizontal' | 'vertical',
): PlayerScores | null {
  const gateCell = getGateCell(cells, gateRow, gateCol);
  if (!gateCell) return null;

  const bit1 =
    direction === 'horizontal'
      ? getBitCell(cells, gateRow, gateCol - 1)
      : getBitCell(cells, gateRow - 1, gateCol);

  const bit2 =
    direction === 'horizontal'
      ? getBitCell(cells, gateRow, gateCol + 1)
      : getBitCell(cells, gateRow + 1, gateCol);

  if (!bit1 || !bit2 || bit1.value === null || bit2.value === null) return null;

  const gateOutput = evaluateGate(gateCell.gate, [bit1.value === 1, bit2.value === 1]);
  const gateValue = gateOutput ? 1 : 0;

  const delta: PlayerScores = { red: 0, blue: 0 };
  for (const bit of [bit1, bit2]) {
    if (bit.placedBy === null) continue;
    delta[bit.placedBy] += bit.value === gateValue ? 1 : -1;
  }
  return delta;
}

/**
 * Recomputes the complete score for the board from scratch.
 *
 * Iterates over every gate cell, evaluates its horizontal and vertical directions whenever both
 * adjacent bits are placed, and accumulates the score deltas.
 */
export function computeFullScore(cells: Cell[][]): PlayerScores {
  const scores: PlayerScores = { red: 0, blue: 0 };

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cells[r][c].type !== 'gate') continue;

      const h = scoreGateDirection(cells, r, c, 'horizontal');
      if (h) { scores.red += h.red; scores.blue += h.blue; }

      const v = scoreGateDirection(cells, r, c, 'vertical');
      if (v) { scores.red += v.red; scores.blue += v.blue; }
    }
  }

  return scores;
}
