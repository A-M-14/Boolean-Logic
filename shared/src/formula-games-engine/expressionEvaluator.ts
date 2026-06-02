import { evaluateGate } from '../logic-gate-handler/gateEvaluator.js';
import type { FormulaNode, VariableAssignment, Formula } from './types.js';

/**
 * Evaluates a Boolean formula expression tree given variable assignments.
 * Delegates all logical computation to the Logic Gate Handler.
 *
 * @throws if the assignment is missing a required variable.
 */
export function evaluateFormula(node: FormulaNode, assignment: VariableAssignment): boolean {
  switch (node.type) {
    case 'variable': {
      const val = assignment[node.name];
      if (val === undefined) {
        throw new Error(`No assignment provided for variable '${node.name}'`);
      }
      return val;
    }
    case 'not':
      return evaluateGate('NOT', [evaluateFormula(node.operand, assignment)]);

    case 'binary':
      return evaluateGate(node.operator, [
        evaluateFormula(node.left,  assignment),
        evaluateFormula(node.right, assignment),
      ]);
  }
}

/**
 * Determines whether two Boolean formulas are logically equivalent by
 * exhaustively checking all variable assignments (full truth-table comparison).
 *
 * Uses the union of both formulas' variable sets, so formulas with different
 * variable names are correctly handled.
 */
export function checkEquivalence(formulaA: Formula, formulaB: Formula): boolean {
  const allVars = [...new Set([...formulaA.variables, ...formulaB.variables])].sort();
  const n  = allVars.length;

  for (let mask = 0; mask < (1 << n); mask++) {
    const assignment: Record<string, boolean> = {};
    for (let i = 0; i < n; i++) {
      assignment[allVars[i]] = Boolean((mask >> i) & 1);
    }
    const a = evaluateFormula(formulaA.root, assignment);
    const b = evaluateFormula(formulaB.root, assignment);
    if (a !== b) return false;
  }
  return true;
}

/**
 * Finds a variable assignment that witnesses the non-equivalence of two
 * formulas (an assignment on which they differ), or null if they are
 * equivalent.
 */
export function findCounterexample(
  formulaA: Formula,
  formulaB: Formula,
): VariableAssignment | null {
  const allVars = [...new Set([...formulaA.variables, ...formulaB.variables])].sort();
  const n = allVars.length;

  for (let mask = 0; mask < (1 << n); mask++) {
    const assignment: Record<string, boolean> = {};
    for (let i = 0; i < n; i++) {
      assignment[allVars[i]] = Boolean((mask >> i) & 1);
    }
    const a = evaluateFormula(formulaA.root, assignment);
    const b = evaluateFormula(formulaB.root, assignment);
    if (a !== b) return assignment;
  }

  return null;
}
