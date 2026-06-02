import React from 'react';
import { findCounterexample, evaluateFormula } from '@boolean-logic/shared';
import type { EquivalenceRound, EvaluationRound } from '@boolean-logic/shared';
import { FormulaDisplay }             from './FormulaDisplay.js';
import { VariableAssignmentDisplay }  from './VariableAssignmentDisplay.js';
import { EvaluationSolutionDisplay }  from './EvaluationSolutionDisplay.js';
import type { FormulaNotation } from './types.js';
import './EquivalenceProofDisplay.css';

interface EquivalenceProofDisplayProps {
  round:    EquivalenceRound;
  notation: FormulaNotation;
}

export function EquivalenceProofDisplay({ round, notation }: EquivalenceProofDisplayProps) {

  // ── Not equivalent: show counterexample + both formula evaluations ───────
  if (!round.areEquivalent) {
    const counterexample = findCounterexample(round.formulaA, round.formulaB);

    if (counterexample === null) {
      return (
        <div className="equivalence-proof equivalence-proof--counter">
          <h3 className="equivalence-proof-title">The formulas are NOT equivalent</h3>
        </div>
      );
    }

    const roundA: EvaluationRound = {
      formula:       round.formulaA,
      assignment:    counterexample,
      correctAnswer: evaluateFormula(round.formulaA.root, counterexample),
    };
    const roundB: EvaluationRound = {
      formula:       round.formulaB,
      assignment:    counterexample,
      correctAnswer: evaluateFormula(round.formulaB.root, counterexample),
    };

    return (
      <div className="equivalence-proof equivalence-proof--counter">
        <h3 className="equivalence-proof-title">The formulas are NOT equivalent</h3>
        <p className="equivalence-proof-counter-label">Counterexample assignment:</p>
        <VariableAssignmentDisplay assignment={counterexample} />
        <p className="equivalence-proof-counter-note">
          For this assignment, formula A and formula B evaluate to different values:
        </p>
        <div className="equivalence-proof-evaluations">
          <div className="equivalence-proof-evaluation-block">
            <p className="equivalence-proof-evaluation-label">Formula A</p>
            <EvaluationSolutionDisplay round={roundA} notation={notation} />
          </div>
          <div className="equivalence-proof-evaluation-block">
            <p className="equivalence-proof-evaluation-label">Formula B</p>
            <EvaluationSolutionDisplay round={roundB} notation={notation} />
          </div>
        </div>
      </div>
    );
  }

  // ── Equivalent: show algebraic equality chain ────────────────────────────
  const steps = round.proof ?? [];

  if (steps.length === 0) {
    return (
      <div className="equivalence-proof equivalence-proof--fallback">
        <h3 className="equivalence-proof-title">The formulas are equivalent</h3>
        <p className="equivalence-proof-fallback-note">
          An automatic algebraic derivation could not be found for this pair
          within the search budget. You can verify equivalence by checking the
          truth table for all variable assignments.
        </p>
      </div>
    );
  }

  if (steps.length === 1) {
    return (
      <div className="equivalence-proof equivalence-proof--trivial">
        <h3 className="equivalence-proof-title">The formulas are equivalent</h3>
        <p className="equivalence-proof-trivial-note">
          The two formulas are equal modulo commutativity — the operands appear
          in a different order but the logical structure is identical.
        </p>
      </div>
    );
  }

  return (
    <div className="equivalence-proof">
      <h3 className="equivalence-proof-title">Equivalence proof chain</h3>
      <div className="equivalence-chain">

        {/* First row: anchor label A + formula A */}
        <div className="equivalence-chain-row equivalence-chain-first">
          <span className="chain-anchor">A</span>
          <span className="chain-formula-wrap">
            <FormulaDisplay node={steps[0].formula} notation={notation} />
          </span>
        </div>

        {/* Remaining rows: = formula (rule) — last row also gets anchor label B */}
        {steps.slice(1).map((step, i) => {
          const isLast = i === steps.length - 2;
          return (
            <div key={i} className={`equivalence-chain-row${isLast ? ' equivalence-chain-last' : ''}`}>
              <span className="chain-eq-sign">=</span>
              <span className="chain-formula-wrap">
                <FormulaDisplay node={step.formula} notation={notation} />
              </span>
              <span className="chain-rule-tag">
                {step.ruleName}
                {step.on && (
                  <span className="chain-rule-on">
                    {' on '}
                    <span className="chain-rule-on-formula">
                      <FormulaDisplay node={step.on} notation={notation} />
                    </span>
                  </span>
                )}
              </span>
              {isLast && <span className="chain-anchor chain-anchor-b">B</span>}
            </div>
          );
        })}

      </div>
    </div>
  );
}
