import type { Socket } from 'socket.io-client';
import type {
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
  /** Called when the player clicks "Home" — navigates directly to the main menu. */
  onHome?:        () => void;
  playerName:     string;
  // Online-only
  socket?:        Socket;
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
