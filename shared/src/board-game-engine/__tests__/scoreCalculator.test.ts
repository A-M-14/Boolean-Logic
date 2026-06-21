import { describe, it, expect } from 'vitest';
import { computeFullScore } from '../scoreCalculator';
import { BOARD_SIZE } from '../boardInitializer';
import type { Cell } from '../types';

/**
 * Builds a minimal 7×7 cells grid with:
 * - All gate positions initialised to the given gateType (default AND)
 * - All bit positions set to the given bit value, owned by the given player
 */
function makeUniformBoard(
  bitValue: 0 | 1,
  player: 'red' | 'blue' | null = 'red',
  gateType: 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR' = 'AND',
): Cell[][] {
  const cells: Cell[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    cells[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        cells[r][c] = { type: 'gate', gate: gateType };
      } else {
        cells[r][c] = { type: 'bit', value: bitValue, placedBy: player };
      }
    }
  }
  return cells;
}

/** Returns a board where every bit cell is empty (no score). */
function makeEmptyBoard(): Cell[][] {
  const cells: Cell[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    cells[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        cells[r][c] = { type: 'gate', gate: 'AND' };
      } else {
        cells[r][c] = { type: 'bit', value: null, placedBy: null };
      }
    }
  }
  return cells;
}

describe('computeFullScore – empty board', () => {
  it('returns 0-0 when no bits are placed', () => {
    expect(computeFullScore(makeEmptyBoard())).toEqual({ red: 0, blue: 0 });
  });
});

describe('computeFullScore – all-AND board, all bits = 0, owner red', () => {
  // AND(0,0) = 0. Both bits equal the gate output → +1 each.
  // There are 18 horizontal + 18 vertical = 36 gate directions.
  // Total score for red = 36 × 2 = 72.
  it('scores red = 72 (all bits match AND output)', () => {
    const cells = makeUniformBoard(0, 'red', 'AND');
    const scores = computeFullScore(cells);
    expect(scores.red).toBe(72);
    expect(scores.blue).toBe(0);
  });
});

describe('computeFullScore – all-AND board, all bits = 1, owner red', () => {
  // AND(1,1) = 1. Both bits equal gate output → +1 each. Still 36×2 = 72.
  it('scores red = 72', () => {
    const cells = makeUniformBoard(1, 'red', 'AND');
    expect(computeFullScore(cells).red).toBe(72);
  });
});

describe('computeFullScore – all-OR board, all bits = 0, owner red', () => {
  // OR(0,0) = 0. Both bits match → +2 per direction → 72 total.
  it('scores red = 72', () => {
    const cells = makeUniformBoard(0, 'red', 'OR');
    expect(computeFullScore(cells).red).toBe(72);
  });
});

describe('computeFullScore – all-XOR board, all bits = 0, owner red', () => {
  // XOR(0,0) = 0. Both bits match → +2 per direction → 72 total.
  it('scores red = 72', () => {
    const cells = makeUniformBoard(0, 'red', 'XOR');
    expect(computeFullScore(cells).red).toBe(72);
  });
});

describe('computeFullScore – all-NAND board, all bits = 1, owner red', () => {
  // NAND(1,1) = 0. Both bits are 1, gate output 0. Bits differ from output → −1 each.
  // 36 directions × −2 = −72 for red.
  it('scores red = -72', () => {
    const cells = makeUniformBoard(1, 'red', 'NAND');
    expect(computeFullScore(cells).red).toBe(-72);
  });
});

describe('computeFullScore – mixed players, single gate direction', () => {
  // Set up a small scenario: only the gate at (0,1) scores horizontally.
  // Bit (0,0) = 1 placed by red; Bit (0,2) = 0 placed by blue.
  // AND(1,0) = 0.
  //   red bit (0,0)  value=1 ≠ 0 → red: -1
  //   blue bit (0,2) value=0 == 0 → blue: +1
  // All other cells are empty so no other scoring occurs.
  it('attributes score to the correct player', () => {
    const cells = makeEmptyBoard();

    // Place the two bits
    const r0c0 = cells[0][0];
    const r0c2 = cells[0][2];
    if (r0c0.type === 'bit') { r0c0.value = 1; r0c0.placedBy = 'red'; }
    if (r0c2.type === 'bit') { r0c2.value = 0; r0c2.placedBy = 'blue'; }

    const scores = computeFullScore(cells);
    expect(scores.red).toBe(-1);
    expect(scores.blue).toBe(1);
  });
});

describe('computeFullScore – single gate direction partially filled', () => {
  // Only one of the two bits in a direction is placed → gate is not scored.
  it('does not score an incomplete gate direction', () => {
    const cells = makeEmptyBoard();
    const r0c0 = cells[0][0];
    if (r0c0.type === 'bit') { r0c0.value = 1; r0c0.placedBy = 'red'; }
    // (0,2) stays null → gate (0,1) horizontal direction is incomplete
    expect(computeFullScore(cells)).toEqual({ red: 0, blue: 0 });
  });
});

describe('computeFullScore – vertical gate direction', () => {
  // Gate at (1,0). Bits above: (0,0) and below: (2,0).
  // Set (0,0)=1 by red, (2,0)=1 by red. AND(1,1)=1. Both bits match → red: +2.
  it('scores vertical gate correctly', () => {
    const cells = makeEmptyBoard();
    const top = cells[0][0];
    const bot = cells[2][0];
    if (top.type === 'bit') { top.value = 1; top.placedBy = 'red'; }
    if (bot.type === 'bit') { bot.value = 1; bot.placedBy = 'red'; }
    // (0,0) participates in h-direction for gate (0,1) too, but (0,2) is still null → not scored.
    // (2,0) participates in h-direction for gate (2,1) too, but (2,2) is null → not scored.
    const scores = computeFullScore(cells);
    expect(scores.red).toBe(2);
    expect(scores.blue).toBe(0);
  });
});
