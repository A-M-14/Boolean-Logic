import { BOARD_SIZE } from './boardInitializer';
import { validateMove } from './moveValidator';
import { computeFullScore } from './scoreCalculator';
import type { BoardState, Cell, MoveResult, Player, PlayerMove } from './types';

function deepCloneCells(cells: Cell[][]): Cell[][] {
  return cells.map(row => row.map(cell => ({ ...cell })));
}

function isBoardComplete(cells: Cell[][]): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = cells[r][c];
      if (cell.type === 'bit' && cell.value === null) return false;
    }
  }
  return true;
}

/**
 * Applies a player move to the current board state and returns the resulting state.
 *
 * In two-player mode: the active player (state.currentPlayer) places a bit on an empty bit cell;
 * the turn then passes to the other player.
 *
 * In solo mode: the single player (always 'red') may place a new bit or overwrite an existing one.
 * The score is fully recomputed after every change so that modifications are reflected immediately.
 *
 * @throws if the move is invalid according to validateMove.
 */
export function applyMove(state: BoardState, move: PlayerMove): MoveResult {
  const validation = validateMove(state, move);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid move');
  }

  const newCells = deepCloneCells(state.cells);
  const bitCell = newCells[move.row][move.col];

  if (bitCell.type !== 'bit') {
    throw new Error('Target cell is not a bit cell');
  }

  const player: Player = state.currentPlayer;
  bitCell.value = move.value;
  bitCell.placedBy = player;

  const newScores = computeFullScore(newCells);

  const nextPlayer: Player =
    state.gameMode === 'two-player'
      ? player === 'red' ? 'blue' : 'red'
      : 'red'; // solo: always the same player

  const scoreDelta: MoveResult['scoreDelta'] = {
    red: newScores.red - state.scores.red,
    blue: newScores.blue - state.scores.blue,
  };

  const newState: BoardState = {
    cells: newCells,
    scores: newScores,
    currentPlayer: nextPlayer,
    gameMode: state.gameMode,
    isComplete: isBoardComplete(newCells),
  };

  return { newState, scoreDelta };
}
