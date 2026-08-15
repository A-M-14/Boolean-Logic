import { describe, it, expect } from 'vitest';
import { generateChallenge, isTrivial } from '../challengeGenerator';
import { VAR_COUNTS } from '../types';
import type { Difficulty } from '../types';

// ── isTrivial ──────────────────────────────────────────────────────────────────

describe('isTrivial', () => {
  it('detects all-false as trivial', () => {
    expect(isTrivial([false, false, false, false], 2)).toBe(true);
  });

  it('detects all-true as trivial', () => {
    expect(isTrivial([true, true, true, true], 2)).toBe(true);
  });

  it('detects f=A (positive literal) as trivial', () => {
    // 2 variables: A=0→0,0; A=1→1,1
    expect(isTrivial([false, false, true, true], 2)).toBe(true);
  });

  it('detects f=¬A (negated literal) as trivial', () => {
    expect(isTrivial([true, true, false, false], 2)).toBe(true);
  });

  it('detects f=B as trivial', () => {
    // 2 variables AB: B=0 at rows 00,10; B=1 at rows 01,11
    expect(isTrivial([false, true, false, true], 2)).toBe(true);
  });

  it('detects f=¬B as trivial', () => {
    expect(isTrivial([true, false, true, false], 2)).toBe(true);
  });

  it('does NOT flag AND(A,B) as trivial', () => {
    expect(isTrivial([false, false, false, true], 2)).toBe(false);
  });

  it('does NOT flag XOR(A,B) as trivial', () => {
    expect(isTrivial([false, true, true, false], 2)).toBe(false);
  });

  it('does NOT flag OR(A,B) as trivial', () => {
    expect(isTrivial([false, true, true, true], 2)).toBe(false);
  });

  it('handles 3-variable f=A correctly', () => {
    // A=MSB: rows 0-3 have A=0, rows 4-7 have A=1
    expect(isTrivial([false, false, false, false, true, true, true, true], 3)).toBe(true);
  });

  it('does NOT flag majority(A,B,C) as trivial', () => {
    expect(isTrivial([false, false, false, true, false, true, true, true], 3)).toBe(false);
  });
});

// ── generateChallenge ─────────────────────────────────────────────────────────

const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

describe('generateChallenge', () => {
  for (const diff of difficulties) {
    const expectedVarCount = VAR_COUNTS[diff];
    const expectedRowCount = 1 << expectedVarCount;

    it(`returns correct varCount for ${diff}`, () => {
      const ch = generateChallenge(diff);
      expect(ch.truthTable.varCount).toBe(expectedVarCount);
    });

    it(`returns outputs of length 2^${expectedVarCount} for ${diff}`, () => {
      const ch = generateChallenge(diff);
      expect(ch.truthTable.outputs.length).toBe(expectedRowCount);
    });

    it(`produces a non-trivial truth table for ${diff}`, () => {
      const ch = generateChallenge(diff);
      const { varCount, outputs } = ch.truthTable;
      expect(isTrivial(outputs, varCount)).toBe(false);
    });

    it(`referenceGateCount is positive for ${diff}`, () => {
      const ch = generateChallenge(diff);
      expect(ch.referenceGateCount).toBeGreaterThan(0);
    });

    it(`referenceCircuit is non-empty for ${diff}`, () => {
      const ch = generateChallenge(diff);
      expect(ch.referenceCircuit.nodes.size).toBeGreaterThan(0);
    });

    it(`difficulty field is set correctly for ${diff}`, () => {
      const ch = generateChallenge(diff);
      expect(ch.difficulty).toBe(diff);
    });
  }
});
