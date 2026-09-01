import React from 'react';
import type { RoundRecord } from './types.js';
import './SessionSummary.css';

const HouseIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1,8 8,2 15,8" />
    <polyline points="4,8 4,14 12,14 12,8" />
    <polyline points="6.5,14 6.5,10.5 9.5,10.5 9.5,14" />
  </svg>
);

type SessionSummaryProps =
  | {
      mode:            'solo';
      finalScore:      number;
      roundHistory:    RoundRecord[];
      onPlayAgain:     () => void;
      onMenu:          () => void;
      onReviewRound?:  (index: number) => void;
      onBackToMenu?:   () => void;
      onHome?:         () => void;
    }
  | {
      mode:            'online';
      finalScore:      number;
      opponentScore:   number;
      playerName:      string;
      opponentName:    string;
      roundHistory:    RoundRecord[];
      onMenu:          () => void;
      onReviewRound?:  (index: number) => void;
      onBackToMenu?:   () => void;
      onHome?:         () => void;
    };

function formatAnswer(record: RoundRecord): string {
  if (record.playerAnswer === null) return '—';
  if (record.gameType === 'evaluation') return record.playerAnswer ? '1' : '0';
  return record.playerAnswer ? 'Equal' : 'Not equal';
}

function RoundsTable({
  rounds,
  onReviewRound,
}: {
  rounds:         RoundRecord[];
  onReviewRound?: (index: number) => void;
}) {
  return (
    <div className="summary-table-wrapper">
      {onReviewRound !== undefined && (
        <p className="summary-review-hint">Click on a round row to view the round and the solution.</p>
      )}
      <table className="summary-rounds-table">
      <thead>
        <tr>
          <th>Round</th>
          <th>Time</th>
          <th>Answer</th>
          <th>Points</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {rounds.map((record, i) => (
          <tr
            key={i}
            className={`${record.correct ? 'row-correct' : 'row-incorrect'}${onReviewRound !== undefined ? ' row-clickable' : ''}`}
            onClick={onReviewRound !== undefined ? () => onReviewRound(i) : undefined}
            title={onReviewRound !== undefined ? 'Click to review this round' : undefined}
          >
            <td>{i + 1}</td>
            <td>{Math.round(record.elapsed)}s</td>
            <td>{formatAnswer(record)}</td>
            <td>{record.points}</td>
            <td>{record.correct ? '✓' : '✗'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export function SessionSummary(props: SessionSummaryProps) {
  if (props.mode === 'solo') {
    return (
      <div className="session-summary">
        {(props.onBackToMenu !== undefined || props.onHome !== undefined) && (
          <div className="summary-top-bar">
            {props.onBackToMenu !== undefined && (
              <button className="game-back-btn" onClick={props.onBackToMenu}>← Back to Menu</button>
            )}
            {props.onHome !== undefined && (
              <button className="home-btn" onClick={props.onHome}><HouseIcon /> Home</button>
            )}
          </div>
        )}
        <h2 className="summary-title">Session Complete</h2>
        <div className="summary-score-block">
          <span className="summary-score-label">Final Score</span>
          <span className="summary-score-value">{props.finalScore}</span>
        </div>
        <RoundsTable rounds={props.roundHistory} onReviewRound={props.onReviewRound} />
        <div className="summary-actions">
          <button className="summary-button primary" onClick={props.onPlayAgain}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  const playerWon = props.finalScore > props.opponentScore;
  const draw      = props.finalScore === props.opponentScore;

  return (
    <div className="session-summary">
      {(props.onBackToMenu !== undefined || props.onHome !== undefined) && (
        <div className="summary-top-bar">
          {props.onBackToMenu !== undefined && (
            <button className="game-back-btn" onClick={props.onBackToMenu}>← Back to Menu</button>
          )}
          {props.onHome !== undefined && (
            <button className="home-btn" onClick={props.onHome}><HouseIcon /> Home</button>
          )}
        </div>
      )}
      <h2 className="summary-title">
        {draw ? 'Draw!' : playerWon ? 'You Win!' : 'You Lose!'}
      </h2>
      <div className="summary-scores-row">
        <div className={`summary-player${playerWon ? ' winner' : ''}`}>
          <span className="summary-player-name">{props.playerName}</span>
          <span className="summary-player-score">{props.finalScore}</span>
        </div>
        <span className="summary-vs">vs</span>
        <div className={`summary-player${!playerWon && !draw ? ' winner' : ''}`}>
          <span className="summary-player-name">{props.opponentName}</span>
          <span className="summary-player-score">{props.opponentScore}</span>
        </div>
      </div>
      <RoundsTable rounds={props.roundHistory} onReviewRound={props.onReviewRound} />
      <div className="summary-actions">
        <button className="summary-button secondary" onClick={props.onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}
