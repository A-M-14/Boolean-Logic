import React from 'react';
import type { Difficulty, TruthTable } from '../simulator-challenge-engine/types.js';
import { VAR_NAMES } from '../simulator-challenge-engine/types.js';
import './ChallengePanel.css';

interface ChallengePanelProps {
  truthTable: TruthTable;
  difficulty: Difficulty;
  onClose:    () => void;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
};

export function ChallengePanel({ truthTable, difficulty, onClose }: ChallengePanelProps) {
  const { varCount, outputs } = truthTable;
  const rowCount = outputs.length; // 2^varCount
  const varNames = VAR_NAMES.slice(0, varCount);

  return (
    <div className="chal-panel__overlay">
      <div className="chal-panel" onClick={e => e.stopPropagation()}>

        <div className="chal-panel__header">
          <h2 className="chal-panel__title">Challenge Truth Table</h2>
          <span className={`chal-panel__badge chal-panel__badge--${difficulty}`}>
            {DIFFICULTY_LABEL[difficulty]}
          </span>
          <button className="chal-panel__close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="chal-panel__body">
          <table className="chal-panel__table">
            <thead>
              <tr>
                {varNames.map(v => <th key={v}>{v}</th>)}
                <th className="chal-panel__out-header">Output</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }, (_, i) => {
                const out = outputs[i];
                return (
                  <tr key={i} className={out ? 'chal-panel__row--one' : 'chal-panel__row--zero'}>
                    {varNames.map((_, j) => (
                      <td key={j}>{(i >> (varCount - 1 - j)) & 1}</td>
                    ))}
                    <td className={`chal-panel__out-cell chal-panel__out-cell--${out ? 'one' : 'zero'}`}>
                      {out ? '1' : '0'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
