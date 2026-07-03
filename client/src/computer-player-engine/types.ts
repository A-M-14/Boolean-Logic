/**
 * Difficulty levels available for the computer player.
 * Controls search depth and heuristic weights via the Difficulty Controller.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Weights used by the Heuristic Evaluator to score non-terminal board states.
 */
export interface HeuristicWeights {
  /** Multiplier applied to the current score differential (computerScore − humanScore). */
  scoreDifferential: number;
  /**
   * Multiplier applied to the estimated potential score from partially filled gate directions
   * (directions where exactly one of the two adjacent bit cells has been placed).
   */
  potentialScore: number;
}

/**
 * Full configuration that parameterizes the Search Best Move component.
 * Produced by the Difficulty Controller from a Difficulty level.
 */
export interface SearchConfig {
  /** Maximum ply depth the Minimax search will explore. */
  depth: number;
  /** Whether Alpha–Beta pruning is applied during the search. */
  useAlphaBeta: boolean;
  /** Weights forwarded to the Heuristic Evaluator at leaf nodes. */
  heuristicWeights: HeuristicWeights;
}
