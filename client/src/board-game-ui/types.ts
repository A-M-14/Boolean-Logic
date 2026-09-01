import type { BoardState, BitValue, Player } from '@boolean-logic/shared';
import type { Difficulty } from '../computer-player-engine/types.js';

export type BoardMode = 'single' | 'one-on-one' | 'vs-computer' | 'online';

export interface BoardGameSessionProps {
  boardMode:     BoardMode;
  difficulty?:   Difficulty;   // vs-computer only
  socket?:       WebSocket;    // online only
  playerName?:   string;       // online only
  opponentName?: string;       // online only
  onBack:        () => void;
  onHome?:       () => void;
}

// ─── WebSocket protocol ───────────────────────────────────────────────────────
// NOTE: These message shapes must be mirrored exactly by the server implementation.

/** Messages sent from the server to the client. */
export type BoardServerToClientMessage =
  /** Sent once when the match begins. Tells this client which player color it is
   *  and delivers the initial board (gate layout chosen by the server). */
  | { type: 'game_start';    yourPlayer: Player; state: BoardState }
  /** Sent after every move (including the opponent's). The client replaces its
   *  local board state with the authoritative state from the server. */
  | { type: 'state_update';  state: BoardState }
  /** Sent when the board is fully filled and the game is over. */
  | { type: 'game_end';      finalState: BoardState };

/** Messages sent from the client to the server. */
export type BoardClientToServerMessage =
  | { type: 'move'; row: number; col: number; value: BitValue };
