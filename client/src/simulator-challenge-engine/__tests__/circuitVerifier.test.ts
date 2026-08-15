import { describe, it, expect } from 'vitest';
import { verifyCircuit, countCircuitGates } from '../circuitVerifier';
import { CircuitStateManager } from '../../logic-circuit-simulator-engine/circuitStateManager';
import type { TruthTable } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

const P = (x: number, y: number) => ({ x, y });

// AND(A, B) truth table
const andTable: TruthTable = {
  varCount: 2,
  outputs: [false, false, false, true], // 00→0, 01→0, 10→0, 11→1
};

// OR(A, B) truth table
const orTable: TruthTable = {
  varCount: 2,
  outputs: [false, true, true, true],
};

// NOT A truth table (1 variable)
// Note: this is a "trivial" function but the verifier accepts any truth table.
const notATable: TruthTable = {
  varCount: 1,
  outputs: [true, false],
};

/** Build a correct AND(A,B) circuit. */
function buildAndCircuit() {
  const mgr  = new CircuitStateManager();
  const inA  = mgr.addNode({ type: 'input', label: 'A', value: null, position: P(0, 0) });
  const inB  = mgr.addNode({ type: 'input', label: 'B', value: null, position: P(0, 70) });
  const gate = mgr.addNode({ type: 'gate', gateType: 'AND', position: P(130, 35) });
  const out  = mgr.addNode({ type: 'output', position: P(260, 35) });
  mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
  mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
  mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out,  portIndex: 0 });
  return mgr.getState();
}

/** Build a correct OR(A,B) circuit. */
function buildOrCircuit() {
  const mgr  = new CircuitStateManager();
  const inA  = mgr.addNode({ type: 'input', label: 'A', value: null, position: P(0, 0) });
  const inB  = mgr.addNode({ type: 'input', label: 'B', value: null, position: P(0, 70) });
  const gate = mgr.addNode({ type: 'gate', gateType: 'OR', position: P(130, 35) });
  const out  = mgr.addNode({ type: 'output', position: P(260, 35) });
  mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
  mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
  mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out,  portIndex: 0 });
  return mgr.getState();
}

/** Build a circuit that implements OR instead of AND (deliberately wrong). */
function buildWrongCircuit() {
  const mgr  = new CircuitStateManager();
  const inA  = mgr.addNode({ type: 'input', label: 'A', value: null, position: P(0, 0) });
  const inB  = mgr.addNode({ type: 'input', label: 'B', value: null, position: P(0, 70) });
  const gate = mgr.addNode({ type: 'gate', gateType: 'OR', position: P(130, 35) });
  const out  = mgr.addNode({ type: 'output', position: P(260, 35) });
  mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
  mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
  mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out,  portIndex: 0 });
  return mgr.getState();
}

/** Build a correct NOT(A) circuit. */
function buildNotCircuit() {
  const mgr  = new CircuitStateManager();
  const inp  = mgr.addNode({ type: 'input', label: 'A', value: null, position: P(0, 0) });
  const gate = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P(130, 0) });
  const out  = mgr.addNode({ type: 'output', position: P(260, 0) });
  mgr.addWire({ nodeId: inp,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
  mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out,  portIndex: 0 });
  return mgr.getState();
}

// ── countCircuitGates ─────────────────────────────────────────────────────────

describe('countCircuitGates', () => {
  it('counts 0 gates for a circuit with only input and output nodes', () => {
    const mgr = new CircuitStateManager();
    const src = mgr.addNode({ type: 'input', value: null, position: P(0, 0) });
    const dst = mgr.addNode({ type: 'output', position: P(130, 0) });
    mgr.addWire({ nodeId: src, portIndex: 0 }, { nodeId: dst, portIndex: 0 });
    expect(countCircuitGates(mgr.getState())).toBe(0);
  });

  it('counts 1 gate for the AND circuit', () => {
    expect(countCircuitGates(buildAndCircuit())).toBe(1);
  });

  it('does not count split nodes as gates', () => {
    const mgr   = new CircuitStateManager();
    const inp   = mgr.addNode({ type: 'input', value: null, position: P(0, 0) });
    const split = mgr.addNode({ type: 'split', position: P(130, 0) });
    const out1  = mgr.addNode({ type: 'output', position: P(260, 0) });
    const out2  = mgr.addNode({ type: 'output', position: P(260, 70) });
    mgr.addWire({ nodeId: inp,   portIndex: 0 }, { nodeId: split, portIndex: 0 });
    mgr.addWire({ nodeId: split, portIndex: 0 }, { nodeId: out1,  portIndex: 0 });
    mgr.addWire({ nodeId: split, portIndex: 0 }, { nodeId: out2,  portIndex: 0 });
    expect(countCircuitGates(mgr.getState())).toBe(0);
  });
});

// ── verifyCircuit — correct circuits ──────────────────────────────────────────

describe('verifyCircuit — correct circuit', () => {
  it('reports correct=true for AND circuit vs AND table', () => {
    const result = verifyCircuit(buildAndCircuit(), andTable);
    expect(result.correct).toBe(true);
    expect(result.failures.length).toBe(0);
    expect(result.gateCount).toBe(1);
  });

  it('reports correct=true for OR circuit vs OR table', () => {
    const result = verifyCircuit(buildOrCircuit(), orTable);
    expect(result.correct).toBe(true);
    expect(result.failures.length).toBe(0);
  });

  it('reports correct=true for NOT circuit vs NOT-A table', () => {
    const result = verifyCircuit(buildNotCircuit(), notATable);
    expect(result.correct).toBe(true);
  });
});

