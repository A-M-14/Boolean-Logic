import type { PlayerScores, Player } from '@boolean-logic/shared';
import type { BoardMode } from './types.js';
import './GameResultDisplay.css';

interface GameResultDisplayProps {
  scores:       PlayerScores;
  boardMode:    BoardMode;
  localPlayer?: Player;    // online / vs-computer: which color this client controls
  playerName?:  string;
  opponentName?: string;
  onPlayAgain:  () => void;
  onBack:       () => void;
}

export function GameResultDisplay({
  scores,
  boardMode,
  localPlayer  = 'red',
  playerName   = 'You',
  opponentName = 'Opponent',
  onPlayAgain,
  onBack,
}: GameResultDisplayProps) {
  const isOnline      = boardMode === 'online';
  const isVsComputer  = boardMode === 'vs-computer';
  const isSolo        = boardMode === 'single';
  const useNames      = isOnline || isVsComputer;

  // Determine winner from the perspective of this client
  let winnerText: string;
  let winnerClass: string;

  if (isSolo) {
    winnerText  = 'Puzzle complete!';
    winnerClass = 'result--solo';
  } else if (scores.red === scores.blue) {
    winnerText  = "It\u2019s a draw!";
    winnerClass = 'result--draw';
  } else {
    const winningColor: Player = scores.red > scores.blue ? 'red' : 'blue';

    if (useNames) {
      const localWins = winningColor === localPlayer;
      winnerText  = localWins ? `${playerName} wins!` : `${opponentName} wins!`;
    } else {
      winnerText = winningColor === 'red' ? 'Red wins!' : 'Blue wins!';
    }
    winnerClass = `result--${winningColor}`;
  }

  // Labels for the two score columns
  const opponentScoreLabel = isVsComputer ? 'Computer Score' : 'Opponent Score';
  const redLabel  = useNames ? (localPlayer === 'red'  ? 'Your Score' : opponentScoreLabel) : 'Red';
  const blueLabel = useNames ? (localPlayer === 'blue' ? 'Your Score' : opponentScoreLabel) : 'Blue';

  return (
    <div className={`game-result ${winnerClass}`}>
      <h2 className="game-result__title">{winnerText}</h2>

      <div className="game-result__scores">
        <div className="game-result__score-block game-result__score-block--blue">
          <span className="game-result__player">{blueLabel}:</span>
          <span className="game-result__points">{scores.blue}</span>
        </div>
        <div className="game-result__separator">-</div>
        <div className="game-result__score-block game-result__score-block--red">
          <span className="game-result__player">{redLabel}:</span>
          <span className="game-result__points">{scores.red}</span>
        </div>
      </div>

      <div className="game-result__actions">
        {!isOnline && (
          <button className="game-result__btn game-result__btn--primary" onClick={onPlayAgain}>
            Play Again
          </button>
        )}
        <button className="game-result__btn game-result__btn--secondary" onClick={onBack}>
          ← Back to Menu
        </button>
      </div>
    </div>
  );
}
