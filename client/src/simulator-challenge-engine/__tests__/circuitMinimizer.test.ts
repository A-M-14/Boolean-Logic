import { describe, it, expect } from 'vitest';
import { minimize, countGates } from '../circuitMinimizer';
import type { TruthTable, Expr } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a 2-variable truth table from the classic gate truth tables. */
function tt2(outputs: [boolean, boolean, boolean, boolean]): TruthTable {
  return { varCount: 2, outputs };
}

/** Build a 3-variable truth table. */
function tt3(outputs: boolean[]): TruthTable {
  return { varCount: 3, outputs };
}

/** Evaluate an Expr for a given variable assignment. */
function evalExpr(expr: Expr, vars: Record<string, boolean>): boolean {
  switch (expr.kind) {
    case 'lit':  return expr.neg ? !vars[expr.var] : vars[expr.var];
    case 'not':  return !evalExpr(expr.child, vars);
    case 'and':  return expr.children.every(c => evalExpr(c, vars));
    case 'or':   return expr.children.some(c => evalExpr(c, vars));
    case 'nand': return !expr.children.every(c => evalExpr(c, vars));
    case 'nor':  return !expr.children.some(c => evalExpr(c, vars));
    case 'xor':  return evalExpr(expr.left, vars) !== evalExpr(expr.right, vars);
    case 'xnor': return evalExpr(expr.left, vars) === evalExpr(expr.right, vars);
  }
}

/** Verify that the minimized expression matches the truth table on every row. */
function matchesTruthTable(expr: Expr, table: TruthTable): boolean {
  const names = ['A', 'B', 'C', 'D', 'E'].slice(0, table.varCount);
  for (let i = 0; i < table.outputs.length; i++) {
    const assignment: Record<string, boolean> = {};
    for (let v = 0; v < table.varCount; v++) {
      assignment[names[v]] = ((i >> (table.varCount - 1 - v)) & 1) === 1;
    }
    if (evalExpr(expr, assignment) !== table.outputs[i]) return false;
  }
  return true;
}

// ── countGates ────────────────────────────────────────────────────────────────

describe('countGates', () => {
  it('counts 0 gates for a positive literal', () => {
    expect(countGates({ kind: 'lit', var: 'A', neg: false })).toBe(0);
  });

  it('counts 1 gate for a negated literal (one NOT gate)', () => {
    expect(countGates({ kind: 'lit', var: 'A', neg: true })).toBe(1);
  });

  it('counts 1 gate for AND(A, B)', () => {
    const expr: Expr = {
      kind: 'and',
      children: [
        { kind: 'lit', var: 'A', neg: false },
        { kind: 'lit', var: 'B', neg: false },
      ],
    };
    expect(countGates(expr)).toBe(1);
  });

  it('counts 2 gates for AND(A, B, C) — two chained AND gates', () => {
    const expr: Expr = {
      kind: 'and',
      children: [
        { kind: 'lit', var: 'A', neg: false },
        { kind: 'lit', var: 'B', neg: false },
        { kind: 'lit', var: 'C', neg: false },
      ],
    };
    expect(countGates(expr)).toBe(2);
  });

  it('counts 1 gate for XOR(A, B)', () => {
    const expr: Expr = { kind: 'xor', left: { kind: 'lit', var: 'A', neg: false }, right: { kind: 'lit', var: 'B', neg: false } };
    expect(countGates(expr)).toBe(1);
  });

  it('counts 1 gate for XNOR(A, B)', () => {
    const expr: Expr = { kind: 'xnor', left: { kind: 'lit', var: 'A', neg: false }, right: { kind: 'lit', var: 'B', neg: false } };
    expect(countGates(expr)).toBe(1);
  });

  it('counts 1 gate for NAND(A, B)', () => {
    const expr: Expr = {
      kind: 'nand',
      children: [{ kind: 'lit', var: 'A', neg: false }, { kind: 'lit', var: 'B', neg: false }],
    };
    expect(countGates(expr)).toBe(1);
  });

  it('counts 1 gate for NOR(A, B)', () => {
    const expr: Expr = {
      kind: 'nor',
      children: [{ kind: 'lit', var: 'A', neg: false }, { kind: 'lit', var: 'B', neg: false }],
    };
    expect(countGates(expr)).toBe(1);
  });

  it('shares a single NOT gate for the same negated variable used twice', () => {
    // (¬A ∧ B) ∨ (¬A ∧ C)  — ¬A used in both terms, but only one NOT gate
    const expr: Expr = {
      kind: 'or',
      children: [
        { kind: 'and', children: [{ kind: 'lit', var: 'A', neg: true }, { kind: 'lit', var: 'B', neg: false }] },
        { kind: 'and', children: [{ kind: 'lit', var: 'A', neg: true }, { kind: 'lit', var: 'C', neg: false }] },
      ],
    };
    // 1 NOT(A) + 2 AND + 1 OR = 4 gates
    expect(countGates(expr)).toBe(4);
  });
});

