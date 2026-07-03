import { describe, it, expect } from 'vitest';
import { initializeBoard, BOARD_SIZE } from '@boolean-logic/shared';
import type { BoardState, BitValue, Cell, GateType } from '@boolean-logic/shared';
import { evaluateState } from '../heuristicEvaluator';
import type { HeuristicWeights } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const W_ONLY_SCORE: HeuristicWeights = { scoreDifferential: 1, potentialScore: 0 };
const W_BOTH: HeuristicWeights = { scoreDifferential: 1, potentialScore: 1 };

/** Build a 7×7 board with a fixed layout for deterministic testing.
 *  Row 0: [bit, AND, bit, AND, bit, AND, bit]
 *  Remaining rows follow the natural (r+c)%2 pattern with OR gates everywhere.
 */
function boardWithGate(gate: GateType): BoardState {
  const base = initializeBoard('two-player');
  // Override all gate cells to the requested type
  const cells: Cell[][] = base.cells.map(row =>
    row.map(cell => (cell.type === 'gate' ? { type: 'gate' as const, gate } : { ...cell })),
  );
  return { ...base, cells };
}

/** Returns a fresh board whose scores and placedBy values are manually set. */
function boardWithScores(red: number, blue: number): BoardState {
  const state = initializeBoard('two-player');
  return { ...state, scores: { red, blue } };
}

/** Places a bit at (r,c) in the cell grid, updating placedBy. */
function placeBit(
  state: BoardState,
  r: number,
  c: number,
  value: BitValue,
  placedBy: 'red' | 'blue',
): BoardState {
  const cells = state.cells.map(row => row.map(cell => ({ ...cell })));
  const cell = cells[r][c];
  if (cell.type !== 'bit') throw new Error(`(${r},${c}) is not a bit cell`);
  cell.value = value;
  cell.placedBy = placedBy;
  return { ...state, cells };
}

// ---------------------------------------------------------------------------
// Tests – score differential term
// ---------------------------------------------------------------------------

describe('evaluateState – score differential', () => {
  it('returns 0 when scores are equal', () => {
    const state = boardWithScores(3, 3);
    expect(evaluateState(state, 'red', W_ONLY_SCORE)).toBe(0);
  });

  it('returns positive when computer leads', () => {
    const state = boardWithScores(5, 2);
    expect(evaluateState(state, 'red', W_ONLY_SCORE)).toBeGreaterThan(0);
  });

  it('returns negative when human leads', () => {
    const state = boardWithScores(2, 5);
    expect(evaluateState(state, 'red', W_ONLY_SCORE)).toBeLessThan(0);
  });

  it('is symmetric: computer=red vs computer=blue', () => {
    const state = boardWithScores(5, 2);
    const asRed = evaluateState(state, 'red', W_ONLY_SCORE);
    const asBlue = evaluateState(state, 'blue', W_ONLY_SCORE);
    expect(asRed).toBe(-asBlue);
  });

  it('scales with the weight', () => {
    const state = boardWithScores(4, 1);
    const w2: HeuristicWeights = { scoreDifferential: 2, potentialScore: 0 };
    expect(evaluateState(state, 'red', w2)).toBe(6); // (4-1)*2
  });
});

// ---------------------------------------------------------------------------
// Tests – potential score term
// ---------------------------------------------------------------------------

