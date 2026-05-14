import { describe, it, expect } from 'vitest';
import { propagateSignals } from '../signalPropagator';
import { CircuitStateManager } from '../circuitStateManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const P = { x: 0, y: 0 };

/** Build a CircuitState, run propagation, and return the wire signal map. */
function run(setup: (mgr: CircuitStateManager) => void): Map<string, boolean | undefined> {
  const mgr = new CircuitStateManager();
  setup(mgr);
  const result = propagateSignals(mgr.getState());
  const signals = new Map<string, boolean | undefined>();
  for (const [id, wire] of result.wires) signals.set(id, wire.signal);
  return signals;
}

// ─── Empty / trivial circuits ─────────────────────────────────────────────────

describe('empty circuit', () => {
  it('returns an empty wire map', () => {
    const mgr = new CircuitStateManager();
    const result = propagateSignals(mgr.getState());
    expect(result.wires.size).toBe(0);
  });
});

describe('isolated input node (no wires)', () => {
  it('produces no wire signals', () => {
    const mgr = new CircuitStateManager();
    mgr.addNode({ type: 'input', value: true, position: P });
    const result = propagateSignals(mgr.getState());
    expect(result.wires.size).toBe(0);
  });
});

// ─── Input → Output (direct wire) ────────────────────────────────────────────

describe('input directly wired to output', () => {
  it.each([
    [true],
    [false],
  ])('wire carries the input value %s', (inputVal) => {
    let wId!: string;
    const signals = run(mgr => {
      const src = mgr.addNode({ type: 'input', value: inputVal, position: P });
      const dst = mgr.addNode({ type: 'output', position: P });
      wId = mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    });
    expect(signals.get(wId)).toBe(inputVal);
  });
});

// ─── NOT gate ─────────────────────────────────────────────────────────────────

describe('NOT gate', () => {
  it.each([
    [true,  false],
    [false, true ],
  ])('NOT(%s) → %s', (inputVal, expected) => {
    let wIn!: string, wOut!: string;
    const signals = run(mgr => {
      const inp  = mgr.addNode({ type: 'input', value: inputVal, position: P });
      const gate = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      wIn  = mgr.addWire({ nodeId: inp,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
      wOut = mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out,  portIndex: 0 });
    });
    expect(signals.get(wIn )).toBe(inputVal);
    expect(signals.get(wOut)).toBe(expected);
  });
});

// ─── AND gate ─────────────────────────────────────────────────────────────────

