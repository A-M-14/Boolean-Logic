import type { Socket } from 'socket.io-client';
import type { Difficulty } from '../computer-player-engine/types.js';

export type BoardMode = 'single' | 'one-on-one' | 'vs-computer' | 'online';

export interface BoardGameSessionProps {
  boardMode:     BoardMode;
  difficulty?:   Difficulty;   // vs-computer only
  socket?:       Socket;       // online only
  playerName?:   string;       // online only
  opponentName?: string;       // online only
  onBack:        () => void;
  onHome?:       () => void;
  onPlayAgain?:  () => void;   // online only: called instead of internal reset
}

/** Messages sent from the client to the server. */
export type BoardClientToServerMessage =
  | { type: 'move'; row: number; col: number; value: BitValue };
