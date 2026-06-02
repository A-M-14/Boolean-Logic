import React from 'react';
import { generateEvaluationSolution } from '@boolean-logic/shared';
import type { EvaluationRound, EvaluationStep, FormulaNode } from '@boolean-logic/shared';
import { FormulaDisplay } from './FormulaDisplay.js';
import type { FormulaNotation } from './types.js';
import './EvaluationSolutionDisplay.css';

// ─── Sub-step types ───────────────────────────────────────────────────────────

type SubStep =
  | { kind: 'operand'; node: FormulaNode; value: boolean }
  | { kind: 'compute'; text: string;      value: boolean };

interface EvaluationPane {
  paneNumber: number;
  titleNode:  FormulaNode;
  titleValue: boolean;
  subSteps:   SubStep[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function binaryOperatorSymbol(operator: string, notation: FormulaNotation): string {
  if (notation === 'mathematical') {
    if (operator === 'AND') return '\u2227';   // ∧
    if (operator === 'OR')  return '\u2228';   // ∨
    if (operator === 'XOR') return '\u2295';   // ⊕
  }
  if (notation === 'c') {
    if (operator === 'AND') return '&';
    if (operator === 'OR')  return '|';
    if (operator === 'XOR') return '^';
  }
  return operator.toLowerCase();              // text: 'and' | 'or' | 'xor'
}

/** Returns a plain-text representation of the substituted computation for the
 *  last sub-step of a NOT or binary pane, e.g. "NOT(0)" or "(1 · 0)". */
function computeText(
  node:     FormulaNode,
  valueMap: Map<FormulaNode, boolean>,
  notation: FormulaNotation,
): string {
  if (node.type === 'not') {
    const operandValue = valueMap.get(node.operand) ? 1 : 0;
    if (notation === 'c')    return `!${operandValue}`;
    if (notation === 'text') return `not(${operandValue})`;
    return `NOT(${operandValue})`;
  }
  if (node.type === 'binary') {
    const leftValue  = valueMap.get(node.left)  ? 1 : 0;
    const rightValue = valueMap.get(node.right) ? 1 : 0;
    const symbol = binaryOperatorSymbol(node.operator, notation);
    return `(${leftValue} ${symbol} ${rightValue})`;
  }
  return '';
}

/** Builds one EvaluationPane per step, each describing how that subexpression's
 *  value is derived from its direct operands. */
function buildPanes(
  steps:    EvaluationStep[],
  notation: FormulaNotation,
): EvaluationPane[] {
  // Map each node reference → its evaluated boolean value
  const valueMap = new Map<FormulaNode, boolean>();
  for (const step of steps) valueMap.set(step.node, step.value);

  let paneNumber = 0;
  const panes: EvaluationPane[] = [];

  for (const { node, value } of steps) {
    if (node.type !== 'binary') continue;

    paneNumber++;
    const leftValue  = valueMap.get(node.left)!;
    const rightValue = valueMap.get(node.right)!;
    const subSteps: SubStep[] = [
      { kind: 'operand', node: node.left,  value: leftValue  },
      { kind: 'operand', node: node.right, value: rightValue },
      { kind: 'compute', text: computeText(node, valueMap, notation), value },
    ];
    panes.push({ paneNumber, titleNode: node, titleValue: value, subSteps });
  }

  return panes;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EvaluationSolutionDisplayProps {
  round:    EvaluationRound;
  notation: FormulaNotation;
}

export function EvaluationSolutionDisplay({ round, notation }: EvaluationSolutionDisplayProps) {
  const steps = generateEvaluationSolution(round);
  const panes = buildPanes(steps, notation);

  return (
    <div className="evaluation-solution">
      <h3 className="evaluation-solution-title">Step-by-step solution</h3>
      <div className="evaluation-solution-panes">
        {panes.map(pane => (
          <div
            key={pane.paneNumber}
            className={`evaluation-pane ${pane.titleValue ? 'pane-true' : 'pane-false'}`}
          >
            {/* Header: pane number + the subexpression being evaluated */}
            <div className="evaluation-pane-header">
              <span className="evaluation-pane-number">#{pane.paneNumber}</span>
              <span className="evaluation-pane-title-formula">
                <FormulaDisplay node={pane.titleNode} notation={notation} />
              </span>
            </div>

            {/* Numbered sub-steps */}
            <ol className="evaluation-pane-steps">
              {pane.subSteps.map((subStep, j) => (
                <li
                  key={j}
                  className={`evaluation-pane-step${j === pane.subSteps.length - 1 ? ' step-last' : ''}`}
                >
                  {subStep.kind === 'operand' ? (
                    <>
                      <span className="sub-formula">
                        <FormulaDisplay node={subStep.node} notation={notation} />
                      </span>
                      <span className="sub-step-separator">=</span>
                      <span className={`sub-step-value ${subStep.value ? 'value-true' : 'value-false'}`}>
                        {subStep.value ? '1' : '0'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="sub-text">{subStep.text}</span>
                      <span className="sub-step-separator">=</span>
                      <span className={`sub-step-value ${subStep.value ? 'value-true' : 'value-false'}`}>
                        {subStep.value ? '1' : '0'}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
