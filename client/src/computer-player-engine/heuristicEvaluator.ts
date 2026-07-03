import { BOARD_SIZE, evaluateGate } from '@boolean-logic/shared';
import type { BitCell, BoardState, GateCell, Player } from '@boolean-logic/shared';
import type { HeuristicWeights } from './types';

/**
 * Heuristic Evaluator component.
 *
 * Assigns a numeric score to a non-terminal board state from the computer's perspective:
 *   - Positive values indicate a position favorable to the computer.
 *   - Negative values indicate a position favorable to the human opponent.
 *
 * The evaluation combines two weighted terms:
 *
 * 1. **Score differential** — the current gap between the computer's score and the human's
 *    score, multiplied by `weights.scoreDifferential`.
 *
 * 2. **Potential score** — for each empty bit cell, the net effect on the computer's advantage
 *    through all adjacent half-filled gate directions, averaged over both possible values (0 and 1)
 *    the empty cell could take. For each half-filled neighbor gate, the far bit's score through
 *    that gate is added to the estimate when the far bit belongs to the computer, or subtracted
 *    when it belongs to the human.
 *
 * @param state           - The board state to evaluate.
 * @param computerPlayer  - The player color assigned to the computer ('red' or 'blue').
 * @param weights         - Heuristic weights controlling each term's influence.
 * @returns A signed numeric evaluation from the computer's perspective.
 */
export function evaluateState(
  state: BoardState,
  computerPlayer: Player,
  weights: HeuristicWeights,
): number {
  const humanPlayer: Player = computerPlayer === 'red' ? 'blue' : 'red';
  const scoreDiff = state.scores[computerPlayer] - state.scores[humanPlayer];
  let evaluation = scoreDiff * weights.scoreDifferential;

  if (weights.potentialScore > 0) {
    evaluation += estimatePotential(state, computerPlayer) * weights.potentialScore;
  }

  return evaluation;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sums the potential advantage contributions from all empty bit cells on the board,
 * from the computer's perspective.
 */
function estimatePotential(state: BoardState, computerPlayer: Player): number {
  let potential = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = state.cells[r][c];
      if (cell.type !== 'bit' || (cell as BitCell).value !== null) continue;

      potential += emptyCellClaimValue(state, r, c, computerPlayer);
    }
  }

  return potential;
}

/**
 * Computes the net effect on the computer's advantage from the empty bit cell at (r, c).
 *
 * For each of the up to 4 neighboring half-filled gate directions, we accumulate per value
 * v ∈ {0, 1} that this cell could take:
 *   - farDiff[v]: the far bit's score contribution to (computer − human), signed by ownership.
 *   - thisScore[v]: the score this empty cell itself would earn through that gate at value v.
 *
 * After accumulating, we attribute thisScore to a specific player by comparing what each
 * side gains from placing each value:
 *   - Computer's total benefit placing v: farDiff[v] + thisScore[v].
 *   - Human's total benefit placing v:   thisScore[v] − farDiff[v]  (own score minus the
 *     far-bit advantage conceded to the computer by that value).
 *
 * If both players demonstrably prefer different values (computer prefers 1, human prefers 0,
 * or vice versa — including the case where one is indifferent and the other has a preference),
 * thisScore is attributed to the appropriate player: +thisScore[v] when the computer places v,
 * −thisScore[v] when the human places v.  When both players prefer the same value, thisScore
 * is left unattributed.
 *
 * Returns a value from the computer's perspective (positive = favorable for the computer).
 */
function emptyCellClaimValue(state: BoardState, r: number, c: number, computerPlayer: Player): number {
  // Each entry: { gate position, far-bit position }
  const neighbors = [
    { gr: r, gc: c - 1, farR: r, farC: c - 2 }, // gate to the left,  far bit further left
    { gr: r, gc: c + 1, farR: r, farC: c + 2 }, // gate to the right, far bit further right
    { gr: r - 1, gc: c, farR: r - 2, farC: c }, // gate above,        far bit further above
    { gr: r + 1, gc: c, farR: r + 2, farC: c }, // gate below,        far bit further below
  ];

  const farDiff = [0, 0];   // farDiff[v]: far-bit contribution to scoreDiff when this cell = v
  const thisScore = [0, 0]; // thisScore[v]: score this empty cell earns when its value = v

  for (const thisValue of [0, 1] as const) {
    for (const { gr, gc, farR, farC } of neighbors) {
      if (gr < 0 || gr >= BOARD_SIZE || gc < 0 || gc >= BOARD_SIZE) continue;
      if (farR < 0 || farR >= BOARD_SIZE || farC < 0 || farC >= BOARD_SIZE) continue;

      const gateCell = state.cells[gr][gc];
      if (gateCell.type !== 'gate') continue;

      const farCell = state.cells[farR][farC];
      if (farCell.type !== 'bit') continue;
      const farBit = farCell as BitCell;
      if (farBit.value === null) continue; // far side not placed → not a half-filled direction

      const farValue = farBit.value;
      const gateOut = evaluateGate((gateCell as GateCell).gate, [farValue === 1, thisValue === 1]) ? 1 : 0;
      const farS: number = farValue === gateOut ? 1 : -1;
      const thisS: number = thisValue === gateOut ? 1 : -1;

      if (farBit.placedBy === computerPlayer) {
        farDiff[thisValue] += farS;
      } else {
        farDiff[thisValue] -= farS;
      }

      thisScore[thisValue] += thisS;
    }
  }

  // How much more each player benefits from this slot being value 1 vs value 0.
  // Positive compDelta → computer prefers placing 1 here.
  // Positive humanDelta → human prefers placing 0 here (they gain more that way).
  const compDelta = (farDiff[1] + thisScore[1]) - (farDiff[0] + thisScore[0]);
  const humanDelta = (thisScore[0] - farDiff[0]) - (thisScore[1] - farDiff[1]);

  let scoreDiff = farDiff[0] + farDiff[1];

  if (compDelta >= 0 && humanDelta >= 0) {
    // Computer prefers 1 (or indifferent), human prefers 0 (or indifferent) — different values.
    // Attribute: computer places 1 (+thisScore[1]), human places 0 (−thisScore[0]).
    scoreDiff += thisScore[1] - thisScore[0];
  } else if (compDelta <= 0 && humanDelta <= 0) {
    // Computer prefers 0 (or indifferent), human prefers 1 (or indifferent) — different values.
    // Attribute: computer places 0 (+thisScore[0]), human places 1 (−thisScore[1]).
    scoreDiff += thisScore[0] - thisScore[1];
  }
  // else: both players prefer the same value — leave thisScore unattributed.

  return scoreDiff / 2;
}
