/**
 * Circuit Verifier — checks a user-built circuit against a truth table.
 *
 * Input nodes are matched to truth-table variables by their label (A, B, C, …).
 * Every input node must carry the correct label; circuits with missing or
 * unrecognised labels are treated as malformed and fail all combinations.
 */

import type { CircuitState, CircuitNode, NodeId } from '../logic-circuit-simulator-engine/index.js';
import { propagateSignals } from '../logic-circuit-simulator-engine/index.js';
import type { TruthTable, VerificationFailure, VerificationResult } from './types.js';
import { VAR_NAMES } from './types.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Count every GateNode in the circuit (inputs, outputs, and splits are excluded). */
export function countCircuitGates(state: CircuitState): number {
  let n = 0;
  for (const node of state.nodes.values()) {
    if (node.type === 'gate') n++;
  }
  return n;
}

/**
 * Find the signal on the wire arriving at the (sole) output node,
 * after propagation. Returns undefined if no such wire exists.
 */
function readOutputSignal(state: CircuitState, outputNodeId: NodeId): boolean | undefined {
  for (const wire of state.wires.values()) {
    if (wire.to.nodeId === outputNodeId && wire.to.portIndex === 0) {
      return wire.signal;
    }
  }
  return undefined;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Verifies whether the circuit implements the given truth table.
 *
 * For each of the 2^n input combinations the function:
 *   1. Sets the input nodes' values according to the combination.
 *   2. Runs propagateSignals() on the modified state.
 *   3. Reads the signal at the output node.
 *   4. Compares it to the expected truth-table entry.
 *
 * The circuit must have exactly `truthTable.varCount` input nodes, each
 * carrying the correct variable label (A, B, C, …), and exactly one output
 * node; otherwise every combination is reported as failing.
 */
export function verifyCircuit(
  state:      CircuitState,
  truthTable: TruthTable,
): VerificationResult {
  const { varCount, outputs } = truthTable;
  const rowCount  = 1 << varCount;
  const gateCount = countCircuitGates(state);

  const expectedNames = VAR_NAMES.slice(0, varCount);

  // Build label → node map for input nodes.
  const byLabel = new Map<string, CircuitNode & { type: 'input' }>();
  for (const node of state.nodes.values()) {
    if (node.type === 'input' && node.label !== undefined) {
      byLabel.set(node.label, node);
    }
  }

  const outputNodes = [...state.nodes.values()].filter(n => n.type === 'output');

  // Malformed: wrong number of labeled inputs, missing expected labels, or wrong output count.
  const inputNodes = expectedNames.map(name => byLabel.get(name));
  const malformed  =
    inputNodes.some(n => n === undefined) ||
    byLabel.size !== varCount ||
    outputNodes.length !== 1;

  if (malformed) {
    const failures: VerificationFailure[] = [];
    for (let i = 0; i < rowCount; i++) {
      failures.push({ inputs: decodeInputs(i, varCount), expected: outputs[i], actual: undefined });
    }
    return { correct: false, gateCount, failures };
  }

  const outputNodeId = outputNodes[0].id;
  const failures: VerificationFailure[] = [];

  for (let i = 0; i < rowCount; i++) {
    const inputValues = decodeInputs(i, varCount);

    // Build a modified state with the current input combination applied.
    const modifiedNodes = new Map<NodeId, CircuitNode>(state.nodes);
    for (let v = 0; v < varCount; v++) {
      const node = inputNodes[v]!;
      modifiedNodes.set(node.id, { ...node, value: inputValues[v] } as CircuitNode);
    }
    const modifiedState: CircuitState = { nodes: modifiedNodes, wires: state.wires };

    const propagated = propagateSignals(modifiedState);
    const actual     = readOutputSignal(propagated, outputNodeId);
    const expected   = outputs[i];

    if (actual !== expected) {
      failures.push({ inputs: inputValues, expected, actual });
    }
  }

  return { correct: failures.length === 0, gateCount, failures };
}

// ── Internal ───────────────────────────────────────────────────────────────────

/**
 * Decode row index `i` into an array of boolean values for `varCount` variables.
 * Variable 0 (A) is the MSB: bit (varCount-1) of i.
 */
function decodeInputs(i: number, varCount: number): boolean[] {
  const values: boolean[] = [];
  for (let v = 0; v < varCount; v++) {
    values.push(((i >> (varCount - 1 - v)) & 1) === 1);
  }
  return values;
}