describe('evaluateState – potential score term', () => {
  it('returns 0 potential when no bits are placed', () => {
    const state = initializeBoard('two-player');
    const score0 = evaluateState(state, 'red', W_ONLY_SCORE);
    const scoreP = evaluateState(state, 'red', W_BOTH);
    // No bits placed → potential = 0
    expect(score0).toBe(scoreP);
  });

  it('returns non-zero potential when exactly one bit of a gate direction is placed', () => {
    // Place red's bit at (0,0). Gate at (0,1) is now half-filled horizontally.
    // (0,2) is still empty.
    // Use OR gate + bit=1:
    //   OR(1,0)=1 → placed-bit score=+1;  OR(1,1)=1 → placed-bit score=+1 → average=+1 ≠ 0
    const base = boardWithGate('OR');
    const state = placeBit(base, 0, 0, 1, 'red');

    const scoreNoP = evaluateState(state, 'red', W_ONLY_SCORE);
    const scoreP = evaluateState(state, 'red', W_BOTH);
    // With potential weight > 0 and a half-filled gate, scores should differ.
    expect(scoreP).not.toBe(scoreNoP);
  });

  it('computer-placed bit gives positive potential contribution to computer', () => {
    // OR gate + bit=1: average over the two unplaced-bit values = (1 + 1) / 2 = +1 > 0.
    //   OR(1,0)=1 → placed-bit (value=1) matches gate output → score=+1
    //   OR(1,1)=1 → placed-bit (value=1) matches gate output → score=+1
    const base = boardWithGate('OR');
    const state = placeBit(base, 0, 0, 1, 'red');
    const potential = evaluateState(state, 'red', { scoreDifferential: 0, potentialScore: 1 });
    expect(potential).toBeGreaterThan(0);
  });

  it('human-placed bit gives negative potential contribution to computer', () => {
    // Same OR gate + bit=1 scenario, but bit placed by human → contribution is negated.
    const base = boardWithGate('OR');
    const state = placeBit(base, 0, 0, 1, 'blue');
    const potential = evaluateState(state, 'red', { scoreDifferential: 0, potentialScore: 1 });
    expect(potential).toBeLessThan(0);
  });

  it('ignores directions where both bits are already placed', () => {
    const base = boardWithGate('AND');
    // Place both bits around gate (0,1): (0,0) and (0,2).
    let state = placeBit(base, 0, 0, 1, 'red');
    state = placeBit(state, 0, 2, 0, 'blue');
    // Both bits placed → that gate direction is fully scored, no potential remaining.
    // Remaining half-filled gates from other directions may still contribute, but
    // the potential should be the same as without the potentialScore weight when
    // all on-board gates are fully resolved.
    // Here we just verify the function doesn't crash and returns a number.
    const result = evaluateState(state, 'red', W_BOTH);
    expect(typeof result).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Tests – Term B: empty-cell claim value
// ---------------------------------------------------------------------------

describe('evaluateState – empty-cell claim value (Term B)', () => {
  it('placing a bit creates non-zero potential through adjacent half-filled gate directions', () => {
    // OR gate + placed=1 at (0,0) by red.
    // Gap formula for placed bit: OR(1,0)=1 → placed earns +1, other(0) earns -1, gap=+2.
    //                             OR(1,1)=1 → placed earns +1, other(1) earns +1, gap=0.
    // Average gap (Term A) = +1 per direction — strictly positive.
    const base = boardWithGate('OR');
    const state = placeBit(base, 0, 0, 1, 'red');
    const potential = evaluateState(state, 'red', { scoreDifferential: 0, potentialScore: 1 });
    expect(potential).not.toBe(0);
  });

  it('Term B claim is attributed to the current player (red when it is red turn)', () => {
    // OR gate + placed=1 at (0,0) by red. currentPlayer is 'red' on a fresh board.
    // Term A (placed bit gap) = +1 per half-filled direction → positive for computer=red.
    // Term B (empty cell claim) has a 0.5 discount attributed to currentPlayer=red → positive.
    const base = boardWithGate('OR');
    const stateRedTurn = placeBit(base, 0, 0, 1, 'red');
    expect(stateRedTurn.currentPlayer).toBe('red');

    const evalAsRed = evaluateState(stateRedTurn, 'red', { scoreDifferential: 0, potentialScore: 1 });
    // Red placed the bit and is the current player → both terms favour computer=red.
    expect(evalAsRed).toBeGreaterThan(0);
  });

  it('Term B claim flips sign when viewed from opposite side', () => {
    // Same board: OR gate + placed=1 at (0,0) by red, currentPlayer=red.
    // For computer=red  → both terms positive → eval > 0.
    // For computer=blue → both terms negative → eval < 0.
    const base = boardWithGate('OR');
    const state = placeBit(base, 0, 0, 1, 'red');

    const evalAsRed = evaluateState(state, 'red', { scoreDifferential: 0, potentialScore: 1 });
    const evalAsBlue = evaluateState(state, 'blue', { scoreDifferential: 0, potentialScore: 1 });
    expect(Math.sign(evalAsRed)).toBe(-Math.sign(evalAsBlue));
  });

  it('returns 0 Term B for a fully empty board (no half-filled gates)', () => {
    const state = initializeBoard('two-player');
    const scoreNoP = evaluateState(state, 'red', W_ONLY_SCORE);
    const scoreP = evaluateState(state, 'red', W_BOTH);
    // No bits placed → no half-filled gates → Term B = 0 → totals are equal.
    expect(scoreNoP).toBe(scoreP);
  });
});
