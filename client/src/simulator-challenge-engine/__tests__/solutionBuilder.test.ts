import { describe, it, expect } from 'vitest';
import { buildSolution } from '../solutionBuilder';
import { minimize } from '../circuitMinimizer';
import { verifyCircuit } from '../circuitVerifier';
import type { TruthTable, Expr, MinimizationResult } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeResult(expr: Expr, gateCount: number): MinimizationResult {
  return { expr, gateCount };
}

/** Run minimize then buildSolution, then verify the circuit matches the table. */
function buildAndVerify(table: TruthTable) {
  const result  = minimize(table);
  const circuit = buildSolution(result, table.varCount);
  return verifyCircuit(circuit, table);
}

// ── Structural checks ──────────────────────────────────────────────────────────

describe('buildSolution — structure', () => {
  it('circuit has exactly one output node', () => {
    const result = minimize({ varCount: 2, outputs: [false, false, false, true] });
    const state  = buildSolution(result, 2);
    const outputs = [...state.nodes.values()].filter(n => n.type === 'output');
    expect(outputs.length).toBe(1);
  });

  it('circuit has exactly varCount input nodes for 2-variable expression', () => {
    const result = minimize({ varCount: 2, outputs: [false, false, false, true] });
    const state  = buildSolution(result, 2);
    const inputs = [...state.nodes.values()].filter(n => n.type === 'input');
    expect(inputs.length).toBe(2);
  });

  it('circuit has exactly varCount input nodes for 3-variable expression', () => {
    const result = minimize({
      varCount: 3,
      outputs: [false, false, false, true, false, true, true, true],
    });
    const state  = buildSolution(result, 3);
    const inputs = [...state.nodes.values()].filter(n => n.type === 'input');
    expect(inputs.length).toBe(3);
  });

  it('all nodes have non-negative x and y coordinates', () => {
    const result = minimize({ varCount: 2, outputs: [false, true, true, false] });
    const state  = buildSolution(result, 2);
    for (const node of state.nodes.values()) {
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('output node is to the right of all gate nodes (x-coordinate)', () => {
    const result = minimize({ varCount: 3, outputs: [false, false, false, true, false, true, true, true] });
    const state  = buildSolution(result, 3);
    const outputX = [...state.nodes.values()].find(n => n.type === 'output')!.position.x;
    for (const node of state.nodes.values()) {
      if (node.type === 'gate') {
        expect(node.position.x).toBeLessThan(outputX);
      }
    }
  });

  it('all wires reference valid node IDs', () => {
    const result = minimize({ varCount: 2, outputs: [false, true, true, false] });
    const state  = buildSolution(result, 2);
    for (const wire of state.wires.values()) {
      expect(state.nodes.has(wire.from.nodeId)).toBe(true);
      expect(state.nodes.has(wire.to.nodeId)).toBe(true);
    }
  });
});

// ── Semantic correctness via Circuit Verifier ─────────────────────────────────

describe('buildSolution — semantic correctness', () => {
  const tables: TruthTable[] = [
    { varCount: 2, outputs: [false, false, false, true]  },   // AND
    { varCount: 2, outputs: [false, true,  true,  true]  },   // OR
    { varCount: 2, outputs: [false, true,  true,  false] },   // XOR
    { varCount: 2, outputs: [true,  false, false, true]  },   // XNOR
    { varCount: 2, outputs: [true,  true,  true,  false] },   // NAND  (now 1 gate)
    { varCount: 2, outputs: [true,  false, false, false] },   // NOR   (now 1 gate)
    // Majority(A,B,C)
    { varCount: 3, outputs: [false, false, false, true, false, true, true, true] },
    // Odd parity (A XOR B XOR C)
    { varCount: 3, outputs: [false, true, true, false, true, false, false, true] },
  ];

  for (const table of tables) {
    const label = `varCount=${table.varCount} outputs=[${table.outputs.map(Number).join('')}]`;
    it(`built circuit is functionally correct for ${label}`, () => {
      const vr = buildAndVerify(table);
      expect(vr.correct).toBe(true);
      expect(vr.failures.length).toBe(0);
    });
  }
});

// ── NOT-gate circuits (negated literals) ──────────────────────────────────────

describe('buildSolution — circuits with NOT gates', () => {
  it('correct for ¬A ∧ B  (needs a NOT gate)', () => {
    // ¬A ∧ B: 00→0, 01→0, 10→1 — wait: A=MSB
    // A=0,B=0→0; A=0,B=1→1; A=1,B=0→0; A=1,B=1→0
    const table: TruthTable = { varCount: 2, outputs: [false, true, false, false] };
    expect(buildAndVerify(table).correct).toBe(true);
  });

  it('circuit for ¬A ∧ B has a NOT gate node', () => {
    const table: TruthTable = { varCount: 2, outputs: [false, true, false, false] };
    const result  = minimize(table);
    const state   = buildSolution(result, 2);
    const notNodes = [...state.nodes.values()].filter(n => n.type === 'gate' && n.gateType === 'NOT');
    expect(notNodes.length).toBeGreaterThanOrEqual(1);
  });
});

// ── NAND/NOR circuits ─────────────────────────────────────────────────────────

describe('buildSolution — NAND/NOR circuits', () => {
  it('NAND circuit has exactly 1 gate node (the NAND gate)', () => {
    const table: TruthTable = { varCount: 2, outputs: [true, true, true, false] };
    const result = minimize(table);
    const state  = buildSolution(result, 2);
    const gates  = [...state.nodes.values()].filter(n => n.type === 'gate');
    expect(gates.length).toBe(1);
    if (gates[0].type === 'gate') expect(gates[0].gateType).toBe('NAND');
  });

  it('NOR circuit has exactly 1 gate node (the NOR gate)', () => {
    const table: TruthTable = { varCount: 2, outputs: [true, false, false, false] };
    const result = minimize(table);
    const state  = buildSolution(result, 2);
    const gates  = [...state.nodes.values()].filter(n => n.type === 'gate');
    expect(gates.length).toBe(1);
    if (gates[0].type === 'gate') expect(gates[0].gateType).toBe('NOR');
  });

  it('built NAND circuit is functionally correct', () => {
    const table: TruthTable = { varCount: 2, outputs: [true, true, true, false] };
    expect(buildAndVerify(table).correct).toBe(true);
  });

  it('built NOR circuit is functionally correct', () => {
    const table: TruthTable = { varCount: 2, outputs: [true, false, false, false] };
    expect(buildAndVerify(table).correct).toBe(true);
  });
});

// ── XOR/XNOR circuits ─────────────────────────────────────────────────────────

describe('buildSolution — XOR/XNOR circuits', () => {
  it('XOR circuit has exactly 1 gate node (the XOR gate)', () => {
    const table: TruthTable = { varCount: 2, outputs: [false, true, true, false] };
    const result = minimize(table);
    const state  = buildSolution(result, 2);
    const gates  = [...state.nodes.values()].filter(n => n.type === 'gate');
    expect(gates.length).toBe(1);
    if (gates[0].type === 'gate') expect(gates[0].gateType).toBe('XOR');
  });

  it('XNOR circuit has exactly 1 gate node (the XNOR gate)', () => {
    const table: TruthTable = { varCount: 2, outputs: [true, false, false, true] };
    const result = minimize(table);
    const state  = buildSolution(result, 2);
    const gates  = [...state.nodes.values()].filter(n => n.type === 'gate');
    expect(gates.length).toBe(1);
    if (gates[0].type === 'gate') expect(gates[0].gateType).toBe('XNOR');
  });
});
