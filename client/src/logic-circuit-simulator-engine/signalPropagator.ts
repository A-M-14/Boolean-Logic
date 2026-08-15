import type { CircuitState, NodeId, Wire, WireId } from './types.js';
import type { GateType } from './types.js';

// ── Ternary gate evaluation ────────────────────────────────────────────────────
//
// Supports short-circuit logic for undefined inputs:
//   NOR(1, x)  = 0 for any x (including undefined)
//   AND(0, x)  = 0 for any x
//   OR (1, x)  = 1 for any x
//   NAND(0, x) = 1 for any x
// Gates that can't resolve their output return undefined.

function evaluateGateTernary(
  gateType: GateType,
  inputs: readonly (boolean | undefined)[],
): boolean | undefined {
  switch (gateType) {
    case 'NOT':
      return inputs[0] === undefined ? undefined : !inputs[0];
    case 'AND':
      if (inputs.some(i => i === false))     return false;
      if (inputs.some(i => i === undefined)) return undefined;
      return true;
    case 'OR':
      if (inputs.some(i => i === true))      return true;
      if (inputs.some(i => i === undefined)) return undefined;
      return false;
    case 'NAND':
      if (inputs.some(i => i === false))     return true;
      if (inputs.some(i => i === undefined)) return undefined;
      return false;
    case 'NOR':
      if (inputs.some(i => i === true))      return false;
      if (inputs.some(i => i === undefined)) return undefined;
      return true;
    case 'XOR':
      if (inputs.some(i => i === undefined)) return undefined;
      return (inputs[0] as boolean) !== (inputs[1] as boolean);
    case 'XNOR':
      if (inputs.some(i => i === undefined)) return undefined;
      return (inputs[0] as boolean) === (inputs[1] as boolean);
    default:
      return undefined;
  }
}

// ── Public types ───────────────────────────────────────────────────────────────

/** One entry in a propagation wave: the wire that received a signal push and
 *  the value it carried at that moment (undefined = "unresolved / gray"). */
export interface PropagationWireEntry {
  readonly wireId: WireId;
  readonly signal: boolean | undefined;
}

// ── Fixed-point BFS propagation ────────────────────────────────────────────────

/** Safety cap: maximum number of times a single node may be (re-)evaluated.
 *  Prevents infinite loops in oscillating feedback circuits. */
const MAX_EVALS_PER_NODE = 20;

/**
 * Fixed-point BFS propagation with ternary (short-circuit) gate evaluation.
 *
 * The algorithm seeds every wire from `seedSignals` (the previous stable
 * state), so latches and flip-flops remember their stored value across runs.
 * Omit `seedSignals` for a cold start where every wire begins undefined.
 *
 * Returns the converged circuit state plus an ordered list of animation waves.
 * Each wave contains **every** outgoing wire of every node evaluated in that
 * step — including undefined-signal wires and re-visited feedback wires — so
 * the animation faithfully mirrors the causal propagation path.
 *
 * Convergence rule: a downstream node is re-queued only when the signal on
 * an incoming wire **changes**.  This guarantees termination for circuits that
 * reach a fixed point; the per-node cap handles oscillating circuits.
 */
