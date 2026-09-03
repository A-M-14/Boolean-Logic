import type { Player } from '@boolean-logic/shared';
import type { BoardMode } from './types.js';
import './TurnIndicator.css';

interface TurnIndicatorProps {
  currentPlayer:  Player;
  boardMode:      BoardMode;
  isComputerTurn: boolean;
  localPlayer?:   Player;    // online only
  playerName?:    string;    // online only
  opponentName?:  string;    // online only
}

export function TurnIndicator({
  currentPlayer,
  boardMode,
  isComputerTurn,
  localPlayer,
  playerName   = 'You',
  opponentName = 'Opponent',
}: TurnIndicatorProps) {
  let label: string;

  if (boardMode === 'single') {
    label = 'Your turn';
  } else if (boardMode === 'vs-computer') {
    label = isComputerTurn ? 'Computer is thinking\u2026' : 'Your turn';
  } else if (boardMode === 'online') {
    label = currentPlayer === localPlayer ? 'Your turn' : `${opponentName}\u2019s turn`;
  } else {
    // one-on-one (local)
    label = currentPlayer === 'red' ? "Red\u2019s turn" : "Blue\u2019s turn";
  }

  return (
    <div className={`turn-indicator turn-indicator--${currentPlayer}${isComputerTurn ? ' turn-indicator--computer' : ''}`}>
      <span className="turn-indicator__dot" />
      <span className="turn-indicator__label">{label}</span>
    </div>
  );
}
