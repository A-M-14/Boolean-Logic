import React from 'react';
import type { VerificationResult } from '../simulator-challenge-engine/types.js';
import { VAR_NAMES } from '../simulator-challenge-engine/types.js';
import './SubmissionResult.css';

interface SubmissionResultProps {
  result:             VerificationResult;
  referenceGateCount: number;
  varCount:           number;
  onClose:            () => void;
}

const FAILURE_LIMIT = 8;

export function SubmissionResult({
  result,
  referenceGateCount,
  varCount,
  onClose,
}: SubmissionResultProps) {
  const { correct, gateCount, failures } = result;
  const varNames  = VAR_NAMES.slice(0, varCount);
  const isOptimal = correct && gateCount === referenceGateCount;

  return (
    <div className="sub-result__overlay">
      <div
        className={`sub-result sub-result--${correct ? 'correct' : 'incorrect'}`}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="sub-result__header">
          <span className="sub-result__icon">{correct ? '✓' : '✗'}</span>
          <h2 className="sub-result__status">{correct ? 'Correct!' : 'Incorrect'}</h2>
          <button className="sub-result__close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* ── Incorrect sub-message ── */}
        {!correct && (
          <p className="sub-result__incorrect-msg">The circuit does not implement the truth table.</p>
        )}

        {/* ── Gate-count stats ── */}
        <div className="sub-result__stats">
          <div className="sub-result__stat">
            <span className="sub-result__stat-label">Your gate count</span>
            <span className="sub-result__stat-value">{gateCount}</span>
          </div>
          <span className="sub-result__stat-sep">vs.</span>
          <div className="sub-result__stat">
            <span className="sub-result__stat-label">Reference minimum</span>
            <span className="sub-result__stat-value">{referenceGateCount}</span>
          </div>
        </div>

        {/* ── Optimal banner ── */}
        {isOptimal && (
          <div className="sub-result__optimal">Optimal solution!</div>
        )}

        {/* ── Failing inputs table ── */}
        {!correct && failures.length > 0 && (
          <div className="sub-result__failures">
            <h3 className="sub-result__failures-title">
              Failing inputs ({failures.length}):
            </h3>
            <table className="sub-result__failures-table">
              <thead>
                <tr>
                  {varNames.map(v => <th key={v}>{v}</th>)}
                  <th>Expected</th>
                  <th>Got</th>
                </tr>
              </thead>
              <tbody>
                {failures.slice(0, FAILURE_LIMIT).map((f, i) => (
                  <tr key={i}>
                    {f.inputs.map((bit, j) => <td key={j}>{bit ? '1' : '0'}</td>)}
                    <td className="sub-result__expected">{f.expected ? '1' : '0'}</td>
                    <td className="sub-result__actual">
                      {f.actual === undefined ? '?' : f.actual ? '1' : '0'}
                    </td>
                  </tr>
                ))}
                {failures.length > FAILURE_LIMIT && (
                  <tr>
                    <td colSpan={varCount + 2} className="sub-result__more">
                      …and {failures.length - FAILURE_LIMIT} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
