import { BOARD_SIZE } from '@boolean-logic/shared';
import type { BitValue, BoardState, PlayerMove } from '@boolean-logic/shared';

/**
 * Move Generator component.
 *
 * Generates all legal moves available for the current player in the given board state.
 * In two-player mode a legal move is any (row, col, value) triple where:
 *   - (row, col) is an empty bit cell, and
 *   - value ∈ {0, 1}.
 *
 * Two candidate moves are produced for every empty bit cell — one with value 0 and one with
 * value 1 — because the player chooses both the cell and the bit value in a single turn.
 *
 * @param state - The current board state.
 * @returns An array of all legal PlayerMove objects for the current player.
 */
export function generateMoves(state: BoardState): PlayerMove[] {
  const moves: PlayerMove[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = state.cells[r][c];
      if (cell.type === 'bit' && cell.value === null) {
        moves.push({ row: r, col: c, value: 0 as BitValue });
        moves.push({ row: r, col: c, value: 1 as BitValue });
      }
    }
  }

  return moves;
}
