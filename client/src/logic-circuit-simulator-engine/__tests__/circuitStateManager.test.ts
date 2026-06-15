import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitStateManager } from '../circuitStateManager';
import type { NodeInit, Port } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const POS = { x: 0, y: 0 };

const inputInit:  NodeInit = { type: 'input',  value: true,  position: POS };
const outputInit: NodeInit = { type: 'output',               position: POS };
const notInit:    NodeInit = { type: 'gate', gateType: 'NOT', position: POS };
const andInit:    NodeInit = { type: 'gate', gateType: 'AND', position: POS };
const splitInit:  NodeInit = { type: 'split',                 position: POS };

// ─── addNode ──────────────────────────────────────────────────────────────────

describe('addNode', () => {
  it('returns a non-empty string id', () => {
    const mgr = new CircuitStateManager();
    const id = mgr.addNode(inputInit);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns a unique id for each call', () => {
    const mgr = new CircuitStateManager();
    const ids = [
      mgr.addNode(inputInit),
      mgr.addNode(inputInit),
      mgr.addNode(outputInit),
    ];
    expect(new Set(ids).size).toBe(3);
  });

  it('stores the node in the state', () => {
    const mgr = new CircuitStateManager();
    const id = mgr.addNode(andInit);
    const { nodes } = mgr.getState();
    expect(nodes.has(id)).toBe(true);
    const node = nodes.get(id)!;
    expect(node.type).toBe('gate');
    if (node.type === 'gate') expect(node.gateType).toBe('AND');
  });

  it('stores the correct position', () => {
    const mgr = new CircuitStateManager();
    const pos = { x: 10, y: 20 };
    const id = mgr.addNode({ type: 'output', position: pos });
    expect(mgr.getState().nodes.get(id)!.position).toEqual(pos);
  });

  it('stores the initial value for input nodes', () => {
    const mgr = new CircuitStateManager();
    const id = mgr.addNode({ type: 'input', value: false, position: POS });
    const node = mgr.getState().nodes.get(id)!;
    if (node.type === 'input') expect(node.value).toBe(false);
  });
});

// ─── removeNode ───────────────────────────────────────────────────────────────

describe('removeNode', () => {
  it('removes the node from state', () => {
    const mgr = new CircuitStateManager();
    const id = mgr.addNode(inputInit);
    mgr.removeNode(id);
    expect(mgr.getState().nodes.has(id)).toBe(false);
  });

  it('is a no-op for an unknown id', () => {
    const mgr = new CircuitStateManager();
    expect(() => mgr.removeNode('nonexistent')).not.toThrow();
  });

  it('removes all wires that touch the node', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    const w = mgr.addWire(
      { nodeId: src, portIndex: 0 },
      { nodeId: dst, portIndex: 0 },
    );
    mgr.removeNode(src);
    expect(mgr.getState().wires.has(w)).toBe(false);
  });

  it('removes only wires connected to the removed node', () => {
    const mgr = new CircuitStateManager();
    const a = mgr.addNode(inputInit);
    const b = mgr.addNode(inputInit);
    const c = mgr.addNode(outputInit);
    const wAC = mgr.addWire({ nodeId: a, portIndex: 0 }, { nodeId: c, portIndex: 0 });
    const wBC = mgr.addWire({ nodeId: b, portIndex: 0 }, { nodeId: c, portIndex: 1 });
    mgr.removeNode(a);
    expect(mgr.getState().wires.has(wAC)).toBe(false);
    expect(mgr.getState().wires.has(wBC)).toBe(true);
  });
});

// ─── moveNode ─────────────────────────────────────────────────────────────────

describe('moveNode', () => {
  it('updates the node position', () => {
    const mgr = new CircuitStateManager();
    const id = mgr.addNode({ type: 'input', value: true, position: { x: 0, y: 0 } });
    mgr.moveNode(id, { x: 50, y: 75 });
    expect(mgr.getState().nodes.get(id)!.position).toEqual({ x: 50, y: 75 });
  });

  it('is a no-op for an unknown id', () => {
    const mgr = new CircuitStateManager();
    expect(() => mgr.moveNode('unknown', { x: 1, y: 1 })).not.toThrow();
  });

  it('does not affect other node properties', () => {
    const mgr = new CircuitStateManager();
    const id = mgr.addNode({ type: 'gate', gateType: 'AND', position: POS });
    mgr.moveNode(id, { x: 99, y: 99 });
    const node = mgr.getState().nodes.get(id)!;
    expect(node.type).toBe('gate');
    if (node.type === 'gate') expect(node.gateType).toBe('AND');
  });
});

// ─── setInputValue ────────────────────────────────────────────────────────────

