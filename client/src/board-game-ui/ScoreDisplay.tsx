import type { PlayerScores, GameMode } from '@boolean-logic/shared';
import './ScoreDisplay.css';

interface ScoreDisplayProps {
  scores:        PlayerScores;
  gameMode:      GameMode;
  optimalScore?: number;
  redLabel?:     string;
  blueLabel?:    string;
}

export function ScoreDisplay({ scores, gameMode, optimalScore, redLabel = 'Red', blueLabel = 'Blue' }: ScoreDisplayProps) {
  if (gameMode === 'solo') {
    const gap = optimalScore !== undefined ? optimalScore - scores.red : null;
    return (
      <div className="score-display score-display--solo">
        <div className="score-display__stat">
          <span className="score-display__stat-label">Your Score:</span>
          <span className="score-display__stat-value score-display__stat-value--red">{scores.red}</span>
        </div>
        <div className="score-display__stat-divider" />
        <div className="score-display__stat">
          <span className="score-display__stat-label">Max Score:</span>
          <span className="score-display__stat-value">
            {optimalScore !== undefined ? optimalScore : ''}
          </span>
        </div>
        <div className="score-display__stat-divider" />
        <div className="score-display__stat">
          <span className="score-display__stat-label">Gap:</span>
          <span className="score-display__stat-value">
            {gap !== null ? (gap === 0 ? '0' : `−${gap}`) : ''}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="score-display">
      <div className="score-display__side score-display__side--blue">
        <span className="score-display__player-label">{blueLabel}</span>
        <span className="score-display__value">{scores.blue}</span>
      </div>
      <div className="score-display__divider">vs</div>
      <div className="score-display__side score-display__side--red">
        <span className="score-display__value">{scores.red}</span>
        <span className="score-display__player-label">{redLabel}</span>
      </div>
    </div>
  );
}
