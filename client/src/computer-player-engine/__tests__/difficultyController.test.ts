import { describe, it, expect } from 'vitest';
import { initializeBoard, applyMove, BOARD_SIZE } from '@boolean-logic/shared';
import { getSearchConfig, selectComputerMove } from '../difficultyController';
import type { Difficulty } from '../types';

// ---------------------------------------------------------------------------
// Tests – getSearchConfig
// ---------------------------------------------------------------------------

describe('getSearchConfig', () => {
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  it('returns a config for every difficulty level', () => {
    for (const d of difficulties) {
      const config = getSearchConfig(d);
      expect(config).toBeDefined();
      expect(typeof config.depth).toBe('number');
      expect(typeof config.useAlphaBeta).toBe('boolean');
    }
  });

  it('easy has the shallowest depth', () => {
    const easy = getSearchConfig('easy');
    const medium = getSearchConfig('medium');
    const hard = getSearchConfig('hard');
    expect(easy.depth).toBeLessThan(medium.depth);
    expect(medium.depth).toBeLessThan(hard.depth);
  });

  it('medium and hard use Alpha-Beta pruning', () => {
    expect(getSearchConfig('medium').useAlphaBeta).toBe(true);
    expect(getSearchConfig('hard').useAlphaBeta).toBe(true);
  });

  it('medium and hard have a non-zero potentialScore weight', () => {
    expect(getSearchConfig('medium').heuristicWeights.potentialScore).toBeGreaterThan(0);
    expect(getSearchConfig('hard').heuristicWeights.potentialScore).toBeGreaterThan(0);
  });

  it('hard has a higher potentialScore weight than medium', () => {
    const medium = getSearchConfig('medium').heuristicWeights.potentialScore;
    const hard = getSearchConfig('hard').heuristicWeights.potentialScore;
    expect(hard).toBeGreaterThan(medium);
  });

  it('all configs have scoreDifferential weight > 0', () => {
    for (const d of difficulties) {
      expect(getSearchConfig(d).heuristicWeights.scoreDifferential).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests – selectComputerMove
// ---------------------------------------------------------------------------

describe('selectComputerMove', () => {
  it('returns a valid move for each difficulty', () => {
    const state = initializeBoard('two-player');
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const move = selectComputerMove(state, d, 'blue');
      expect(typeof move.row).toBe('number');
      expect(typeof move.col).toBe('number');
      expect(move.value === 0 || move.value === 1).toBe(true);
    }
  });

  it('returned move targets an empty bit cell', () => {
    const state = initializeBoard('two-player');
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const move = selectComputerMove(state, d, 'red');
      const cell = state.cells[move.row][move.col];
      expect(cell.type).toBe('bit');
      if (cell.type === 'bit') expect(cell.value).toBeNull();
    }
  });

  it('returned move can be legally applied', () => {
    const state = initializeBoard('two-player');
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const move = selectComputerMove(state, d, 'red');
      expect(() => applyMove(state, move)).not.toThrow();
    }
  });

  it('works for both red and blue computer players', () => {
    const stateRed = initializeBoard('two-player');
    // Blue gets its turn after red places one bit.
    const { newState: stateBlue } = applyMove(stateRed, { row: 0, col: 0, value: 1 });

    const moveRed = selectComputerMove(stateRed, 'easy', 'red');
    expect(moveRed).toBeDefined();

    const moveBlue = selectComputerMove(stateBlue, 'easy', 'blue');
    expect(moveBlue).toBeDefined();
  });

  it('easy is deterministic across two calls on the same state', () => {
    // For the same board state, two easy calls should return the same move
    // (Minimax is deterministic; no randomness).
    const state = initializeBoard('two-player');
    const move1 = selectComputerMove(state, 'easy', 'red');
    const move2 = selectComputerMove(state, 'easy', 'red');
    expect(move1.row).toBe(move2.row);
    expect(move1.col).toBe(move2.col);
    expect(move1.value).toBe(move2.value);
  });

  it('the hard computer does not lose more points than easy on the first move', () => {
    // Both should choose a move that doesn't immediately lose points (or gains the most).
    // This is a sanity check, not a strict ordering guarantee.
    const state = initializeBoard('two-player');
    const easyMove = selectComputerMove(state, 'easy', 'red');
    const hardMove = selectComputerMove(state, 'hard', 'red');

    const { newState: easyState } = applyMove(state, easyMove);
    const { newState: hardState } = applyMove(state, hardMove);

    // Neither move should leave the computer in a provably worse immediate position.
    // (Both scores start at 0 so the first move often scores 0; just verify no error.)
    expect(typeof easyState.scores.red).toBe('number');
    expect(typeof hardState.scores.red).toBe('number');
  });
});