describe('setInputValue', () => {
  it('updates the value of an input node', () => {
    const mgr = new CircuitStateManager();
    const id = mgr.addNode({ type: 'input', value: true, position: POS });
    mgr.setInputValue(id, false);
    const node = mgr.getState().nodes.get(id)!;
    if (node.type === 'input') expect(node.value).toBe(false);
  });

  it('is a no-op for a non-input node', () => {
    const mgr = new CircuitStateManager();
    const id = mgr.addNode(outputInit);
    expect(() => mgr.setInputValue(id, true)).not.toThrow();
  });

  it('is a no-op for an unknown id', () => {
    const mgr = new CircuitStateManager();
    expect(() => mgr.setInputValue('ghost', true)).not.toThrow();
  });
});

// ─── addWire ──────────────────────────────────────────────────────────────────

describe('addWire', () => {
  it('returns a non-empty string id', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    const id = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique ids for successive calls', () => {
    const mgr = new CircuitStateManager();
    const src  = mgr.addNode(inputInit);
    const dst1 = mgr.addNode(outputInit);
    const dst2 = mgr.addNode(outputInit);
    const w1 = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst1, portIndex: 0 });
    const w2 = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst2, portIndex: 0 });
    expect(w1).not.toBe(w2);
  });

  it('stores the wire in state with undefined signal', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    const wId = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    const wire = mgr.getState().wires.get(wId)!;
    expect(wire.from).toEqual({ nodeId: src, portIndex: 0 });
    expect(wire.to).toEqual({ nodeId: dst, portIndex: 0 });
    expect(wire.signal).toBeUndefined();
  });
});

// ─── removeWire ───────────────────────────────────────────────────────────────

describe('removeWire', () => {
  it('removes the wire from state', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    const wId = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    mgr.removeWire(wId);
    expect(mgr.getState().wires.has(wId)).toBe(false);
  });

  it('is a no-op for an unknown id', () => {
    const mgr = new CircuitStateManager();
    expect(() => mgr.removeWire('ghost')).not.toThrow();
  });

  it('does not remove nodes', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    const wId = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    mgr.removeWire(wId);
    expect(mgr.getState().nodes.has(src)).toBe(true);
    expect(mgr.getState().nodes.has(dst)).toBe(true);
  });
});

// ─── applySignals ─────────────────────────────────────────────────────────────

describe('applySignals', () => {
  it('writes the given signal value onto the matching wire', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    const wId = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });

    const updatedWire = { ...mgr.getState().wires.get(wId)!, signal: true };
    mgr.applySignals(new Map([[wId, updatedWire]]));

    expect(mgr.getState().wires.get(wId)!.signal).toBe(true);
  });

  it('ignores wire ids that are not present in the circuit', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    const wId = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });

    const phantom = { id: 'ghost', from: { nodeId: src, portIndex: 0 }, to: { nodeId: dst, portIndex: 0 }, signal: true as const, waypoints: [] as const };
    expect(() => mgr.applySignals(new Map([['ghost', phantom]]))).not.toThrow();
    expect(mgr.getState().wires.get(wId)!.signal).toBeUndefined();
  });
});

// ─── resetSignals ─────────────────────────────────────────────────────────────

describe('resetSignals', () => {
  it('sets signal to undefined on every wire', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    const wId = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });

    const updatedWire = { ...mgr.getState().wires.get(wId)!, signal: true };
    mgr.applySignals(new Map([[wId, updatedWire]]));
    expect(mgr.getState().wires.get(wId)!.signal).toBe(true);

    mgr.resetSignals();
    expect(mgr.getState().wires.get(wId)!.signal).toBeUndefined();
  });

  it('is a no-op on a circuit with no wires', () => {
    const mgr = new CircuitStateManager();
    mgr.addNode(inputInit);
    expect(() => mgr.resetSignals()).not.toThrow();
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('empties the node map', () => {
    const mgr = new CircuitStateManager();
    mgr.addNode(inputInit);
    mgr.addNode(outputInit);
    mgr.clear();
    expect(mgr.getState().nodes.size).toBe(0);
  });

  it('empties the wire map', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    mgr.clear();
    expect(mgr.getState().wires.size).toBe(0);
  });
});

// ─── getState ─────────────────────────────────────────────────────────────────

describe('getState', () => {
  it('returns a snapshot isolated from subsequent mutations', () => {
    const mgr = new CircuitStateManager();
    mgr.addNode(inputInit);
    const snap = mgr.getState();
    expect(snap.nodes.size).toBe(1);

    mgr.addNode(outputInit);
    expect(snap.nodes.size).toBe(1);       // snapshot is unaffected
    expect(mgr.getState().nodes.size).toBe(2);
  });

  it('wire snapshot is isolated from subsequent mutations', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode(inputInit);
    const dst = mgr.addNode(outputInit);
    const wId = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    const snap = mgr.getState();
    expect(snap.wires.size).toBe(1);

    mgr.removeWire(wId);
    expect(snap.wires.size).toBe(1);       // snapshot is unaffected
    expect(mgr.getState().wires.size).toBe(0);
  });

  it('starts empty', () => {
    const mgr = new CircuitStateManager();
    const { nodes, wires } = mgr.getState();
    expect(nodes.size).toBe(0);
    expect(wires.size).toBe(0);
  });
});
