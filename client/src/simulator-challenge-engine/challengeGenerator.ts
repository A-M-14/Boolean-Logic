/**
 * Challenge Generator — produces randomised, non-trivial Boolean-function
 * challenges at Easy (3 vars), Medium (4 vars), or Hard (5 vars) difficulty.
 */

import type { Challenge, Difficulty, TruthTable } from './types.js';
import { VAR_COUNTS } from './types.js';
import { minimize } from './circuitMinimizer.js';
import { buildSolution } from './solutionBuilder.js';

// ── Trivial-function detection ─────────────────────────────────────────────────

/**
 * Returns true when the truth table is trivial:
 *   • constant (all outputs identical), or
 *   • equivalent to a single literal  (xi or ¬xi for some variable i).
 */
export function isTrivial(outputs: readonly boolean[], varCount: number): boolean {
  const allTrue  = outputs.every(o => o);
  const allFalse = outputs.every(o => !o);
  if (allTrue || allFalse) return true;

  // Check f = xi  and  f = ¬xi  for each variable.
  for (let v = 0; v < varCount; v++) {
    const mask = 1 << (varCount - 1 - v);   // bit position for variable v (MSB = var 0)
    let matchPos = true;
    let matchNeg = true;
    for (let i = 0; i < outputs.length; i++) {
      const bit = (i & mask) !== 0;
      if (outputs[i] !== bit)  matchPos = false;
      if (outputs[i] !== !bit) matchNeg = false;
      if (!matchPos && !matchNeg) break;
    }
    if (matchPos || matchNeg) return true;
  }

  return false;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generates a non-trivial Boolean-function challenge for the given difficulty.
 * Runs the Circuit Minimizer at generation time and stores the reference
 * minimum gate count and circuit so the UI can display the optimal solution.
 */
export function generateChallenge(difficulty: Difficulty): Challenge {
  const varCount  = VAR_COUNTS[difficulty];
  const rowCount  = 1 << varCount;

  // Re-roll until the truth table is non-trivial.
  let outputs: boolean[];
  do {
    outputs = Array.from({ length: rowCount }, () => Math.random() < 0.5);
  } while (isTrivial(outputs, varCount));

  const truthTable: TruthTable = { varCount, outputs };
  const minimization   = minimize(truthTable);
  const referenceCircuit = buildSolution(minimization, varCount);

  return {
    difficulty,
    truthTable,
    referenceGateCount: minimization.gateCount,
    referenceCircuit,
  };
}
