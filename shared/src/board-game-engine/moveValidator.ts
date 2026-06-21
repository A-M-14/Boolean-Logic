import { BOARD_SIZE } from './boardInitializer';
import type { BoardState, PlayerMove } from './types';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Checks whether a move is legal for the given board state.
 *
 * Rules:
 * - The target cell must be within the 7×7 grid.
 * - The target cell must be a bit cell (not a gate cell).
 * - The bit value must be 0 or 1.
 * - In two-player mode the cell must be empty (already-placed bits are locked).
 * - In solo mode an already-placed bit may be overwritten (the puzzle allows changes).
 */
export function validateMove(state: BoardState, move: PlayerMove): ValidationResult {
  const { row, col, value } = move;

  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return { valid: false, reason: 'Move is out of bounds' };
  }

  const cell = state.cells[row][col];

  if (cell.type !== 'bit') {
    return { valid: false, reason: 'Cannot place a bit on a gate cell' };
  }

  if (value !== 0 && value !== 1) {
    return { valid: false, reason: 'Bit value must be 0 or 1' };
  }

  if (state.gameMode === 'two-player' && cell.value !== null) {
    return { valid: false, reason: 'Cell is already occupied' };
  }

  return { valid: true };
}
