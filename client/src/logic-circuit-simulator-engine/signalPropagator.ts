import { evaluateGate } from '@boolean-logic/shared';
import type { CircuitState, NodeId, Wire, WireId } from './types.js';

/**
 * Topological traversal (Kahn's algorithm) that also groups wires into
 * "waves" — each sub-array contains the IDs of wires whose signals are
 * resolved in that propagation step, in order from inputs outward.
 * Only wires that carry a defined (true/false) signal are included.
 *
 * Returns the final circuit state with all wire signals set, plus the
 * ordered wave list used for the animated propagation effect.
 */
export function propagateSignalsLayered(state: CircuitState): {
  state: CircuitState;
  waves: readonly (readonly WireId[])[];
} {
  const wireSignal    = new Map<WireId, boolean | undefined>();
  const incomingWires = new Map<NodeId, Map<number, WireId>>();
  const outgoingWires = new Map<NodeId, WireId[]>();

  for (const [nodeId] of state.nodes) {
    incomingWires.set(nodeId, new Map());
    outgoingWires.set(nodeId, []);
  }

  for (const [wireId, wire] of state.wires) {
    incomingWires.get(wire.to.nodeId)?.set(wire.to.portIndex, wireId);
    outgoingWires.get(wire.from.nodeId)?.push(wireId);
    wireSignal.set(wireId, undefined);
  }

  const resolvedCount = new Map<NodeId, number>();
  for (const [nodeId] of state.nodes) resolvedCount.set(nodeId, 0);

  const processed = new Set<NodeId>();
  const waves: WireId[][] = [];

  // Seed: every node with no incoming wires (inputs, isolated gates, etc.)
  let currentWave: NodeId[] = [];
  for (const [nodeId] of state.nodes) {
    if (incomingWires.get(nodeId)!.size === 0) currentWave.push(nodeId);
  }

  while (currentWave.length > 0) {
    const waveWires: WireId[]  = [];
    const nextWave:  NodeId[]  = [];
    const enqueuedInNext = new Set<NodeId>();

    for (const nodeId of currentWave) {
      if (processed.has(nodeId)) continue;
      processed.add(nodeId);

      const node = state.nodes.get(nodeId)!;
      let outputValue: boolean | undefined;

      if (node.type === 'input') {
        outputValue = node.value !== null ? node.value : undefined;
      } else if (node.type === 'gate') {
        const portMap      = incomingWires.get(nodeId)!;
        const requiredPorts = node.gateType === 'NOT' ? 1 : 2;
        const inputs: boolean[] = [];
        let allPresent = true;

        for (let i = 0; i < requiredPorts; i++) {
          const wireId = portMap.get(i);
          const sig    = wireId !== undefined ? wireSignal.get(wireId) : undefined;
          if (sig === undefined) { allPresent = false; break; }
          inputs.push(sig);
        }

        outputValue = allPresent ? evaluateGate(node.gateType, inputs) : undefined;
      } else if (node.type === 'split') {
        const inputWireId = incomingWires.get(nodeId)!.get(0);
        outputValue = inputWireId !== undefined ? wireSignal.get(inputWireId) : undefined;
      }
      // 'output' nodes are sinks — no output to propagate.

      for (const wireId of outgoingWires.get(nodeId) ?? []) {
        wireSignal.set(wireId, outputValue);

        // Only wires with a defined signal are animated.
        if (outputValue !== undefined) waveWires.push(wireId);

        const downstreamId = state.wires.get(wireId)!.to.nodeId;
        const newCount     = resolvedCount.get(downstreamId)! + 1;
        resolvedCount.set(downstreamId, newCount);

        if (
          newCount >= incomingWires.get(downstreamId)!.size &&
          !processed.has(downstreamId) &&
          !enqueuedInNext.has(downstreamId)
        ) {
          nextWave.push(downstreamId);
          enqueuedInNext.add(downstreamId);
        }
      }
    }

    if (waveWires.length > 0) waves.push(waveWires);
    currentWave = nextWave;
  }

  // Rebuild the wire map with computed signal values.
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
export function propagateSignals(state: CircuitState): CircuitState {
  return propagateSignalsLayered(state).state;
}
