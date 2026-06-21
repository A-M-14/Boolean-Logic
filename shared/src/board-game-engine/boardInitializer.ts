import type { GateType } from '../logic-gate-handler';
import type { BoardState, Cell, GameMode } from './types';

export const BOARD_SIZE = 7;

/**
 * All binary gate types used in the board game.
 * NOT is excluded because it is unary and the board requires binary gates (2 adjacent inputs).
 */
export const BOARD_GATE_TYPES: GateType[] = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'];

/** Returns true if the cell at (row, col) is a gate cell (logic gate square). */
export function isGatePosition(row: number, col: number): boolean {
  return (row + col) % 2 === 1;
}

/** Returns true if the cell at (row, col) is a bit cell (player-placeable square). */
export function isBitPosition(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

/**
 * Initializes a new 7×7 board by randomly placing logic gates on all gate squares.
 * Bit squares start empty. The first player to move is always 'red'.
 */
export function initializeBoard(gameMode: GameMode): BoardState {
  const cells: Cell[][] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    cells[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (isGatePosition(r, c)) {
        const gate = BOARD_GATE_TYPES[
          Math.floor(Math.random() * BOARD_GATE_TYPES.length)
        ] as GateType;
        cells[r][c] = { type: 'gate', gate };
      } else {
        cells[r][c] = { type: 'bit', value: null, placedBy: null };
      }
    }
  }

  return {
    cells,
    scores: { red: 0, blue: 0 },
    currentPlayer: 'red',
    gameMode,
    isComplete: false,
  };
}
