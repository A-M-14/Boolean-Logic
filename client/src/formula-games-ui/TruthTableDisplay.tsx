import React from 'react';
import type { Formula } from '@boolean-logic/shared';
import { evaluateFormula } from '@boolean-logic/shared';
import './TruthTableDisplay.css';

interface TruthTableDisplayProps {
  formula: Formula;
  label?:  string;
}

export function TruthTableDisplay({ formula, label }: TruthTableDisplayProps) {
  const vars = [...formula.variables].sort();
  const n    = vars.length;

  const rows = Array.from({ length: 1 << n }, (_, mask) => {
    const assignment: Record<string, boolean> = {};
    for (let i = 0; i < n; i++) {
      // Conventional ordering: leftmost variable changes slowest.
      assignment[vars[i]] = Boolean((mask >> (n - 1 - i)) & 1);
    }
    return { assignment, result: evaluateFormula(formula.root, assignment) };
  });

  return (
    <div className="truth-table-wrapper">
      {label && <div className="truth-table-heading">Formula {label}</div>}
      <table className="truth-table">
        <thead>
          <tr>
            {vars.map(v => <th key={v}>{v}</th>)}
            <th className="truth-table-result-header">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {vars.map(v => (
                <td key={v}>{row.assignment[v] ? '1' : '0'}</td>
              ))}
              <td className={`truth-table-result ${row.result ? 'result-true' : 'result-false'}`}>
                {row.result ? '1' : '0'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