describe('AND gate', () => {
  it.each([
    [false, false, false],
    [false, true,  false],
    [true,  false, false],
    [true,  true,  true ],
  ])('AND(%s, %s) → %s', (a, b, expected) => {
    let wOut!: string;
    const signals = run(mgr => {
      const inA  = mgr.addNode({ type: 'input', value: a, position: P });
      const inB  = mgr.addNode({ type: 'input', value: b, position: P });
      const gate = mgr.addNode({ type: 'gate', gateType: 'AND', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
      mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
      wOut = mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBe(expected);
  });
});

// ─── OR gate ──────────────────────────────────────────────────────────────────

describe('OR gate', () => {
  it.each([
    [false, false, false],
    [false, true,  true ],
    [true,  false, true ],
    [true,  true,  true ],
  ])('OR(%s, %s) → %s', (a, b, expected) => {
    let wOut!: string;
    const signals = run(mgr => {
      const inA  = mgr.addNode({ type: 'input', value: a, position: P });
      const inB  = mgr.addNode({ type: 'input', value: b, position: P });
      const gate = mgr.addNode({ type: 'gate', gateType: 'OR', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
      mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
      wOut = mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBe(expected);
  });
});

// ─── XOR gate ─────────────────────────────────────────────────────────────────

describe('XOR gate', () => {
  it.each([
    [false, false, false],
    [false, true,  true ],
    [true,  false, true ],
    [true,  true,  false],
  ])('XOR(%s, %s) → %s', (a, b, expected) => {
    let wOut!: string;
    const signals = run(mgr => {
      const inA  = mgr.addNode({ type: 'input', value: a, position: P });
      const inB  = mgr.addNode({ type: 'input', value: b, position: P });
      const gate = mgr.addNode({ type: 'gate', gateType: 'XOR', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
      mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
      wOut = mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBe(expected);
  });
});

// ─── NAND / NOR / XNOR gates ──────────────────────────────────────────────────

describe('NAND gate', () => {
  it.each([
    [false, false, true ],
    [false, true,  true ],
    [true,  false, true ],
    [true,  true,  false],
  ])('NAND(%s, %s) → %s', (a, b, expected) => {
    let wOut!: string;
    const signals = run(mgr => {
      const inA  = mgr.addNode({ type: 'input', value: a, position: P });
      const inB  = mgr.addNode({ type: 'input', value: b, position: P });
      const gate = mgr.addNode({ type: 'gate', gateType: 'NAND', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
      mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
      wOut = mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBe(expected);
  });
});

describe('NOR gate', () => {
  it.each([
    [false, false, true ],
    [false, true,  false],
    [true,  false, false],
    [true,  true,  false],
  ])('NOR(%s, %s) → %s', (a, b, expected) => {
    let wOut!: string;
    const signals = run(mgr => {
      const inA  = mgr.addNode({ type: 'input', value: a, position: P });
      const inB  = mgr.addNode({ type: 'input', value: b, position: P });
      const gate = mgr.addNode({ type: 'gate', gateType: 'NOR', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
      mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
      wOut = mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBe(expected);
  });
});

describe('XNOR gate', () => {
  it.each([
    [false, false, true ],
    [false, true,  false],
    [true,  false, false],
    [true,  true,  true ],
  ])('XNOR(%s, %s) → %s', (a, b, expected) => {
    let wOut!: string;
    const signals = run(mgr => {
      const inA  = mgr.addNode({ type: 'input', value: a, position: P });
      const inB  = mgr.addNode({ type: 'input', value: b, position: P });
      const gate = mgr.addNode({ type: 'gate', gateType: 'XNOR', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
      mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
      wOut = mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBe(expected);
  });
});

// ─── Split node ───────────────────────────────────────────────────────────────

describe('split node', () => {
  it.each([true, false])('fans out value %s to two output wires', (inputVal) => {
    let wIn!: string, wOut1!: string, wOut2!: string;
    const signals = run(mgr => {
      const inp   = mgr.addNode({ type: 'input', value: inputVal, position: P });
      const split = mgr.addNode({ type: 'split', position: P });
      const dst1  = mgr.addNode({ type: 'output', position: P });
      const dst2  = mgr.addNode({ type: 'output', position: P });
      wIn   = mgr.addWire({ nodeId: inp,   portIndex: 0 }, { nodeId: split, portIndex: 0 });
      wOut1 = mgr.addWire({ nodeId: split, portIndex: 0 }, { nodeId: dst1,  portIndex: 0 });
      wOut2 = mgr.addWire({ nodeId: split, portIndex: 0 }, { nodeId: dst2,  portIndex: 0 });
    });
    expect(signals.get(wIn  )).toBe(inputVal);
    expect(signals.get(wOut1)).toBe(inputVal);
    expect(signals.get(wOut2)).toBe(inputVal);
  });
});

// ─── Multi-gate chains ────────────────────────────────────────────────────────

describe('chained gates', () => {
  it('propagates through NOT → AND (double NOT cancel)', () => {
    // Input A ──NOT──> tmp ──AND──> out
    // Input B ──────────────────────^
    // NOT(true) = false; AND(false, true) = false
    let wOut!: string;
    const signals = run(mgr => {
      const inA  = mgr.addNode({ type: 'input', value: true, position: P });
      const inB  = mgr.addNode({ type: 'input', value: true, position: P });
      const notG = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P });
      const andG = mgr.addNode({ type: 'gate', gateType: 'AND', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: notG, portIndex: 0 });
      mgr.addWire({ nodeId: notG, portIndex: 0 }, { nodeId: andG, portIndex: 0 });
      mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: andG, portIndex: 1 });
      wOut = mgr.addWire({ nodeId: andG, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBe(false); // AND(NOT(true), true) = AND(false, true) = false
  });

  it('three-gate chain: NOT → NOT → NOT(true) = false', () => {
    let wFinal!: string;
    const signals = run(mgr => {
      const inp  = mgr.addNode({ type: 'input', value: true, position: P });
      const n1   = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P });
      const n2   = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P });
      const n3   = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inp, portIndex: 0 }, { nodeId: n1, portIndex: 0 });
      mgr.addWire({ nodeId: n1,  portIndex: 0 }, { nodeId: n2, portIndex: 0 });
      mgr.addWire({ nodeId: n2,  portIndex: 0 }, { nodeId: n3, portIndex: 0 });
      wFinal = mgr.addWire({ nodeId: n3, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wFinal)).toBe(false); // NOT(NOT(NOT(true))) = NOT(NOT(false)) = NOT(true) = false
  });
});

// ─── Diamond (split + AND) ────────────────────────────────────────────────────

describe('diamond circuit', () => {
  it.each([
    [true,  true ],  // AND(true, true)   = true
    [false, false],  // AND(false, false) = false
  ])('single input %s feeds both AND inputs via a split → %s', (inputVal, expected) => {
    let wOut!: string;
    const signals = run(mgr => {
      const inp   = mgr.addNode({ type: 'input', value: inputVal, position: P });
      const split = mgr.addNode({ type: 'split', position: P });
      const andG  = mgr.addNode({ type: 'gate', gateType: 'AND', position: P });
      const out   = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inp,   portIndex: 0 }, { nodeId: split, portIndex: 0 });
      mgr.addWire({ nodeId: split, portIndex: 0 }, { nodeId: andG,  portIndex: 0 });
      mgr.addWire({ nodeId: split, portIndex: 0 }, { nodeId: andG,  portIndex: 1 });
      wOut = mgr.addWire({ nodeId: andG, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBe(expected);
  });
});

// ─── Disconnected / partially-wired nodes ─────────────────────────────────────

describe('disconnected inputs', () => {
  it('AND gate with only one input wired produces undefined on its output', () => {
    let wOut!: string;
    const signals = run(mgr => {
      const inA  = mgr.addNode({ type: 'input', value: true, position: P });
      const gate = mgr.addNode({ type: 'gate', gateType: 'AND', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 }); // port 1 unwired
      wOut = mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBeUndefined();
  });

  it('NOT gate with no input wired produces undefined on its output', () => {
    let wOut!: string;
    const signals = run(mgr => {
      const gate = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P });
      const out  = mgr.addNode({ type: 'output', position: P });
      wOut = mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBeUndefined();
  });

  it('split node with no input wired produces undefined on its output wires', () => {
    let wOut!: string;
    const signals = run(mgr => {
      const split = mgr.addNode({ type: 'split', position: P });
      const out   = mgr.addNode({ type: 'output', position: P });
      wOut = mgr.addWire({ nodeId: split, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wOut)).toBeUndefined();
  });

  it('gate downstream of an unresolved gate also stays undefined', () => {
    let wFinal!: string;
    const signals = run(mgr => {
      // Incomplete AND gate (missing port 1) feeds into OR gate
      const inA   = mgr.addNode({ type: 'input', value: true, position: P });
      const andG  = mgr.addNode({ type: 'gate', gateType: 'AND', position: P });
      const inB   = mgr.addNode({ type: 'input', value: true, position: P });
      const orG   = mgr.addNode({ type: 'gate', gateType: 'OR',  position: P });
      const out   = mgr.addNode({ type: 'output', position: P });
      mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: andG, portIndex: 0 }); // port 1 missing
      mgr.addWire({ nodeId: andG, portIndex: 0 }, { nodeId: orG,  portIndex: 0 });
      mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: orG,  portIndex: 1 });
      wFinal = mgr.addWire({ nodeId: orG, portIndex: 0 }, { nodeId: out, portIndex: 0 });
    });
    expect(signals.get(wFinal)).toBeUndefined();
  });
});

// ─── Cycle detection ──────────────────────────────────────────────────────────

describe('feedback cycles', () => {
  it('wires in a two-node cycle stay undefined', () => {
    // Gate A output → Gate B input 0; Gate B output → Gate A input 0
    // (Neither can be resolved; both output wires remain undefined.)
    let wAB!: string, wBA!: string;
    const signals = run(mgr => {
      const gA = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P });
      const gB = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P });
      wAB = mgr.addWire({ nodeId: gA, portIndex: 0 }, { nodeId: gB, portIndex: 0 });
      wBA = mgr.addWire({ nodeId: gB, portIndex: 0 }, { nodeId: gA, portIndex: 0 });
    });
    expect(signals.get(wAB)).toBeUndefined();
    expect(signals.get(wBA)).toBeUndefined();
  });

  it('a driven input before a cycle does not resolve nodes inside the cycle', () => {
    // Input(true) → Gate A (AND, port 0)
    // Gate B (NOT) → Gate A (port 1)  ← cycle edge
    // Gate A → Gate B                 ← cycle edge
    let wAOut!: string, wBOut!: string;
    const signals = run(mgr => {
      const inp = mgr.addNode({ type: 'input', value: true, position: P });
      const gA  = mgr.addNode({ type: 'gate', gateType: 'AND', position: P });
      const gB  = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P });
      mgr.addWire({ nodeId: inp, portIndex: 0 }, { nodeId: gA, portIndex: 0 });
      wAOut = mgr.addWire({ nodeId: gA, portIndex: 0 }, { nodeId: gB, portIndex: 0 });
      wBOut = mgr.addWire({ nodeId: gB, portIndex: 0 }, { nodeId: gA, portIndex: 1 }); // closes cycle
    });
    expect(signals.get(wAOut)).toBeUndefined();
    expect(signals.get(wBOut)).toBeUndefined();
  });
});

// ─── State immutability ───────────────────────────────────────────────────────

describe('state immutability', () => {
  it('propagateSignals does not mutate the original node map', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode({ type: 'input', value: true, position: P });
    const dst = mgr.addNode({ type: 'output', position: P });
    mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    const state = mgr.getState();
    const originalNodes = state.nodes;
    propagateSignals(state);
    expect(state.nodes).toBe(originalNodes); // same reference — not replaced
  });

  it('propagateSignals returns a new wire map, not the original', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode({ type: 'input', value: true, position: P });
    const dst = mgr.addNode({ type: 'output', position: P });
    mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    const state = mgr.getState();
    const result = propagateSignals(state);
    expect(result.wires).not.toBe(state.wires);
  });
});
