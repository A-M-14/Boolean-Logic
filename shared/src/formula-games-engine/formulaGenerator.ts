import type {
  FormulaNode,
  Formula,
  VariableAssignment,
  BinaryOperator,
  Difficulty,
  EvaluationRound,
  EquivalenceRound,
  EquivalenceProofStep,
} from './types.js';
import { evaluateFormula, checkEquivalence } from './expressionEvaluator.js';

// ---------------------------------------------------------------------------
// Difficulty configuration
// ---------------------------------------------------------------------------

interface DifficultyConfig {
  readonly vars:         string[];
  readonly minBinaryOps: number;
  readonly maxDepth:     number;
  readonly ops:          BinaryOperator[];
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy:   { vars: ['x', 'y'],           minBinaryOps: 1, maxDepth: 2, ops: ['AND', 'OR'] },
  medium: { vars: ['x', 'y', 'z'],      minBinaryOps: 2, maxDepth: 3, ops: ['AND', 'OR', 'XOR'] },
  hard:   { vars: ['x', 'y', 'z', 'w'], minBinaryOps: 3, maxDepth: 4, ops: ['AND', 'OR', 'XOR'] },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function collectVariables(node: FormulaNode, out: Set<string>): void {
  switch (node.type) {
    case 'variable':
      out.add(node.name);
      break;
    case 'not':
      collectVariables(node.operand, out);
      break;
    case 'binary':
      collectVariables(node.left, out);
      collectVariables(node.right, out);
      break;
  }
}

function makeFormula(root: FormulaNode): Formula {
  const varSet = new Set<string>();
  collectVariables(root, varSet);
  return { root, variables: [...varSet].sort() };
}

function serializeNode(node: FormulaNode): string {
  switch (node.type) {
    case 'variable': return node.name;
    case 'not':      return `NOT(${serializeNode(node.operand)})`;
    case 'binary':   return `${node.operator}(${serializeNode(node.left)},${serializeNode(node.right)})`;
  }
}

function makeLeaf(vars: string[], used: Set<string>): FormulaNode {
  const unused  = vars.filter(v => !used.has(v));
  const varName = unused.length > 0 ? randomElement(unused) : randomElement(vars);
  used.add(varName);
  const varNode: FormulaNode = { type: 'variable', name: varName };
  return Math.random() < 0.3 ? { type: 'not', operand: varNode } : varNode;
}

/**
 * Recursively generates a random formula node.
 *
 * Two independent depth concepts are tracked:
 *   `depth`                 – total recursion depth, used only to enforce maxDepth.
 *   `minBinaryOpsRemaining` – how many more binary operators must still appear
 *                             somewhere in this subtree.  NOT wrappers do not
 *                             consume this budget; only binary nodes do.
 *
 * While minBinaryOpsRemaining > 0 a leaf is forbidden, but a NOT wrapper is
 * still allowed because it does not consume the binary budget.  Once the budget
 * is zero, normal probabilistic generation resumes.
 *
 * When a binary node is created with budget > 0, the remaining budget after
 * accounting for the node itself is split randomly between the two child
 * subtrees, producing natural variety in tree shape.
 */
function generateNode(
  vars:                  string[],
  ops:                   BinaryOperator[],
  depth:                 number,
  maxDepth:              number,
  minBinaryOpsRemaining: number,
  used:                  Set<string>,
  binaryOpsLeft:         { count: number },
): FormulaNode {

  if (minBinaryOpsRemaining > 0) {
    // NOT wrapper is still allowed — it does not consume the binary budget —
    // but only when there is still recursion headroom left for a binary node.
    if (depth > 0 && depth < maxDepth && Math.random() < 0.15) {
      return {
        type:    'not',
        operand: generateNode(vars, ops, depth + 1, maxDepth, minBinaryOpsRemaining, used, binaryOpsLeft),
      };
    }
    // Must place a binary node.  Distribute the remaining budget (after
    // this node consumes 1) randomly across the two child subtrees.
    const remaining = minBinaryOpsRemaining - 1;
    const leftMin   = Math.floor(Math.random() * (remaining + 1)); // 0 … remaining
    const rightMin  = remaining - leftMin;
    binaryOpsLeft.count--;
    return {
      type:     'binary',
      operator: randomElement(ops),
      left:     generateNode(vars, ops, depth + 1, maxDepth, leftMin,  used, binaryOpsLeft),
      right:    generateNode(vars, ops, depth + 1, maxDepth, rightMin, used, binaryOpsLeft),
    };
  }

  // Binary budget satisfied — normal probabilistic generation.
  if (depth >= maxDepth || binaryOpsLeft.count === 0) {
    return makeLeaf(vars, used);
  }
  if (Math.random() < 0.35) {
    return makeLeaf(vars, used);
  }
  if (depth > 0 && Math.random() < 0.15) {
    return {
      type:    'not',
      operand: generateNode(vars, ops, depth + 1, maxDepth, 0, used, binaryOpsLeft),
    };
  }
  binaryOpsLeft.count--;
  return {
    type:     'binary',
    operator: randomElement(ops),
    left:     generateNode(vars, ops, depth + 1, maxDepth, 0, used, binaryOpsLeft),
    right:    generateNode(vars, ops, depth + 1, maxDepth, 0, used, binaryOpsLeft),
  };
}

function generateRandomFormula(difficulty: Difficulty): Formula {
  const { vars, ops, minBinaryOps, maxDepth } = DIFFICULTY_CONFIG[difficulty];
  let formula: Formula;
  do {
    const used = new Set<string>();
    formula    = makeFormula(generateNode(vars, ops, 0, maxDepth, minBinaryOps, used, { count: MAX_BINARY_OPS }));
  } while (formula.variables.length !== vars.length);
  return formula;
}

function generateRandomAssignment(variables: readonly string[]): VariableAssignment {
  const assignment: Record<string, boolean> = {};
  for (const v of variables) assignment[v] = Math.random() < 0.5;
  return assignment;
}

// ---------------------------------------------------------------------------
// Equivalent-formula generation with proof recording
// ---------------------------------------------------------------------------

function countNodes(node: FormulaNode): number {
  switch (node.type) {
    case 'variable': return 1;
    case 'not':      return 1 + countNodes(node.operand);
    case 'binary':   return 1 + countNodes(node.left) + countNodes(node.right);
  }
}

function countBinaryOps(node: FormulaNode): number {
  switch (node.type) {
    case 'variable': return 0;
    case 'not':      return countBinaryOps(node.operand);
    case 'binary':   return 1 + countBinaryOps(node.left) + countBinaryOps(node.right);
  }
}

const MAX_BINARY_OPS = 10;

// Distribution is suppressed once the formula exceeds this node count to
// prevent combinatorial blowup.
const MAX_NODES_FOR_DISTRIBUTION = 25;

// ---------------------------------------------------------------------------
// Rule keys, display names, inverses, and application probabilities
// ---------------------------------------------------------------------------

/**
 * Internal identifier for each rewrite rule — more specific than the display
 * name and needed for anti-reversal tracking between passes.
 */
type RuleKey =
  | 'commutativity'
  | 'double-negation'
  | 'demorgan-forward'
  | 'demorgan-reverse'
  | 'xor-expansion'
  | 'xor-contraction'
  | 'distribution-forward'
  | 'distribution-reverse';

/**
 * For each rule, the key of the rule that would undo it.
 * Double Negation has no entry (introduction direction is not used).
 */
const RULE_INVERSE: Partial<Record<RuleKey, RuleKey>> = {
  'commutativity':          'commutativity',
  'demorgan-forward':       'demorgan-reverse',
  'demorgan-reverse':       'demorgan-forward',
  'xor-expansion':          'xor-contraction',
  'xor-contraction':        'xor-expansion',
  'distribution-forward':   'distribution-reverse',
  'distribution-reverse':   'distribution-forward',
};

/** User-visible names shown in the proof chain. */
const RULE_DISPLAY: Record<RuleKey, string> = {
  'commutativity':          'Commutativity',
  'double-negation':        'Double Negation',
  'demorgan-forward':       "De Morgan's",
  'demorgan-reverse':       "De Morgan's",
  'xor-expansion':          'XOR expansion',
  'xor-contraction':        'XOR contraction',
  'distribution-forward':   'Distribution',
  'distribution-reverse':   'Distribution',
};

/**
 * Probability that a rule fires when it is structurally applicable.
 * All values are in [0.50, 0.80].
 */
const RULE_PROBABILITY: Record<RuleKey, number> = {
  'commutativity':          0.50,
  'double-negation':        0.65,
  'demorgan-forward':       0.70,
  'demorgan-reverse':       0.70,
  'xor-expansion':          0.65,
  'xor-contraction':        0.65,
  'distribution-forward':   0.55,
  'distribution-reverse':   0.60,
};

type GenRewrite = {
  newRoot:  FormulaNode;  // full formula after applying the rule
  ruleName: string;       // display name for the proof step
  ruleKey:  RuleKey;      // internal key for anti-reversal tracking
  on:       FormulaNode;  // input subformula the rule was applied to
  outputOn: FormulaNode;  // local result (what `on` became); used to build
                          // the forbidden map for the next pass
  weight:   number;
};

/**
 * Collects all applicable single-step rewrites from every position in the
 * formula subtree rooted at `node`, lifting each result back to the full
 * formula root via the `context` closure.
 *
 * Does NOT apply probability or forbidden filters; the caller does that.
 *
 * Rules collected (both directions unless noted):
 *  all difficulties  – Commutativity, Double Negation (elimination only),
 *                      De Morgan's forward & reverse
 *  medium and hard   – XOR expansion & contraction, Distribution
 *                      forward & reverse
 */
function collectRewrites(
  node:       FormulaNode,
  context:    (n: FormulaNode) => FormulaNode,
  difficulty: Difficulty,
  fullSize:   number,
  out:        GenRewrite[],
): void {

  const emit = (outputOn: FormulaNode, ruleKey: RuleKey, weight: number) => {
    out.push({
      newRoot:  context(outputOn),
      ruleName: RULE_DISPLAY[ruleKey],
      ruleKey,
      on:       node,
      outputOn,
      weight,
    });
  };

  // ── Rules applicable at this node ────────────────────────────────────────

  // Commutativity: A op B → B op A
  if (node.type === 'binary') {
    emit({ ...node, left: node.right, right: node.left }, 'commutativity', 1);
  }

  // Double Negation elimination: NOT(NOT(A)) → A  (no introduction direction)
  if (node.type === 'not' && node.operand.type === 'not') {
    emit(node.operand.operand, 'double-negation', 2);
  }

  // De Morgan's forward: NOT(A AND B) → NOT(A) OR  NOT(B)
  //                      NOT(A OR B)  → NOT(A) AND NOT(B)
  if (node.type === 'not' && node.operand.type === 'binary' &&
      (node.operand.operator === 'AND' || node.operand.operator === 'OR')) {
    const inner = node.operand;
    const newOp: BinaryOperator = inner.operator === 'AND' ? 'OR' : 'AND';
    emit(
      { type: 'binary', operator: newOp,
        left:  { type: 'not', operand: inner.left  },
        right: { type: 'not', operand: inner.right },
      },
      'demorgan-forward', 3,
    );
  }

  // De Morgan's reverse: NOT(A) AND NOT(B) → NOT(A OR  B)
  //                      NOT(A) OR  NOT(B) → NOT(A AND B)
  if (node.type === 'binary' &&
      (node.operator === 'AND' || node.operator === 'OR') &&
      node.left.type === 'not' && node.right.type === 'not') {
    const newOp: BinaryOperator = node.operator === 'AND' ? 'OR' : 'AND';
    emit(
      { type: 'not', operand: {
          type: 'binary', operator: newOp,
          left:  node.left.operand,
          right: node.right.operand,
        },
      },
      'demorgan-reverse', 3,
    );
  }

  // XOR expansion: A XOR B → (A OR B) AND NOT(A AND B)  [medium and hard]
  if (node.type === 'binary' && node.operator === 'XOR' && difficulty !== 'easy') {
    emit(
      { type: 'binary', operator: 'AND',
        left:  { type: 'binary', operator: 'OR',  left: node.left, right: node.right },
        right: { type: 'not', operand: {
            type: 'binary', operator: 'AND', left: node.left, right: node.right,
          },
        },
      },
      'xor-expansion', 3,
    );
  }

  // XOR contraction: (A OR B) AND NOT(A AND B) → A XOR B  [medium and hard]
  if (difficulty !== 'easy' &&
      node.type === 'binary' && node.operator === 'AND' &&
      node.left.type === 'binary' && node.left.operator === 'OR' &&
      node.right.type === 'not' &&
      node.right.operand.type === 'binary' && node.right.operand.operator === 'AND' &&
      serializeNode(node.left.left)  === serializeNode(node.right.operand.left) &&
      serializeNode(node.left.right) === serializeNode(node.right.operand.right)) {
    emit(
      { type: 'binary', operator: 'XOR', left: node.left.left, right: node.left.right },
      'xor-contraction', 3,
    );
  }

  // Distribution [medium and hard, suppressed above MAX_NODES_FOR_DISTRIBUTION]
  if (difficulty !== 'easy' && fullSize <= MAX_NODES_FOR_DISTRIBUTION) {

    // Forward: A AND (B OR C) → (A AND B) OR (A AND C)
    if (node.type === 'binary' && node.operator === 'AND' &&
        node.right.type === 'binary' && node.right.operator === 'OR') {
      emit(
        { type: 'binary', operator: 'OR',
          left:  { type: 'binary', operator: 'AND', left: node.left, right: node.right.left  },
          right: { type: 'binary', operator: 'AND', left: node.left, right: node.right.right },
        },
        'distribution-forward', 4,
      );
    }

    // Forward: (A OR B) AND C → (A AND C) OR (B AND C)
    if (node.type === 'binary' && node.operator === 'AND' &&
        node.left.type === 'binary' && node.left.operator === 'OR') {
      emit(
        { type: 'binary', operator: 'OR',
          left:  { type: 'binary', operator: 'AND', left: node.left.left,  right: node.right },
          right: { type: 'binary', operator: 'AND', left: node.left.right, right: node.right },
        },
        'distribution-forward', 4,
      );
    }

    // Forward: A OR (B AND C) → (A OR B) AND (A OR C)
    if (node.type === 'binary' && node.operator === 'OR' &&
        node.right.type === 'binary' && node.right.operator === 'AND') {
      emit(
        { type: 'binary', operator: 'AND',
          left:  { type: 'binary', operator: 'OR', left: node.left, right: node.right.left  },
          right: { type: 'binary', operator: 'OR', left: node.left, right: node.right.right },
        },
        'distribution-forward', 4,
      );
    }

    // Forward: (A AND B) OR C → (A OR C) AND (B OR C)
    if (node.type === 'binary' && node.operator === 'OR' &&
        node.left.type === 'binary' && node.left.operator === 'AND') {
      emit(
        { type: 'binary', operator: 'AND',
          left:  { type: 'binary', operator: 'OR', left: node.left.left,  right: node.right },
          right: { type: 'binary', operator: 'OR', left: node.left.right, right: node.right },
        },
        'distribution-forward', 4,
      );
    }

    // Reverse — common left factor: (A AND B) OR (A AND C) → A AND (B OR C)
    if (node.type === 'binary' && node.operator === 'OR' &&
        node.left.type  === 'binary' && node.left.operator  === 'AND' &&
        node.right.type === 'binary' && node.right.operator === 'AND' &&
        serializeNode(node.left.left) === serializeNode(node.right.left)) {
      emit(
        { type: 'binary', operator: 'AND',
          left:  node.left.left,
          right: { type: 'binary', operator: 'OR', left: node.left.right, right: node.right.right },
        },
        'distribution-reverse', 4,
      );
    }

    // Reverse — common right factor: (A AND B) OR (C AND B) → (A OR C) AND B
    if (node.type === 'binary' && node.operator === 'OR' &&
        node.left.type  === 'binary' && node.left.operator  === 'AND' &&
        node.right.type === 'binary' && node.right.operator === 'AND' &&
        serializeNode(node.left.right) === serializeNode(node.right.right)) {
      emit(
        { type: 'binary', operator: 'AND',
          left:  { type: 'binary', operator: 'OR', left: node.left.left, right: node.right.left },
          right: node.left.right,
        },
        'distribution-reverse', 4,
      );
    }
  }

  // ── Recurse into children ─────────────────────────────────────────────────
  if (node.type === 'not') {
    collectRewrites(node.operand, n => context({ type: 'not', operand: n }), difficulty, fullSize, out);
  } else if (node.type === 'binary') {
    collectRewrites(node.left,  n => context({ ...node, left:  n }), difficulty, fullSize, out);
    collectRewrites(node.right, n => context({ ...node, right: n }), difficulty, fullSize, out);
  }
}

/** Picks one item from `items` using weighted random selection. */
function weightedPick<T extends { weight: number }>(items: T[]): T {
  let r = Math.random() * items.reduce((s, x) => s + x.weight, 0);
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Generates a formula logically equivalent to `formula` by applying named
 * Boolean-algebra rules in multiple passes, recording every applied rule as
 * a proof step.
 *
 * Number of passes by difficulty:
 *   easy   – 1 pass   (2–4 steps per pass)
 *   medium – 2 passes (2–4 steps per pass)
 *   hard   – 3 passes (2–4 steps per pass)
 *
 * Within each pass, rules fire probabilistically (50–80% each) at every
 * applicable position in the tree.  Between passes, a forbidden map prevents
 * the next pass from undoing transformations made in the previous one:
 * if pass k applied rule R at node N → M, pass k+1 cannot apply R⁻¹ to M.
 *
 * Rules and directions:
 *   all difficulties  – De Morgan's (forward & reverse), Commutativity,
 *                       Double Negation elimination
 *   medium and hard   – XOR expansion & contraction, Distribution
 *                       (forward & reverse)
 */
function makeEquivalentWithProof(
  formula:    Formula,
  difficulty: Difficulty,
): { formula: Formula; proof: readonly EquivalenceProofStep[] } {
  const numPasses =
    difficulty === 'easy'   ? 1 :
    difficulty === 'medium' ? 2 : 3;
  const STEPS_MIN = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  const STEPS_MAX = 5;

  let current = formula.root;
  const proof: EquivalenceProofStep[] = [{ formula: current, ruleName: 'Given' }];
  const seen  = new Set<string>([serializeNode(current)]);

  // Maps serialize(outputSubformula) → ruleKey that produced it in the
  // previous pass.  In the next pass, the inverse of that rule is blocked
  // at that subformula position.
  let forbidden = new Map<string, RuleKey>();

  for (let pass = 0; pass < numPasses; pass++) {
    const stepsTarget =
      STEPS_MIN + Math.floor(Math.random() * (STEPS_MAX - STEPS_MIN + 1));

    // Outputs of rewrites applied in this pass — becomes the next forbidden map.
    const passOutputs = new Map<string, RuleKey>();

    for (let step = 0; step < stepsTarget; step++) {
      const candidates: GenRewrite[] = [];
      collectRewrites(current, n => n, difficulty, countNodes(current), candidates);

      // Apply seen + forbidden + binary-op cap + probability filters.
      let eligible = candidates.filter(r => {
        if (seen.has(serializeNode(r.newRoot))) return false;
        const prevRule = forbidden.get(serializeNode(r.on));
        if (prevRule !== undefined && RULE_INVERSE[prevRule] === r.ruleKey) return false;
        if (countBinaryOps(r.newRoot) > MAX_BINARY_OPS) return false;
        return Math.random() < RULE_PROBABILITY[r.ruleKey];
      });

      // If probability knocked out every candidate, fall back without it.
      if (eligible.length === 0) {
        eligible = candidates.filter(r => {
          if (seen.has(serializeNode(r.newRoot))) return false;
          const prevRule = forbidden.get(serializeNode(r.on));
          if (prevRule !== undefined && RULE_INVERSE[prevRule] === r.ruleKey) return false;
          if (countBinaryOps(r.newRoot) > MAX_BINARY_OPS) return false;
          return true;
        });
      }

      if (eligible.length === 0) break;

      const chosen = weightedPick(eligible);
      current = chosen.newRoot;
      seen.add(serializeNode(current));
      passOutputs.set(serializeNode(chosen.outputOn), chosen.ruleKey);
      proof.push({ formula: current, ruleName: chosen.ruleName, on: chosen.on });
    }

    forbidden = passOutputs;
  }

  // Safety: if the walk returned to the original, force a structural step.
  if (serializeNode(current) === serializeNode(formula.root)) {
    const candidates: GenRewrite[] = [];
    collectRewrites(current, n => n, difficulty, countNodes(current), candidates);
    const fresh = candidates.filter(r => !seen.has(serializeNode(r.newRoot)));
    const structural = fresh.filter(
      r => r.ruleKey === 'demorgan-forward' || r.ruleKey === 'distribution-forward',
    );
    const pick = structural[0] ?? fresh[0];
    if (pick) {
      current = pick.newRoot;
      proof.push({ formula: current, ruleName: pick.ruleName, on: pick.on });
    }
  }

  return { formula: makeFormula(current), proof };
}

// ---------------------------------------------------------------------------
// Public generators
// ---------------------------------------------------------------------------

/**
 * Generates a single round for the Formula Evaluation game.
 */
export function generateEvaluationRound(difficulty: Difficulty): EvaluationRound {
  const formula       = generateRandomFormula(difficulty);
  const assignment    = generateRandomAssignment(formula.variables);
  const correctAnswer = evaluateFormula(formula.root, assignment);
  return { formula, assignment, correctAnswer };
}

/**
 * Reverses a proof chain so it runs from the last formula back to the first.
 * The first step of the result is re-labelled 'Given'; every subsequent step
 * carries the ruleName and `on` field of the original step that connected the
 * same pair of formulas (valid because equality is symmetric).
 */
function reverseProof(proof: readonly EquivalenceProofStep[]): readonly EquivalenceProofStep[] {
  const n = proof.length;
  return Array.from({ length: n }, (_, i) => {
    const formula = proof[n - 1 - i].formula;
    if (i === 0) return { formula, ruleName: 'Given' };
    const src = proof[n - i];
    return { formula, ruleName: src.ruleName, on: src.on };
  });
}

/**
 * Generates a single round for the Formula Equivalence game.
 *
 * When `targetEquivalent` is true, formulaB is produced by applying a
 * sequence of named algebraic rules to formulaA; the proof chain is
 * embedded in the returned round.
 *
 * After the round is built, the display order of formulaA and formulaB is
 * randomised: with 50 % probability the two formulas are swapped so that
 * the generated formula appears as A on screen and the original seed formula
 * appears as B.  When the formulas are equivalent the proof chain is reversed
 * accordingly so it always runs from A to B.
 */
export function generateEquivalenceRound(
  difficulty: Difficulty, targetEquivalent: boolean): EquivalenceRound {
  const formulaA = generateRandomFormula(difficulty);

  let round: EquivalenceRound;

  if (targetEquivalent) {
    const { formula: formulaB, proof } = makeEquivalentWithProof(formulaA, difficulty);
    round = { formulaA, formulaB, areEquivalent: true, proof };
  } else {
    // Generate formulaB until it is provably NOT equivalent to formulaA.
    let formulaB: Formula | undefined;
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = generateRandomFormula(difficulty);
      if (!checkEquivalence(formulaA, candidate)) { formulaB = candidate; break; }
    }

    // Reliable fallback: negate the whole formula.
    if (!formulaB) {
      formulaB = makeFormula({ type: 'not', operand: formulaA.root });
    }

    round = { formulaA, formulaB, areEquivalent: checkEquivalence(formulaA, formulaB) };
  }

  // 50 % chance: swap display order so the generated formula appears as A.
  if (Math.random() < 0.5) {
    round = {
      formulaA: round.formulaB,
      formulaB: round.formulaA,
      areEquivalent: round.areEquivalent,
      ...(round.proof !== undefined ? { proof: reverseProof(round.proof) } : {}),
    };
  }

  return round;
}
