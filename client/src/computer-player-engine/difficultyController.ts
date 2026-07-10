import type { BoardState, Player, PlayerMove } from '@boolean-logic/shared';
import { searchBestMove } from './searchBestMove';
import type { Difficulty, SearchConfig } from './types';

// ---------------------------------------------------------------------------
// Difficulty configurations
// ---------------------------------------------------------------------------

/**
 * Search configurations for each difficulty level.
 *
 * Easy   — Shallow depth (1 ply), no Alpha–Beta pruning, score-differential-only heuristic.
 *           Produces proportionally weaker play: the computer looks only one move ahead
 *           and ignores positional potential.
 *
 * Medium — Moderate depth (3 plies), Alpha–Beta pruning enabled, modest potential-score weight.
 *           Balanced between speed and strategic awareness.
 *
 * Hard   — Deeper search (6 plies), Alpha–Beta pruning with move ordering, full potential-score
 *           weight.  Produces the strongest computer play.
 */
const SEARCH_CONFIGS: Record<Difficulty, SearchConfig> = {
  easy: {
    depth: 1,
    useAlphaBeta: false,
    heuristicWeights: {
      scoreDifferential: 1,
      potentialScore: 0,
    },
  },
  medium: {
    depth: 3,
    useAlphaBeta: true,
    heuristicWeights: {
      scoreDifferential: 1,
      potentialScore: 0.3,
    },
  },
  hard: {
    depth: 6,
    useAlphaBeta: true,
    heuristicWeights: {
      scoreDifferential: 1,
      potentialScore: 0.6,
    },
  },
};

// ---------------------------------------------------------------------------
// Difficulty Controller public API
// ---------------------------------------------------------------------------

/**
 * Difficulty Controller component.
 *
 * Returns the `SearchConfig` that parameterizes the Search Best Move component for the
 * given difficulty level.
 *
 * @param difficulty - The difficulty level chosen by the player.
 * @returns The corresponding SearchConfig (depth, Alpha–Beta flag, heuristic weights).
 */
export function getSearchConfig(difficulty: Difficulty): SearchConfig {
  return SEARCH_CONFIGS[difficulty];
}

/**
 * Selects the best move for the computer at the requested difficulty level.
 *
 * This is the primary entry point used by the Board Game UI when the computer must act.
 * It delegates to `getSearchConfig` for parameterization and to `searchBestMove` for the
 * actual Minimax search.
 *
 * @param state           - The current board state (must be the computer player's turn).
 * @param difficulty      - The difficulty level selected by the player.
 * @param computerPlayer  - The player color assigned to the computer ('red' or 'blue').
 * @returns The move the computer has chosen to make.
 */
export function selectComputerMove(
  state: BoardState,
  difficulty: Difficulty,
  computerPlayer: Player,
): PlayerMove {
  const config = getSearchConfig(difficulty);
  return searchBestMove(state, computerPlayer, config);
}
