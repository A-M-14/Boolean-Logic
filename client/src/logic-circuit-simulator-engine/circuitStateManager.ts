import type { CircuitNode, CircuitState, NodeId, NodeInit, Port, Wire, WireId } from './types.js';

/**
 * Single source of truth for a logic circuit's structure and state.
 * Manages nodes (gates, inputs, outputs, splits) and the wires between them.
 * Call propagateSignals() and then applySignals() to update wire signal values.
 */
export class CircuitStateManager {
  private readonly _nodes = new Map<NodeId, CircuitNode>();
  private readonly _wires = new Map<WireId, Wire>();
  private _nodeSeq = 0;
  private _wireSeq = 0;

  /** Adds a new node to the circuit and returns its generated id. */
  addNode(init: NodeInit): NodeId {
    const id: NodeId = `node-${++this._nodeSeq}`;
    this._nodes.set(id, { ...init, id } as CircuitNode);
    return id;
  }

  /** Removes a node and all wires connected to it. */
  removeNode(nodeId: NodeId): void {
    if (!this._nodes.delete(nodeId)) return;
    const toDelete: WireId[] = [];
    for (const [wireId, wire] of this._wires) {
      if (wire.from.nodeId === nodeId || wire.to.nodeId === nodeId) {
        toDelete.push(wireId);
      }
    }
    for (const wireId of toDelete) this._wires.delete(wireId);
  }

  /** Updates the canvas position of a node (used when the user drags it). */
  moveNode(nodeId: NodeId, position: { x: number; y: number }): void {
    const node = this._nodes.get(nodeId);
    if (node) this._nodes.set(nodeId, { ...node, position });
  }

  /** Toggles the boolean value of an input node. */
  setInputValue(nodeId: NodeId, value: boolean): void {
    const node = this._nodes.get(nodeId);
    if (node?.type === 'input') this._nodes.set(nodeId, { ...node, value });
  }

  /**
   * Adds a wire from an output port of one node to an input port of another.
   * Returns the generated wire id.
   */
  addWire(from: Port, to: Port): WireId {
    const id: WireId = `wire-${++this._wireSeq}`;
    this._wires.set(id, { id, from, to, signal: undefined });
    return id;
  }

  /** Removes a single wire. */
  removeWire(wireId: WireId): void {
    this._wires.delete(wireId);
  }

  /** Writes the signal values computed by propagateSignals() back into the wire map. */
  applySignals(updatedWires: ReadonlyMap<WireId, Wire>): void {
    for (const [wireId, wire] of updatedWires) {
      if (this._wires.has(wireId)) this._wires.set(wireId, wire);
    }
  }

  /** Clears all computed signal values from every wire (returns circuit to uncomputed state). */
  resetSignals(): void {
    for (const [wireId, wire] of this._wires) {
      this._wires.set(wireId, { ...wire, signal: undefined });
    }
  }

  /** Removes all nodes and wires, resetting the circuit to an empty state. */
  clear(): void {
    this._nodes.clear();
    this._wires.clear();
  }

  /** Returns a snapshot of the current circuit state. */
  getState(): CircuitState {
    return {
      nodes: new Map(this._nodes),
      wires: new Map(this._wires),
    };
  }
}