// ── verifyCircuit — incorrect circuits ────────────────────────────────────────

describe('verifyCircuit — incorrect circuit', () => {
  it('reports correct=false when OR circuit is tested against AND table', () => {
    const result = verifyCircuit(buildWrongCircuit(), andTable);
    expect(result.correct).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it('identifies the exact failing combination (01 → OR gives 1, expected 0)', () => {
    const result = verifyCircuit(buildWrongCircuit(), andTable);
    // OR(0,1)=1 but AND expects 0; also OR(1,0)=1 but AND expects 0
    const failedInputSets = result.failures.map(f => f.inputs);
    // At minimum [false,true] and [true,false] should appear
    expect(failedInputSets.some(i => !i[0] && i[1])).toBe(true);
    expect(failedInputSets.some(i => i[0] && !i[1])).toBe(true);
  });

  it('records the expected and actual values in each failure', () => {
    const result = verifyCircuit(buildWrongCircuit(), andTable);
    for (const f of result.failures) {
      expect(typeof f.expected).toBe('boolean');
      // actual is true (OR gate drove the output)
      expect(f.actual).toBe(true);
    }
  });
});

// ── verifyCircuit — label-based variable ordering ─────────────────────────────

describe('verifyCircuit — label-based ordering', () => {
  it('correctly maps variables when input nodes are placed in reverse y-order but are labelled', () => {
    // Build ¬A∧B with B above A in y — without labels the verifier would
    // swap A↔B and produce a different function.
    const mgr  = new CircuitStateManager();
    const inB  = mgr.addNode({ type: 'input', label: 'B', value: null, position: P(0, 0)  });
    const inA  = mgr.addNode({ type: 'input', label: 'A', value: null, position: P(0, 70) });
    const not  = mgr.addNode({ type: 'gate', gateType: 'NOT', position: P(130, 70) });
    const gate = mgr.addNode({ type: 'gate', gateType: 'AND', position: P(260, 35) });
    const out  = mgr.addNode({ type: 'output', position: P(390, 35) });
    mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: not,  portIndex: 0 });
    mgr.addWire({ nodeId: not,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
    mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
    mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out,  portIndex: 0 });

    // ¬A ∧ B truth table
    const table = { varCount: 2, outputs: [false, true, false, false] };
    const result = verifyCircuit(mgr.getState(), table);
    expect(result.correct).toBe(true);
    expect(result.failures.length).toBe(0);
  });

  it('fails all combinations when input nodes have no labels', () => {
    // Unlabelled circuits are rejected — labels are required in challenge mode.
    const mgr  = new CircuitStateManager();
    const inA  = mgr.addNode({ type: 'input', value: null, position: P(0, 0)  });
    const inB  = mgr.addNode({ type: 'input', value: null, position: P(0, 70) });
    const gate = mgr.addNode({ type: 'gate', gateType: 'AND', position: P(130, 35) });
    const out  = mgr.addNode({ type: 'output', position: P(260, 35) });
    mgr.addWire({ nodeId: inA,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
    mgr.addWire({ nodeId: inB,  portIndex: 0 }, { nodeId: gate, portIndex: 1 });
    mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out,  portIndex: 0 });
    const result = verifyCircuit(mgr.getState(), andTable);
    expect(result.correct).toBe(false);
    expect(result.failures.length).toBe(andTable.outputs.length);
  });
});

// ── verifyCircuit — malformed circuits ────────────────────────────────────────

describe('verifyCircuit — malformed circuits', () => {
  it('fails all combinations when there is no output node', () => {
    const mgr = new CircuitStateManager();
    mgr.addNode({ type: 'input', value: null, position: P(0, 0) });
    mgr.addNode({ type: 'input', value: null, position: P(0, 70) });
    const result = verifyCircuit(mgr.getState(), andTable);
    expect(result.correct).toBe(false);
    expect(result.failures.length).toBe(andTable.outputs.length);
  });

  it('fails all combinations when input count does not match varCount', () => {
    // Circuit has 1 input but truth table has 2 variables
    const mgr  = new CircuitStateManager();
    const inp  = mgr.addNode({ type: 'input', value: null, position: P(0, 0) });
    const gate = mgr.addNode({ type: 'gate', gateType: 'AND', position: P(130, 0) });
    const out  = mgr.addNode({ type: 'output', position: P(260, 0) });
    mgr.addWire({ nodeId: inp,  portIndex: 0 }, { nodeId: gate, portIndex: 0 });
    mgr.addWire({ nodeId: gate, portIndex: 0 }, { nodeId: out,  portIndex: 0 });
    const result = verifyCircuit(mgr.getState(), andTable);
    expect(result.correct).toBe(false);
    expect(result.failures.length).toBe(andTable.outputs.length);
  });
});

// ── verifyCircuit — gate count ─────────────────────────────────────────────────

describe('verifyCircuit — gateCount', () => {
  it('returns the circuit gate count regardless of correctness', () => {
    const result = verifyCircuit(buildAndCircuit(), andTable);
    expect(result.gateCount).toBe(1);
  });
});
