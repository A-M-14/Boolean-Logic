import React, { useState } from 'react';
import type { EvaluationRound, EquivalenceRound } from '@boolean-logic/shared';
import { FormulaDisplay }              from './FormulaDisplay.js';
import { VariableAssignmentDisplay }   from './VariableAssignmentDisplay.js';
import { DraftPane }                   from './DraftPane.js';
import { NotationSelector }            from './NotationSelector.js';
import { NotationLegend }              from './NotationLegend.js';
import { EvaluationSolutionDisplay }   from './EvaluationSolutionDisplay.js';
import { EquivalenceProofDisplay }     from './EquivalenceProofDisplay.js';
import { TruthTableDisplay }           from './TruthTableDisplay.js';
import type { RoundRecord, FormulaNotation } from './types.js';
import './RoundReview.css';

const HouseIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1,8 8,2 15,8" />
    <polyline points="4,8 4,14 12,14 12,8" />
    <polyline points="6.5,14 6.5,10.5 9.5,10.5 9.5,14" />
  </svg>
);

interface RoundReviewProps {
  record:        RoundRecord;
  roundNumber:   number;
  onBack:        () => void;
  onBackToMenu?: () => void;
  onHome?:       () => void;
}

type ActivePanel = 'solution' | 'truthTable' | 'truthTables' | null;

export function RoundReview({ record, roundNumber, onBack, onBackToMenu, onHome }: RoundReviewProps) {
  const [notation,     setNotation]    = useState<FormulaNotation>('mathematical');
  const [activePanel,  setActivePanel] = useState<ActivePanel>(null);

  function togglePanel(panel: Exclude<ActivePanel, null>) {
    setActivePanel(current => current === panel ? null : panel);
  }

  const isEvaluation = record.gameType === 'evaluation';

  return (
    <div className="round-review-container">

      {/* Notation controls + navigation buttons */}
      <div className="round-review-notation-bar">
        <div className="notation-bar-side notation-bar-left">
          {onBackToMenu !== undefined && (
            <button className="game-back-btn" onClick={onBackToMenu}>← Back to Menu</button>
          )}
          {onHome !== undefined && (
            <button className="home-btn" onClick={onHome}><HouseIcon /> Home</button>
          )}
        </div>
        <div className="notation-bar-center">
          <NotationSelector notation={notation} onChange={setNotation} />
          <NotationLegend />
        </div>
        <div className="notation-bar-side notation-bar-right">
          <button className="round-review-back-button" onClick={onBack}>
            ← Back to Summary
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="round-review-header">
        <span className="round-review-title">
          Round {roundNumber} — Practice
        </span>
        <span className={`round-review-badge ${record.correct ? 'badge-correct' : 'badge-wrong'}`}>
          {record.correct ? `✓ +${record.points} pts` : '✗ Incorrect'}
        </span>
      </div>

      {/* Formula area (same layout as gameplay, no answer filled in) */}
      <div className="round-review-formula-area">
        {isEvaluation ? (
          <>
            <div className="round-review-evaluation-row">
              <FormulaDisplay
                node={(record.round as EvaluationRound).formula.root}
                notation={notation}
              />
              <span className="round-review-equals-sign">=</span>
              <span className="round-review-blank">?</span>
            </div>
            <VariableAssignmentDisplay
              assignment={(record.round as EvaluationRound).assignment}
            />
          </>
        ) : (
          <>
            <FormulaDisplay
              node={(record.round as EquivalenceRound).formulaA.root}
              label="A"
              notation={notation}
            />
            <FormulaDisplay
              node={(record.round as EquivalenceRound).formulaB.root}
              label="B"
              notation={notation}
            />
          </>
        )}
      </div>

      {/* Draft board (empty — same as start of a real round) */}
      <DraftPane />

      {/* Solution / Truth Table area */}
      <div className="round-review-solution-area">

        <div className="round-review-action-buttons">
          <button
            className={`round-review-solution-button ${activePanel === 'solution' ? 'active' : ''}`}
            onClick={() => togglePanel('solution')}
          >
            {activePanel === 'solution' ? 'Hide Solution' : 'Show Solution'}
          </button>

          {isEvaluation && (
            <button
              className={`round-review-truth-table-button ${activePanel === 'truthTable' ? 'active' : ''}`}
              onClick={() => togglePanel('truthTable')}
            >
              {activePanel === 'truthTable' ? 'Hide Formula Truth Table' : 'Show Formula Truth Table'}
            </button>
          )}

          {!isEvaluation && (
            <button
              className={`round-review-truth-table-button ${activePanel === 'truthTables' ? 'active' : ''}`}
              onClick={() => togglePanel('truthTables')}
            >
              {activePanel === 'truthTables' ? "Hide Formulas' Truth Tables" : "Show Formulas' Truth Tables"}
            </button>
          )}
        </div>

        {activePanel === 'solution' && isEvaluation && (
          <EvaluationSolutionDisplay
            round={record.round as EvaluationRound}
            notation={notation}
          />
        )}
        {activePanel === 'solution' && !isEvaluation && (
          <EquivalenceProofDisplay
            round={record.round as EquivalenceRound}
            notation={notation}
          />
        )}

        {isEvaluation && activePanel === 'truthTable' && (
          <TruthTableDisplay
            formula={(record.round as EvaluationRound).formula}
          />
        )}

        {!isEvaluation && activePanel === 'truthTables' && (() => {
          const round = record.round as EquivalenceRound;
          if (round.areEquivalent) {
            return (
              <TruthTableDisplay
                formula={round.formulaA}
                heading="Formulas A and B"
              />
            );
          }
          return (
            <div className="round-review-truth-tables-row">
              <TruthTableDisplay formula={round.formulaA} label="A" />
              <TruthTableDisplay formula={round.formulaB} label="B" />
            </div>
          );
        })()}

      </div>

    </div>
  );
}
