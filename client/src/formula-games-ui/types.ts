import type {
  FormulaNode,
  VariableAssignment,
  Difficulty,
  EvaluationRound,
  EquivalenceRound,
} from '@boolean-logic/shared';

export type GameType       = 'evaluation' | 'equivalence';
export type SessionPhase   = 'playing' | 'result' | 'ended';
export type FormulaNotation = 'mathematical' | 'text' | 'c';

export interface FormulaGameSessionProps {
  gameType:       GameType;
  mode:           'solo' | 'online';
  difficulty:     Difficulty;
  onSessionEnd:   (finalScore: number) => void;
  /** Called when the player clicks "Play Again" in the end screen. Optional —
   *  if omitted the session restarts internally without notifying the parent. */
  onPlayAgain?:   () => void;
  /** Called when the player clicks "Back to Menu" — navigates to the last
   *  menu screen before the game (e.g. difficulty selection). */
  onBackToMenu?:  () => void;
  playerName:     string;
  // Online-only
  socket?:        WebSocket;
  opponentName?:  string;
}

export interface RoundResultInfo {
  correct: boolean;
  points:  number;
}

export interface RoundRecord {
  elapsed:      number;
  correct:      boolean;
  points:       number;
  round:        EvaluationRound | EquivalenceRound;
  playerAnswer: boolean | null;
  gameType:     GameType;
}

// ─── WebSocket protocol ───────────────────────────────────────────────────────
// NOTE: These message shapes must be mirrored exactly by the server implementation.

/** Messages sent from the server to the client. */
export type ServerToClientMessage =
  | {
      type:       'round';
      gameType:   'evaluation';
      roundIndex: number;
      formula:    FormulaNode;
      assignment: VariableAssignment;
    }
  | {
      type:       'round';
      gameType:   'equivalence';
      roundIndex: number;
      formulaA:   FormulaNode;
      formulaB:   FormulaNode;
    }
  | { type: 'round_result';  correct: boolean; yourScore: number }
  | { type: 'opponent_score'; score: number }
  | { type: 'session_end';   yourFinalScore: number; opponentFinalScore: number };

/** Messages sent from the client to the server. */
export type ClientToServerMessage =
  | { type: 'answer'; answer: boolean; elapsedSeconds: number };
