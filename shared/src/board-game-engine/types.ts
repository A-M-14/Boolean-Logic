import type { GateType } from '../logic-gate-handler';

export type { GateType };

export type BitValue = 0 | 1;
export type Player = 'red' | 'blue';
export type GameMode = 'two-player' | 'solo';

export interface BitCell {
  type: 'bit';
  value: BitValue | null;
  placedBy: Player | null;
}

export interface GateCell {
  type: 'gate';
  gate: GateType;
}

export type Cell = BitCell | GateCell;

export interface PlayerScores {
  red: number;
  blue: number;
}

export interface BoardState {
  /** 7×7 grid: cells[row][col]. Gate cells at (r+c)%2===1, bit cells at (r+c)%2===0. */
  cells: Cell[][];
  scores: PlayerScores;
  /** In two-player mode, alternates each turn. In solo mode, always 'red'. */
  currentPlayer: Player;
  gameMode: GameMode;
  isComplete: boolean;
}

export interface PlayerMove {
  row: number;
  col: number;
  value: BitValue;
}

export interface MoveResult {
  newState: BoardState;
  /** Score change caused by this move. */
  scoreDelta: PlayerScores;
}

export interface OptimalSolveResult {
  /** Maximum achievable score on this board configuration. */
  optimalScore: number;
  /**
   * Optimal bit placement: 7×7 grid mirroring the board layout.
   * Bit cell positions contain their optimal value (0 or 1); gate cell positions are null.
   */
  solution: (BitValue | null)[][];
}
