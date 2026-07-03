/**
 * Computer Player Engine
 *
 * Provides deterministic decision-making for the player-versus-computer mode of the board game.
 * Uses Minimax with optional Alpha–Beta pruning and configurable heuristics.
 *
 * Primary entry point for the Board Game UI:
 *   `selectComputerMove(state, difficulty, computerPlayer)`
 *
 * Components exported:
 *   - Move Generator    → generateMoves
 *   - Heuristic Evaluator → evaluateState
 *   - Search Best Move  → searchBestMove
 *   - Difficulty Controller → getSearchConfig, selectComputerMove
 */

export { generateMoves } from './moveGenerator';
export { evaluateState } from './heuristicEvaluator';
export { searchBestMove } from './searchBestMove';
export { getSearchConfig, selectComputerMove } from './difficultyController';
export type { Difficulty, HeuristicWeights, SearchConfig } from './types';
