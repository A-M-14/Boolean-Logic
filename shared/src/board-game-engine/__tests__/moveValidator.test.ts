import { describe, it, expect } from 'vitest';
import { validateMove } from '../moveValidator';
import { initializeBoard } from '../boardInitializer';
import type { BoardState } from '../types';

function twoPlayerState(): BoardState {
  return initializeBoard('two-player');
}

function soloState(): BoardState {
  return initializeBoard('solo');
}

/** Places a bit on a known bit cell (0,0) and returns the resulting state copy. */
function stateWithBitAt(base: BoardState, r: number, c: number, v: 0 | 1): BoardState {
  const cells = base.cells.map(row => row.map(cell => ({ ...cell })));
  const cell = cells[r][c];
  if (cell.type === 'bit') {
    cell.value = v;
    cell.placedBy = 'red';
  }
  return { ...base, cells };
}

describe('validateMove – bounds', () => {
  it('rejects negative row', () => {
    const r = validateMove(twoPlayerState(), { row: -1, col: 0, value: 0 });
    expect(r.valid).toBe(false);
  });

  it('rejects row >= 7', () => {
    const r = validateMove(twoPlayerState(), { row: 7, col: 0, value: 0 });
    expect(r.valid).toBe(false);
  });

  it('rejects negative col', () => {
    const r = validateMove(twoPlayerState(), { row: 0, col: -1, value: 0 });
    expect(r.valid).toBe(false);
  });

  it('rejects col >= 7', () => {
    const r = validateMove(twoPlayerState(), { row: 0, col: 7, value: 0 });
    expect(r.valid).toBe(false);
  });
});

describe('validateMove – cell type', () => {
  it('rejects placement on a gate cell (0,1)', () => {
    const r = validateMove(twoPlayerState(), { row: 0, col: 1, value: 0 });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/gate/i);
  });

  it('accepts placement on an empty bit cell (0,0)', () => {
    const r = validateMove(twoPlayerState(), { row: 0, col: 0, value: 0 });
    expect(r.valid).toBe(true);
  });
});

describe('validateMove – two-player occupancy', () => {
  it('rejects placing on an occupied cell', () => {
    const state = stateWithBitAt(twoPlayerState(), 0, 0, 1);
    const r = validateMove(state, { row: 0, col: 0, value: 0 });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/occupied/i);
  });

  it('accepts placing on an empty cell', () => {
    const state = stateWithBitAt(twoPlayerState(), 0, 0, 1);
    // (0,2) is still empty
    const r = validateMove(state, { row: 0, col: 2, value: 1 });
    expect(r.valid).toBe(true);
  });
});

describe('validateMove – solo mode re-placement', () => {
  it('allows overwriting an already-placed bit in solo mode', () => {
    const state = stateWithBitAt(soloState(), 0, 0, 1);
    const r = validateMove(state, { row: 0, col: 0, value: 0 });
    expect(r.valid).toBe(true);
  });
});

describe('validateMove – bit value', () => {
  it('accepts 0', () => {
    expect(validateMove(twoPlayerState(), { row: 0, col: 0, value: 0 }).valid).toBe(true);
  });

  it('accepts 1', () => {
    expect(validateMove(twoPlayerState(), { row: 0, col: 0, value: 1 }).valid).toBe(true);
  });

  it('rejects 2 (cast to the parameter type for the test)', () => {
    // TypeScript normally prevents this, but we test the runtime guard.
    const r = validateMove(twoPlayerState(), { row: 0, col: 0, value: 2 as 0 | 1 });
    expect(r.valid).toBe(false);
  });
});
