// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  Difficulty,
  TruthTable,
  Expr,
  MinimizationResult,
  Challenge,
  VerificationFailure,
  VerificationResult,
  CircuitState,
} from './types.js';
export { VAR_COUNTS, VAR_NAMES } from './types.js';

// ── Circuit Minimizer ──────────────────────────────────────────────────────────
export { minimize, countGates, getNegatedVars } from './circuitMinimizer.js';

// ── Challenge Generator ────────────────────────────────────────────────────────
export { generateChallenge, isTrivial } from './challengeGenerator.js';

// ── Circuit Verifier ───────────────────────────────────────────────────────────
export { verifyCircuit, countCircuitGates } from './circuitVerifier.js';

// ── Solution Builder ───────────────────────────────────────────────────────────
export { buildSolution } from './solutionBuilder.js';
