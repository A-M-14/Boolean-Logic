import { evaluateGate } from '@boolean-logic/shared';
import type { CircuitState, NodeId, Wire, WireId } from './types.js';

/**
 * Computes signal values for every wire in the circuit using a topological
 * traversal (Kahn's algorithm). Starts from input nodes and propagates
 * downstream through gates and split points to output probes.
 *
 * Wires in feedback cycles, or downstream of disconnected gate inputs,
 * receive signal = undefined (unresolved).
 *
 * Returns a new CircuitState with updated wire signals; the node map is
 * shared by reference (nodes are not mutated by propagation).
 */
export function propagateSignals(state: CircuitState): CircuitState {
  // wireSignal[wireId] = the boolean value that flows through that wire,
  // or undefined if it could not be computed.
  const wireSignal = new Map<WireId, boolean | undefined>();

  // incomingWires[nodeId][portIndex] = wireId arriving at that input port.
  const incomingWires = new Map<NodeId, Map<number, WireId>>();

  // outgoingWires[nodeId] = all wireIds leaving that node's output port(s).
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

  // How many of a node's incoming wires have been assigned a signal so far.
  const resolvedCount = new Map<NodeId, number>();
  for (const [nodeId] of state.nodes) resolvedCount.set(nodeId, 0);

  const processed = new Set<NodeId>();

  // Seed: every node with no incoming wires is immediately ready to process.
  // This includes all input nodes (which have no input ports) as well as any
  // gate/split/output that has been placed but not yet wired.
  const queue: NodeId[] = [];
  for (const [nodeId] of state.nodes) {
    if (incomingWires.get(nodeId)!.size === 0) queue.push(nodeId);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (processed.has(nodeId)) continue;
    processed.add(nodeId);

    const node = state.nodes.get(nodeId)!;
    let outputValue: boolean | undefined;

    if (node.type === 'input') {
      outputValue = node.value;
    } else if (node.type === 'gate') {
      const portMap = incomingWires.get(nodeId)!;
      const requiredPorts = node.gateType === 'NOT' ? 1 : 2;
      const inputs: boolean[] = [];
      let allPresent = true;

      for (let i = 0; i < requiredPorts; i++) {
        const wireId = portMap.get(i);
        const sig = wireId !== undefined ? wireSignal.get(wireId) : undefined;
        if (sig === undefined) { allPresent = false; break; }
        inputs.push(sig);
      }

      outputValue = allPresent ? evaluateGate(node.gateType, inputs) : undefined;
    } else if (node.type === 'split') {
      // Pass the single incoming signal through to all outgoing wires.
      const inputWireId = incomingWires.get(nodeId)!.get(0);
      outputValue = inputWireId !== undefined ? wireSignal.get(inputWireId) : undefined;
    }
    // 'output' nodes are sinks — they have no output to propagate.

    for (const wireId of outgoingWires.get(nodeId) ?? []) {
      wireSignal.set(wireId, outputValue);

      const downstreamId = state.wires.get(wireId)!.to.nodeId;
      const newCount = resolvedCount.get(downstreamId)! + 1;
      resolvedCount.set(downstreamId, newCount);

      // Enqueue the downstream node once all its wired inputs have signals.
      if (newCount >= incomingWires.get(downstreamId)!.size && !processed.has(downstreamId)) {
        queue.push(downstreamId);
      }
    }
  }

  // Rebuild the wire map with computed signal values.
  const updatedWires = new Map<WireId, Wire>();
  for (const [wireId, wire] of state.wires) {
    updatedWires.set(wireId, { ...wire, signal: wireSignal.get(wireId) });
  }

  return { nodes: state.nodes, wires: updatedWires };
}
