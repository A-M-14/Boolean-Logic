/**
 * types.ts — Shared type definitions for all server components.
 *
 * Defines the full Socket.IO event contract between server and clients,
 * plus internal structures used by the manager classes.
 */

import type { Socket, Server } from 'socket.io';
import type {
  BoardState,
  BitValue,
  Player,
  Difficulty,
  FormulaNode,
  VariableAssignment,
  EquivalenceProofStep,
} from '@boolean-logic/shared';

// ─── Domain types ─────────────────────────────────────────────────────────────

/** Game type discriminator used in matchmaking and room creation. */
export type GameType = 'board' | 'evaluation' | 'equivalence';

// ─── Socket.IO event payloads ────────────────────────────────────────────────

/**
 * Payload for the formula:round event.
 * Discriminated by gameType so clients can handle evaluation and
 * equivalence rounds with a single event listener.
 */
export type FormulaRoundPayload =
  | {
      /** Evaluation round: a formula + variable assignment to evaluate. */
      gameType:   'evaluation';
      roundIndex: number;
      formula:    FormulaNode;
      assignment: VariableAssignment;
    }
  | {
      /** Equivalence round: two formulas to compare for logical equivalence. */
      gameType:   'equivalence';
      roundIndex: number;
      formulaA:   FormulaNode;
      formulaB:   FormulaNode;
      /** Algebraic proof chain — present when the two formulas are equivalent. */
      proof?:     readonly EquivalenceProofStep[];
    };

// ─── Socket.IO typed event maps ──────────────────────────────────────────────

/** Events emitted by the server and received by clients. */
export interface ServerToClientEvents {
  /** Emitted when a player enters the queue and no opponent is available yet. */
  'matchmaking:waiting': () => void;

  /** Emitted to both players when a match is found. Precedes any game events. */
  'matchmaking:matched': (data: { roomId: string; opponentNickname: string }) => void;

  /**
   * Board game — emitted once per player at game start.
   * Delivers the player's assigned color and the initial board state
   * (gates randomised server-side).
   */
  'board:game_start': (data: { yourPlayer: Player; state: BoardState }) => void;

  /**
   * Board game — emitted after every valid move, to both players.
   * Clients should replace their local board state with this authoritative copy.
   */
  'board:state_update': (data: { state: BoardState }) => void;

  /**
   * Board game — emitted to both players when the board is fully filled.
   * Contains the final authoritative board state.
   */
  'board:game_end': (data: { finalState: BoardState }) => void;

  /**
   * Formula game — emitted to both players at the start of each round.
   * Discriminated by gameType; see FormulaRoundPayload.
   */
  'formula:round': (data: FormulaRoundPayload) => void;

  /**
   * Formula game — emitted to each player individually after both players
   * have submitted (or the server-side round timer expires).
   * yourScore is the player's cumulative session score after this round.
   */
  'formula:round_result': (data: { correct: boolean; yourScore: number }) => void;

  /**
   * Formula game — emitted to a player whenever the opponent's score changes.
   * score is the opponent's updated cumulative session score.
   */
  'formula:opponent_score': (data: { score: number }) => void;

  /**
   * Formula game — emitted to both players when all rounds in the session
   * are complete. Contains each player's final scores.
   */
  'formula:session_end': (data: {
    yourFinalScore:     number;
    opponentFinalScore: number;
  }) => void;

  /** Generic server-side error notification. */
  'error': (data: { message: string }) => void;

  /** Emitted to the surviving player when their opponent disconnects or leaves. */
  'opponent:disconnected': (data: { message: string }) => void;
}

/** Events emitted by clients and received by the server. */
export interface ClientToServerEvents {
  /**
   * Join the matchmaking queue for a specific game type and difficulty.
   * The server emits 'matchmaking:waiting' if no opponent is available yet,
   * or 'matchmaking:matched' + the appropriate game-start event if paired.
   */
  'matchmaking:join': (data: {
    gameType:    GameType;
    difficulty?: Difficulty;  // required for evaluation / equivalence
    nickname?:   string;
  }) => void;

  /** Leave the matchmaking queue without joining a game. */
  'matchmaking:leave': () => void;

  /**
   * Board game — submit a bit placement.
   * The server validates the move, applies it, and broadcasts the updated state.
   */
  'board:move': (data: { row: number; col: number; value: BitValue }) => void;

  /**
   * Formula Evaluation game — submit an answer for the current round.
   * result is the player's determination of the formula's boolean output given
   * the variable assignment shown in the round (true = evaluates to 1,
   * false = evaluates to 0). elapsedSeconds is the client-measured time from
   * round start to submission, used server-side for score calculation.
   * Only valid when the player is in an evaluation-mode room.
   */
  'formula:evaluation_answer': (data: {
    result:         boolean;
    elapsedSeconds: number;
  }) => void;

  /**
   * Formula Equivalence game — submit an answer for the current round.
   * areEquivalent is the player's judgment on whether the two displayed
   * formulas are logically equivalent. elapsedSeconds is used server-side
   * for score calculation.
   * Only valid when the player is in an equivalence-mode room.
   */
  'formula:equivalence_answer': (data: {
    areEquivalent:  boolean;
    elapsedSeconds: number;
  }) => void;

  /**
   * Board game — emitted by the client once it has mounted and registered
   * all board:game_start / board:state_update / board:game_end listeners.
   * The server sends board:game_start only after both players have signalled
   * ready, preventing the race condition where the event arrives before
   * listeners are registered.
   */
  'board:ready': () => void;

  /**
   * Formula game — emitted by the client once it has mounted and registered
   * all formula:round / formula:round_result listeners. The server starts the
   * first round only after both players have signalled ready, preventing the
   * race condition where formula:round arrives before listeners are registered.
   */
  'formula:ready': () => void;
}

/** Placeholder for future cross-server communication (unused currently). */
export interface InterServerEvents {}

/** Per-socket data stored by Socket.IO and available throughout its lifecycle. */
export interface SocketData {
  /** Stable UUID assigned by the server on first connection. */
  sessionId: string;
}

// ─── Convenience aliases ──────────────────────────────────────────────────────

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