// ── minimize: correctness ─────────────────────────────────────────────────────

describe('minimize — semantic correctness', () => {
  it('produces a correct expression for AND(A,B)', () => {
    const table = tt2([false, false, false, true]);
    const { expr } = minimize(table);
    expect(matchesTruthTable(expr, table)).toBe(true);
  });

  it('produces a correct expression for OR(A,B)', () => {
    const table = tt2([false, true, true, true]);
    const { expr } = minimize(table);
    expect(matchesTruthTable(expr, table)).toBe(true);
  });

  it('produces a correct expression for NAND(A,B)', () => {
    const table = tt2([true, true, true, false]);
    const { expr } = minimize(table);
    expect(matchesTruthTable(expr, table)).toBe(true);
  });

  it('produces a correct expression for NOR(A,B)', () => {
    const table = tt2([true, false, false, false]);
    const { expr } = minimize(table);
    expect(matchesTruthTable(expr, table)).toBe(true);
  });

  it('produces a correct expression for XOR(A,B)', () => {
    const table = tt2([false, true, true, false]);
    const { expr } = minimize(table);
    expect(matchesTruthTable(expr, table)).toBe(true);
  });

  it('produces a correct expression for XNOR(A,B)', () => {
    const table = tt2([true, false, false, true]);
    const { expr } = minimize(table);
    expect(matchesTruthTable(expr, table)).toBe(true);
  });

  it('produces a correct expression for a 3-variable majority function', () => {
    // Majority(A,B,C) = 1 iff at least two inputs are 1
    // minterms: 011=3, 101=5, 110=6, 111=7
    const outputs = [false, false, false, true, false, true, true, true];
    const table = tt3(outputs);
    const { expr } = minimize(table);
    expect(matchesTruthTable(expr, table)).toBe(true);
  });

  it('produces a correct expression for an arbitrary 3-variable function', () => {
    // f = 1 for rows 0,2,5,7  (A≡C, i.e. XNOR-like pattern with 3 vars)
    const outputs = [true, false, true, false, false, true, false, true];
    const table = tt3(outputs);
    const { expr } = minimize(table);
    expect(matchesTruthTable(expr, table)).toBe(true);
  });
});

// ── minimize: gate counts ─────────────────────────────────────────────────────

describe('minimize — gate count optimality', () => {
  it('minimizes AND(A,B) to exactly 1 gate', () => {
    const { gateCount } = minimize(tt2([false, false, false, true]));
    expect(gateCount).toBe(1);
  });

  it('minimizes OR(A,B) to exactly 1 gate', () => {
    const { gateCount } = minimize(tt2([false, true, true, true]));
    expect(gateCount).toBe(1);
  });

  it('minimizes XOR(A,B) to exactly 1 gate via XOR recognition', () => {
    const { gateCount } = minimize(tt2([false, true, true, false]));
    expect(gateCount).toBe(1);
  });

  it('minimizes XNOR(A,B) to exactly 1 gate via XNOR recognition', () => {
    const { gateCount } = minimize(tt2([true, false, false, true]));
    expect(gateCount).toBe(1);
  });

  it('minimizes NAND(A,B) to exactly 1 gate via NAND recognition', () => {
    const { gateCount } = minimize(tt2([true, true, true, false]));
    expect(gateCount).toBe(1);
  });

  it('minimizes NOR(A,B) to exactly 1 gate via NOR recognition', () => {
    const { gateCount } = minimize(tt2([true, false, false, false]));
    expect(gateCount).toBe(1);
  });

  it('majority function gate count is non-zero and reasonable', () => {
    const outputs = [false, false, false, true, false, true, true, true];
    const { gateCount } = minimize(tt3(outputs));
    expect(gateCount).toBeGreaterThan(0);
    expect(gateCount).toBeLessThanOrEqual(8);
  });
});

// ── minimize: reported gateCount matches countGates(expr) ────────────────────

describe('minimize — gateCount consistency', () => {
  const tables: TruthTable[] = [
    tt2([false, false, false, true]),
    tt2([false, true, true, false]),
    tt2([true,  false, false, true]),
    tt2([true,  true,  true,  false]),   // NAND
    tt2([true,  false, false, false]),   // NOR
    tt3([false, false, false, true, false, true, true, true]),
    tt3([true,  false, true, false, false, true, false, true]),
    { varCount: 4, outputs: Array.from({ length: 16 }, (_, i) => i % 3 === 0) },
  ];

  for (const table of tables) {
    it(`gateCount in result equals countGates(expr) for varCount=${table.varCount}`, () => {
      const result = minimize(table);
      expect(result.gateCount).toBe(countGates(result.expr));
    });
  }
});

// ── minimize: throws on constant truth tables ────────────────────────────────

describe('minimize — constant truth tables', () => {
  it('throws for all-false outputs', () => {
    expect(() => minimize(tt2([false, false, false, false]))).toThrow();
  });

  it('throws for all-true outputs', () => {
    expect(() => minimize(tt2([true, true, true, true]))).toThrow();
  });
});
