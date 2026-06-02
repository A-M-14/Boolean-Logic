/** Binary operator types used in formula expression trees. */
export type BinaryOperator = 'AND' | 'OR' | 'XOR';

/**
 * A node in a Boolean formula expression tree.
 * Formulas are represented as immutable recursive trees.
 */
export type FormulaNode =
  | { readonly type: 'variable'; readonly name: string }
  | { readonly type: 'not';      readonly operand: FormulaNode }
  | { readonly type: 'binary';   readonly operator: BinaryOperator; readonly left: FormulaNode; readonly right: FormulaNode };

/** A Boolean formula paired with its sorted list of variable names. */
export interface Formula {
  readonly root:      FormulaNode;
  readonly variables: readonly string[];
}

/** A mapping from variable name to boolean value. */
export type VariableAssignment = Readonly<Record<string, boolean>>;

/** Difficulty level controlling formula complexity. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** A single round in the Formula Evaluation game. */
export interface EvaluationRound {
  readonly formula:       Formula;
  readonly assignment:    VariableAssignment;
  readonly correctAnswer: boolean;
}

/** A single round in the Formula Equivalence game. */
export interface EquivalenceRound {
  readonly formulaA:      Formula;
  readonly formulaB:      Formula;
  readonly areEquivalent: boolean;
  /** Algebraic proof chain from formulaA to formulaB. Present when areEquivalent is true. */
  readonly proof?:        readonly EquivalenceProofStep[];
}

/** Result of submitting an answer in Evaluation mode. */
export interface EvaluationResult {
  readonly userAnswer:    boolean;
  readonly correctAnswer: boolean;
  readonly score:         number;
}

/** Result of submitting an answer in Equivalence mode. */
export interface EquivalenceResult {
  readonly userAnswer:    boolean;
  readonly areEquivalent: boolean;
  readonly score:         number;
}

/** Number of rounds per game session (both modes). */
export const ROUNDS_PER_SESSION = 10;

/** Duration of each round in seconds. */
export const ROUND_DURATION_SECONDS = 120;

/** One step in a step-by-step evaluation solution. */
export interface EvaluationStep {
  readonly node:  FormulaNode;
  readonly value: boolean;
}

/** One step in an equivalence proof chain. */
export interface EquivalenceProofStep {
  readonly formula:   FormulaNode;
  readonly ruleName:  string;
  /** The specific sub-expression the rule was applied to (absent on the first/Given step). */
  readonly on?:       FormulaNode;
}
