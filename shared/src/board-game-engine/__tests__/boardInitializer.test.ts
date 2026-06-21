import { describe, it, expect } from 'vitest';
import {
  initializeBoard,
  isGatePosition,
  isBitPosition,
  BOARD_SIZE,
  BOARD_GATE_TYPES,
} from '../boardInitializer';

describe('isGatePosition / isBitPosition', () => {
  it('classifies top-left corner (0,0) as bit', () => {
    expect(isBitPosition(0, 0)).toBe(true);
    expect(isGatePosition(0, 0)).toBe(false);
  });

  it('classifies (0,1) as gate', () => {
    expect(isGatePosition(0, 1)).toBe(true);
    expect(isBitPosition(0, 1)).toBe(false);
  });

  it('classifies (1,0) as gate', () => {
    expect(isGatePosition(1, 0)).toBe(true);
  });

  it('classifies (1,1) as bit', () => {
    expect(isBitPosition(1, 1)).toBe(true);
  });

  it('every cell is either a gate or a bit, never both', () => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const gate = isGatePosition(r, c);
        const bit = isBitPosition(r, c);
        expect(gate !== bit).toBe(true);
      }
    }
  });

  it('even rows have gates at odd columns', () => {
    for (let r = 0; r < BOARD_SIZE; r += 2) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        expect(isGatePosition(r, c)).toBe(c % 2 === 1);
      }
    }
  });

  it('odd rows have gates at even columns', () => {
    for (let r = 1; r < BOARD_SIZE; r += 2) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        expect(isGatePosition(r, c)).toBe(c % 2 === 0);
      }
    }
  });
});

describe('initializeBoard', () => {
  it('returns a 7×7 grid', () => {
    const state = initializeBoard('two-player');
    expect(state.cells.length).toBe(BOARD_SIZE);
    for (const row of state.cells) {
      expect(row.length).toBe(BOARD_SIZE);
    }
  });

  it('places a gate on every gate position', () => {
    const state = initializeBoard('two-player');
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (isGatePosition(r, c)) {
          expect(state.cells[r][c].type).toBe('gate');
        }
      }
    }
  });

  it('starts every bit cell empty (value null, placedBy null)', () => {
    const state = initializeBoard('two-player');
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (isBitPosition(r, c)) {
          const cell = state.cells[r][c];
          expect(cell.type).toBe('bit');
          if (cell.type === 'bit') {
            expect(cell.value).toBeNull();
            expect(cell.placedBy).toBeNull();
          }
        }
      }
    }
  });

  it('uses only valid board gate types', () => {
    const state = initializeBoard('two-player');
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = state.cells[r][c];
        if (cell.type === 'gate') {
          expect(BOARD_GATE_TYPES).toContain(cell.gate);
        }
      }
    }
  });

  it('starts with scores 0–0 and currentPlayer red', () => {
    const state = initializeBoard('two-player');
    expect(state.scores).toEqual({ red: 0, blue: 0 });
    expect(state.currentPlayer).toBe('red');
    expect(state.isComplete).toBe(false);
  });

  it('preserves the gameMode', () => {
    expect(initializeBoard('solo').gameMode).toBe('solo');
    expect(initializeBoard('two-player').gameMode).toBe('two-player');
  });

  it('counts exactly 25 bit cells and 24 gate cells', () => {
    const state = initializeBoard('solo');
    let bits = 0, gates = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (state.cells[r][c].type === 'bit') bits++;
        else gates++;
      }
    }
    expect(bits).toBe(25);
    expect(gates).toBe(24);
  });
});
