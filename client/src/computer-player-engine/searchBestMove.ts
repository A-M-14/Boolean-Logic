import { applyMove } from '@boolean-logic/shared';
import type { BoardState, Player, PlayerMove } from '@boolean-logic/shared';
import { generateMoves } from './moveGenerator';
import { evaluateState } from './heuristicEvaluator';
import type { SearchConfig } from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search Best Move component.
 *
 * Explores future game states using Minimax with optional Alpha–Beta pruning and returns
 * the move the computer should make on its current turn.
 *
 * Relies on the Board Game Engine (`applyMove`) to simulate moves and compute the resulting
 * board state and score after each hypothetical placement.  Relies on the Heuristic Evaluator
 * to score non-terminal leaf nodes.
 *
 * @param state           - The current board state (must be the computer player's turn).
 * @param computerPlayer  - The player color assigned to the computer ('red' or 'blue').
 * @param config          - Search configuration produced by the Difficulty Controller.
 * @returns The best move found by the search.
 * @throws If no legal moves are available (i.e. the board is already complete).
 */
export function searchBestMove(
  state: BoardState,
  computerPlayer: Player,
  config: SearchConfig,
): PlayerMove {
  const moves = generateMoves(state);
  if (moves.length === 0) {
    throw new Error('No legal moves available for the computer player');
  }

  const humanPlayer: Player = computerPlayer === 'red' ? 'blue' : 'red';

  // Pre-apply all root moves so that we can (a) sort them for better Alpha–Beta pruning and
  // (b) reuse the resulting states in the main loop without a second applyMove call.
  const candidates = moves.map(move => {
    const { newState, scoreDelta } = applyMove(state, move);
    const quickScore = scoreDelta[computerPlayer] - scoreDelta[humanPlayer];
    return { move, newState, quickScore };
  });

  if (config.useAlphaBeta) {
    // Order best-first for the maximizer to improve Alpha–Beta cutoff frequency.
    candidates.sort((a, b) => b.quickScore - a.quickScore);
  }

  let bestMove = candidates[0].move;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const { move, newState } of candidates) {
    const score = minimax(newState, config.depth - 1, alpha, beta, computerPlayer, config);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (config.useAlphaBeta) {
      alpha = Math.max(alpha, bestScore);
      // beta is +Infinity at root, so no cutoff here; but updating alpha benefits child calls.
    }
  }

  return bestMove;
}

// ---------------------------------------------------------------------------
// Internal Minimax with Alpha–Beta pruning
// ---------------------------------------------------------------------------

/**
 * Recursive Minimax search.
 *
 * The computer player is the maximizer; the human player is the minimizer.
 * The current role is inferred from `state.currentPlayer` at each recursive call.
 *
 * @param state          - The board state at this search node.
 * @param depth          - Remaining depth to expand (0 → evaluate immediately).
 * @param alpha          - Best score the maximizer can guarantee so far.
 * @param beta           - Best score the minimizer can guarantee so far.
 * @param computerPlayer - The player color assigned to the computer.
 * @param config         - Search configuration (alpha-beta flag, heuristic weights).
 * @returns The Minimax value of `state` from the computer's perspective.
 */
function minimax(
  state: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  computerPlayer: Player,
  config: SearchConfig,
): number {
  // Terminal condition: game over or search depth exhausted.
  if (state.isComplete || depth === 0) {
    return evaluateState(state, computerPlayer, config.heuristicWeights);
  }

  const moves = generateMoves(state);
  if (moves.length === 0) {
    return evaluateState(state, computerPlayer, config.heuristicWeights);
  }

  const isMaximizing = state.currentPlayer === computerPlayer;
  const humanPlayer: Player = computerPlayer === 'red' ? 'blue' : 'red';

  if (config.useAlphaBeta) {
    // Pre-apply moves and sort for better Alpha–Beta cutoff frequency.
    const candidates = moves.map(move => {
      const { newState, scoreDelta } = applyMove(state, move);
      const quickScore = scoreDelta[computerPlayer] - scoreDelta[humanPlayer];
      return { newState, quickScore };
    });

    // Maximizer: best moves first (descending). Minimizer: worst-for-computer first (ascending).
    candidates.sort((a, b) =>
      isMaximizing ? b.quickScore - a.quickScore : a.quickScore - b.quickScore,
    );

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const { newState } of candidates) {
        const score = minimax(newState, depth - 1, alpha, beta, computerPlayer, config);
        if (score > maxScore) maxScore = score;
        if (score > alpha) alpha = score;
        if (beta <= alpha) break; // Beta cutoff: minimizer won't allow this path.
      }
      return maxScore;
    } 
    else {
      let minScore = Infinity;
      for (const { newState } of candidates) {
        const score = minimax(newState, depth - 1, alpha, beta, computerPlayer, config);
        if (score < minScore) minScore = score;
        if (score < beta) beta = score;
        if (beta <= alpha) break; // Alpha cutoff: maximizer won't choose this path.
      }
      return minScore;
    }
  } else {
    // No Alpha–Beta pruning: straightforward Minimax.
    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of moves) {
        const { newState } = applyMove(state, move);
        const score = minimax(newState, depth - 1, alpha, beta, computerPlayer, config);
        if (score > maxScore) maxScore = score;
      }
      return maxScore;
    } 
    else {
      let minScore = Infinity;
      for (const move of moves) {
        const { newState } = applyMove(state, move);
        const score = minimax(newState, depth - 1, alpha, beta, computerPlayer, config);
        if (score < minScore) minScore = score;
      }
      return minScore;
    }
  }
}
