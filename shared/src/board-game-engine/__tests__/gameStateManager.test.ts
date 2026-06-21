import { describe, it, expect } from 'vitest';
import { applyMove } from '../gameStateManager';
import { initializeBoard, BOARD_SIZE } from '../boardInitializer';
import type { BoardState, Cell } from '../types';

/** Builds a state with a specific cells grid (all bit cells filled to a given value by red). */
function makeFilledState(except?: { row: number; col: number }): BoardState {
  const base = initializeBoard('two-player');
  const cells = base.cells.map((row, r) =>
    row.map((cell, c) => {
      if (cell.type !== 'bit') return cell;
      if (except && except.row === r && except.col === c) return cell;
      return { ...cell, value: 0 as 0 | 1, placedBy: 'red' as const };
    }),
  );
  return { ...base, cells };
}

describe('applyMove – basic placement', () => {
  it('places a bit on the target cell', () => {
    const state = initializeBoard('two-player');
    const { newState } = applyMove(state, { row: 0, col: 0, value: 1 });
    const cell = newState.cells[0][0];
    expect(cell.type).toBe('bit');
    if (cell.type === 'bit') {
      expect(cell.value).toBe(1);
      expect(cell.placedBy).toBe('red');
    }
  });

  it('does not mutate the original state', () => {
    const state = initializeBoard('two-player');
    applyMove(state, { row: 0, col: 0, value: 1 });
    const cell = state.cells[0][0];
    if (cell.type === 'bit') expect(cell.value).toBeNull();
  });
});

describe('applyMove – turn alternation (two-player)', () => {
  it('switches from red to blue after the first move', () => {
    const state = initializeBoard('two-player');
    const { newState } = applyMove(state, { row: 0, col: 0, value: 0 });
    expect(newState.currentPlayer).toBe('blue');
  });

  it('switches from blue back to red on the second move', () => {
    const state = initializeBoard('two-player');
    const s1 = applyMove(state, { row: 0, col: 0, value: 0 }).newState;
    const s2 = applyMove(s1, { row: 0, col: 2, value: 1 }).newState;
    expect(s2.currentPlayer).toBe('red');
  });
});

describe('applyMove – solo mode', () => {
  it('keeps currentPlayer as red in solo mode', () => {
    const state = initializeBoard('solo');
    const { newState } = applyMove(state, { row: 0, col: 0, value: 0 });
    expect(newState.currentPlayer).toBe('red');
  });

  it('allows overwriting an existing bit', () => {
    const state = initializeBoard('solo');
    const s1 = applyMove(state, { row: 0, col: 0, value: 0 }).newState;
    const s2 = applyMove(s1, { row: 0, col: 0, value: 1 }).newState;
    const cell = s2.cells[0][0];
    if (cell.type === 'bit') expect(cell.value).toBe(1);
  });

  it('recomputes score correctly after a bit change', () => {
    // Use a controlled solo state where (0,0)=0 → AND(0, ?) not scored yet,
    // then fill (0,2)=0. AND(0,0)=0 → both bits match → red: +2.
    // Then change (0,0) to 1. AND(1,0)=0. bit(0)=1≠0 → -1; bit(2)=0=0 → +1. Net: 0.
    const state = initializeBoard('solo');

    // Freeze the gate at (0,1) to AND by finding and overriding it
    const frozenCells: Cell[][] = state.cells.map((row, r) =>
      row.map((cell, c) => {
        if (r === 0 && c === 1) return { type: 'gate' as const, gate: 'AND' as const };
        return { ...cell };
      }),
    );
    const frozenState: BoardState = { ...state, cells: frozenCells };

    const s1 = applyMove(frozenState, { row: 0, col: 0, value: 0 }).newState;
    const s2 = applyMove(s1, { row: 0, col: 2, value: 0 }).newState;
    // Gate (0,1) = AND(0,0) = 0. Both bits 0 match → score red = +2 (and maybe others if complete)
    // Only (0,1) horizontal is scored here (others involve empty cells).
    expect(s2.scores.red).toBe(2);

    // Change (0,0) to 1
    const s3 = applyMove(s2, { row: 0, col: 0, value: 1 }).newState;
    // AND(1,0)=0. bit(0,0)=1 ≠ 0 → -1; bit(0,2)=0 = 0 → +1. Net: 0.
    expect(s3.scores.red).toBe(0);
  });
});

describe('applyMove – completion detection', () => {
  it('isComplete is false while bits remain', () => {
    const state = initializeBoard('two-player');
    const { newState } = applyMove(state, { row: 0, col: 0, value: 0 });
    expect(newState.isComplete).toBe(false);
  });

  it('isComplete becomes true once all bit cells are filled', () => {
    // Fill all but the last bit cell (0,0), then fill it.
    const almostDone = makeFilledState({ row: 0, col: 0 });
    const { newState } = applyMove(almostDone, { row: 0, col: 0, value: 1 });
    expect(newState.isComplete).toBe(true);
  });
});

describe('applyMove – invalid move throws', () => {
  it('throws when placing on a gate cell', () => {
    const state = initializeBoard('two-player');
    expect(() => applyMove(state, { row: 0, col: 1, value: 0 })).toThrow();
  });

  it('throws when placing on an occupied cell in two-player mode', () => {
    const state = initializeBoard('two-player');
    const s1 = applyMove(state, { row: 0, col: 0, value: 0 }).newState;
    expect(() => applyMove(s1, { row: 0, col: 0, value: 1 })).toThrow();
  });

  it('throws for out-of-bounds coordinates', () => {
    const state = initializeBoard('two-player');
    expect(() => applyMove(state, { row: 7, col: 0, value: 0 })).toThrow();
  });
});

describe('applyMove – scoreDelta', () => {
  it('scoreDelta is 0 when no gate direction completes', () => {
    const state = initializeBoard('two-player');
    const { scoreDelta } = applyMove(state, { row: 0, col: 0, value: 1 });
    expect(scoreDelta).toEqual({ red: 0, blue: 0 });
  });

  it('scoreDelta reflects score change when a gate direction completes', () => {
    // Gate (0,1) fixed to AND. Place (0,0)=1 by red, then (0,2)=1 by blue.
    // AND(1,1)=1. Both bits match → red: +1, blue: +1.
    const state = initializeBoard('two-player');
    const cells: Cell[][] = state.cells.map((row, r) =>
      row.map((cell, c) => {
        if (r === 0 && c === 1) return { type: 'gate' as const, gate: 'AND' as const };
        return { ...cell };
      }),
    );
    const fixedState: BoardState = { ...state, cells };

    const s1 = applyMove(fixedState, { row: 0, col: 0, value: 1 }).newState;  // red places 1
    const { newState: s2, scoreDelta } = applyMove(s1, { row: 0, col: 2, value: 1 });  // blue places 1

    expect(scoreDelta.red).toBe(1);
    expect(scoreDelta.blue).toBe(1);
    expect(s2.scores.red).toBe(1);
    expect(s2.scores.blue).toBe(1);
  });
});
