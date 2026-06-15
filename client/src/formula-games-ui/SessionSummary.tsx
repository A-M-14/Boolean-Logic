import React from 'react';
import type { RoundRecord } from './types.js';
import './SessionSummary.css';

type SessionSummaryProps =
  | {
      mode:            'solo';
      finalScore:      number;
      roundHistory:    RoundRecord[];
      onPlayAgain:     () => void;
      onMenu:          () => void;
      onReviewRound?:  (index: number) => void;
      onBackToMenu?:   () => void;
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
        <p className="summary-review-hint">Click on a round row to review it.</p>
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
        {props.onBackToMenu !== undefined && (
          <div className="summary-top-bar">
            <button className="game-back-btn" onClick={props.onBackToMenu}>← Back to Menu</button>
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
      {props.onBackToMenu !== undefined && (
        <div className="summary-top-bar">
          <button className="game-back-btn" onClick={props.onBackToMenu}>← Back to Menu</button>
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
