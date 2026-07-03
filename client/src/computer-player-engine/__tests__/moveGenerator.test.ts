import { describe, it, expect } from 'vitest';
import { initializeBoard, applyMove, BOARD_SIZE } from '@boolean-logic/shared';
import { generateMoves } from '../moveGenerator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshBoard() {
  return initializeBoard('two-player');
}

/** Count the number of empty bit cells on the board. */
function countEmptyBitCells(state: ReturnType<typeof freshBoard>): number {
  let count = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = state.cells[r][c];
      if (cell.type === 'bit' && cell.value === null) count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateMoves – fresh board', () => {
  it('returns exactly 2 moves per empty bit cell', () => {
    const state = freshBoard();
    const moves = generateMoves(state);
    const emptyBitCells = countEmptyBitCells(state);
    // 25 empty bit cells × 2 values = 50 moves
    expect(moves.length).toBe(emptyBitCells * 2);
  });

  it('returns 50 moves on a completely empty board', () => {
    const moves = generateMoves(freshBoard());
    expect(moves.length).toBe(50);
  });

  it('each move has value 0 or 1', () => {
    const moves = generateMoves(freshBoard());
    for (const move of moves) {
      expect(move.value === 0 || move.value === 1).toBe(true);
    }
  });

  it('produces one move with value 0 and one with value 1 for each cell', () => {
    const moves = generateMoves(freshBoard());
    // Group by cell
    const byCell = new Map<string, number[]>();
    for (const m of moves) {
      const key = `${m.row},${m.col}`;
      const entry = byCell.get(key) ?? [];
      entry.push(m.value);
      byCell.set(key, entry);
    }
    for (const [, values] of byCell) {
      expect(values.sort()).toEqual([0, 1]);
    }
  });

  it('only targets bit cell positions (row+col even)', () => {
    const moves = generateMoves(freshBoard());
    for (const { row, col } of moves) {
      expect((row + col) % 2).toBe(0);
    }
  });
});

describe('generateMoves – after some moves', () => {
  it('reduces move count by 2 after each bit placed', () => {
    let state = freshBoard();
    const initial = generateMoves(state).length;
    // Place a bit on (0,0)
    state = applyMove(state, { row: 0, col: 0, value: 1 }).newState;
    expect(generateMoves(state).length).toBe(initial - 2);
  });

  it('returns 0 moves on a fully filled board', () => {
    // Fill every bit cell via solo mode (allows overwriting)
    let state = initializeBoard('two-player');
    // Simulate filling all 25 bit cells
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (state.cells[r][c].type === 'bit') {
          state = applyMove(state, { row: r, col: c, value: 0 }).newState;
        }
      }
    }
    expect(generateMoves(state).length).toBe(0);
  });

  it('never includes already-placed cells', () => {
    let state = freshBoard();
    state = applyMove(state, { row: 0, col: 0, value: 1 }).newState;
    const moves = generateMoves(state);
    for (const { row, col } of moves) {
      expect(row === 0 && col === 0).toBe(false);
    }
  });
});
