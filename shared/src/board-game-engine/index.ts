export { initializeBoard, isGatePosition, isBitPosition, BOARD_SIZE, BOARD_GATE_TYPES } from './boardInitializer';
export { validateMove } from './moveValidator';
export { computeFullScore } from './scoreCalculator';
export { applyMove } from './gameStateManager';
export { computeOptimalSolution } from './optimalBoardSolver';
export type {
  BitValue,
  Player,
  GameMode,
  BitCell,
  GateCell,
  Cell,
  PlayerScores,
  BoardState,
  PlayerMove,
  MoveResult,
  OptimalSolveResult,
} from './types';
export type { ValidationResult } from './moveValidator';
