import React from 'react';
import type { Difficulty, TruthTable } from '../simulator-challenge-engine/types.js';
import { VAR_NAMES } from '../simulator-challenge-engine/types.js';
import './ChallengeSidebar.css';

interface ChallengeSidebarProps {
  truthTable: TruthTable;
  difficulty: Difficulty;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
};

export function ChallengeSidebar({ truthTable, difficulty }: ChallengeSidebarProps) {
  const { varCount, outputs } = truthTable;
  const rowCount = outputs.length;
  const varNames = VAR_NAMES.slice(0, varCount);

  return (
    <div className="chal-sidebar">
      <div className="chal-sidebar__header">
        <span className="chal-sidebar__title">Truth Table</span>
        <span className={`chal-sidebar__badge chal-sidebar__badge--${difficulty}`}>
          {DIFFICULTY_LABEL[difficulty]}
        </span>
      </div>
      <div className="chal-sidebar__body">
        <table className="chal-sidebar__table">
          <thead>
            <tr>
              {varNames.map(v => <th key={v}>{v}</th>)}
              <th className="chal-sidebar__out-header">Out</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, i) => {
              const out = outputs[i];
              return (
                <tr key={i}>
                  {varNames.map((_, j) => (
                    <td key={j}>{(i >> (varCount - 1 - j)) & 1}</td>
                  ))}
                  <td className={`chal-sidebar__out-cell chal-sidebar__out-cell--${out ? 'one' : 'zero'}`}>
                    {out ? '1' : '0'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