export function propagateSignalsLayered(
  state: CircuitState,
  seedSignals: ReadonlyMap<WireId, boolean | undefined> = new Map(),
): {
  state: CircuitState;
  waves: readonly (readonly PropagationWireEntry[])[];
} {
  // ── Build lookup tables ───────────────────────────────────────────────────
  const wireSignal    = new Map<WireId, boolean | undefined>();
  const incomingWires = new Map<NodeId, Map<number, WireId>>();
  const outgoingWires = new Map<NodeId, WireId[]>();

  for (const [nodeId] of state.nodes) {
    incomingWires.set(nodeId, new Map());
    outgoingWires.set(nodeId, []);
  }

  for (const [wireId, wire] of state.wires) {
    // Seed from stable state; wires absent from the seed start undefined.
    wireSignal.set(wireId, seedSignals.get(wireId));
    incomingWires.get(wire.to.nodeId)?.set(wire.to.portIndex, wireId);
    outgoingWires.get(wire.from.nodeId)?.push(wireId);
  }

  // ── Node output helper ────────────────────────────────────────────────────
  function computeOutput(nodeId: NodeId): boolean | undefined {
    const node = state.nodes.get(nodeId)!;

    if (node.type === 'input') {
      return node.value !== null ? node.value : undefined;
    }
    if (node.type === 'gate') {
      const portMap       = incomingWires.get(nodeId)!;
      const requiredPorts = node.gateType === 'NOT' ? 1 : 2;
      const inputs: (boolean | undefined)[] = [];
      for (let i = 0; i < requiredPorts; i++) {
        const wId = portMap.get(i);
        inputs.push(wId !== undefined ? wireSignal.get(wId) : undefined);
      }
      return evaluateGateTernary(node.gateType, inputs);
    }
    if (node.type === 'split') {
      const wId = incomingWires.get(nodeId)!.get(0);
      return wId !== undefined ? wireSignal.get(wId) : undefined;
    }
    return undefined; // 'output' nodes are sinks
  }

  // ── BFS fixed-point loop ──────────────────────────────────────────────────
  const evalCount = new Map<NodeId, number>();
  for (const [nodeId] of state.nodes) evalCount.set(nodeId, 0);

  const waves: PropagationWireEntry[][] = [];

  // Seed the first wave with every source node (no incoming wires).
  let currentWave = new Set<NodeId>();
  for (const [nodeId] of state.nodes) {
    if ((incomingWires.get(nodeId)?.size ?? 0) === 0) currentWave.add(nodeId);
  }

  while (currentWave.size > 0) {
    const waveEntries: PropagationWireEntry[] = [];
    const nextWave = new Set<NodeId>();

    for (const nodeId of currentWave) {
      const count = evalCount.get(nodeId) ?? 0;
      if (count >= MAX_EVALS_PER_NODE) continue;
      evalCount.set(nodeId, count + 1);

      const output = computeOutput(nodeId);

      for (const wireId of outgoingWires.get(nodeId) ?? []) {
        const prev = wireSignal.get(wireId);
        wireSignal.set(wireId, output);

        // Only animate when the signal is resolved AND has actually changed.
        // - undefined output: gate couldn't short-circuit; propagation halts
        //   here until the missing input arrives.
        // - same value as before: the first input already determined this
        //   output independently; the second input confirms it but adds
        //   nothing new, so no dot should travel the wire again.
        if (output !== undefined && output !== prev) {
          waveEntries.push({ wireId, signal: output });
        }

        // Only propagate downstream when the signal actually changed; this is
        // the fixed-point convergence condition.
        if (output !== prev) {
          const downId = state.wires.get(wireId)!.to.nodeId;
          if ((evalCount.get(downId) ?? 0) < MAX_EVALS_PER_NODE) {
            nextWave.add(downId);
          }
        }
      }
    }

    if (waveEntries.length > 0) waves.push(waveEntries);
    currentWave = nextWave;
  }

  // ── Build final wire map ──────────────────────────────────────────────────
  const updatedWires = new Map<WireId, Wire>();
  for (const [wireId, wire] of state.wires) {
    updatedWires.set(wireId, { ...wire, signal: wireSignal.get(wireId) });
  }

  return { state: { nodes: state.nodes, wires: updatedWires }, waves };
}

/**
 * Computes signal values for every wire in the circuit.
 * Delegates to propagateSignalsLayered; the wave data is discarded.
 */
export function propagateSignals(
  state: CircuitState,
  seedSignals?: ReadonlyMap<WireId, boolean | undefined>,
): CircuitState {
  return propagateSignalsLayered(state, seedSignals).state;
}
