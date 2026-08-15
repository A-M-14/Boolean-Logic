import type { CircuitState } from '../logic-circuit-simulator-engine/index.js';

export type { CircuitState };

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Number of truth-table input variables per difficulty level. */
export const VAR_COUNTS: Record<Difficulty, number> = {
  easy:   3,
  medium: 4,
  hard:   5,
};

/** Variable names, indexed 0 → A, 1 → B, … */
export const VAR_NAMES = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * A truth table for a Boolean function of `varCount` variables.
 * `outputs[i]` is the expected output for input combination i, where the
 * binary encoding of i assigns variable A to the MSB and the last variable
 * to the LSB (e.g. for 3 vars: A = bit 2, B = bit 1, C = bit 0 of i).
 */
export interface TruthTable {
  readonly varCount: number;
  readonly outputs:  readonly boolean[];
}

/** A Boolean expression tree node produced by Circuit Minimizer. */
export type Expr =
  | { readonly kind: 'lit';  readonly var: string; readonly neg: boolean }
  | { readonly kind: 'and';  readonly children: readonly Expr[] }
  | { readonly kind: 'or';   readonly children: readonly Expr[] }
  | { readonly kind: 'nand'; readonly children: readonly Expr[] }
  | { readonly kind: 'nor';  readonly children: readonly Expr[] }
  | { readonly kind: 'xor';  readonly left: Expr; readonly right: Expr }
  | { readonly kind: 'xnor'; readonly left: Expr; readonly right: Expr }
  | { readonly kind: 'not';  readonly child: Expr };

/** Result produced by Circuit Minimizer. */
export interface MinimizationResult {
  readonly expr:      Expr;
  readonly gateCount: number;
}

/** A generated simulator challenge. */
export interface Challenge {
  readonly difficulty:         Difficulty;
  readonly truthTable:         TruthTable;
  /** Minimum gate count established by Circuit Minimizer at generation time. */
  readonly referenceGateCount: number;
  /** Reference circuit produced by Solution Builder for optional display. */
  readonly referenceCircuit:   CircuitState;
}

/** One failing input combination found by Circuit Verifier. */
export interface VerificationFailure {
  readonly inputs:   readonly boolean[];
  readonly expected: boolean;
  readonly actual:   boolean | undefined;
}

/** Result returned by Circuit Verifier. */
export interface VerificationResult {
  readonly correct:   boolean;
  readonly gateCount: number;
  readonly failures:  readonly VerificationFailure[];
}
