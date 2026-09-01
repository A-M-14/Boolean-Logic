/**
 * Circuit Minimizer — Quine-McCluskey Boolean minimization with post-passes.
 *
 * Main export: minimize(truthTable) → MinimizationResult
 * Passes (applied in order, best gate count wins):
 *   1. SOP  – Quine-McCluskey on onset (minterms)
 *   2. POS  – Quine-McCluskey on offset (maxterms), De Morgan conversion
 *   3. Complement + NOT gate – SOP of complement wrapped in a NOT gate
 *   4. XOR/XNOR recognition – replaces two-term sub-expressions with one gate
 *   5. Common factor extraction – factors shared AND sub-expressions from SOP terms
 */

import type { Expr, MinimizationResult, TruthTable } from './types.js';

// ── Implicant type ─────────────────────────────────────────────────────────────

type Trit = 0 | 1 | '-';
type Implicant = Trit[];

const VAR_NAMES_ALL = ['A', 'B', 'C', 'D', 'E'];

// ── Implicant utilities ────────────────────────────────────────────────────────

function toImplicant(minterm: number, varCount: number): Implicant {
  const imp: Trit[] = [];
  for (let i = varCount - 1; i >= 0; i--) {
    imp.push(((minterm >> i) & 1) as 0 | 1);
  }
  return imp;
}

function impKey(imp: Implicant): string {
  return imp.join('');
}

function countOnes(imp: Implicant): number {
  return imp.reduce((n: number, t) => n + (t === 1 ? 1 : 0), 0);
}

/**
 * Two implicants can be combined iff they have exactly the same dash positions
 * and differ in exactly one non-dash position.
 */
function canCombine(a: Implicant, b: Implicant): boolean {
  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (a[i] === '-' || b[i] === '-') return false;
      if (++diffs > 1) return false;
    }
  }
  return diffs === 1;
}

function combineImps(a: Implicant, b: Implicant): Implicant {
  return a.map((t, i) => (t === b[i] ? t : '-'));
}

function implicantCovers(pi: Implicant, minterm: number, varCount: number): boolean {
  for (let i = 0; i < varCount; i++) {
    const bit = (minterm >> (varCount - 1 - i)) & 1;
    if (pi[i] !== '-' && (pi[i] as number) !== bit) return false;
  }
  return true;
}

// ── Quine-McCluskey ────────────────────────────────────────────────────────────

function quineMcCluskey(minterms: number[], varCount: number): Implicant[] {
  if (minterms.length === 0) return [];

  // Deduplicate initial implicants.
  const initSeen = new Set<string>();
  let current: Implicant[] = [];
  for (const m of minterms) {
    const imp = toImplicant(m, varCount);
    const k = impKey(imp);
    if (!initSeen.has(k)) { initSeen.add(k); current.push(imp); }
  }

  const piSeen = new Set<string>();
  const primeImplicants: Implicant[] = [];

  while (current.length > 0) {
    const usedIdx = new Set<number>();
    const nextSeen = new Set<string>();
    const next: Implicant[] = [];

    // Group current implicants by their number of 1-bits.
    const groups = new Map<number, number[]>();
    for (let i = 0; i < current.length; i++) {
      const ones = countOnes(current[i]);
      let g = groups.get(ones);
      if (!g) { g = []; groups.set(ones, g); }
      g.push(i);
    }

    const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
    for (let k = 0; k < sortedKeys.length - 1; k++) {
      for (const i of groups.get(sortedKeys[k])!) {
        for (const j of groups.get(sortedKeys[k + 1])!) {
          if (canCombine(current[i], current[j])) {
            usedIdx.add(i);
            usedIdx.add(j);
            const c = combineImps(current[i], current[j]);
            const ck = impKey(c);
            if (!nextSeen.has(ck)) { nextSeen.add(ck); next.push(c); }
          }
        }
      }
    }

    // Implicants that were not combined in this round are prime implicants.
    for (let i = 0; i < current.length; i++) {
      if (!usedIdx.has(i)) {
        const k = impKey(current[i]);
        if (!piSeen.has(k)) { piSeen.add(k); primeImplicants.push(current[i]); }
      }
    }
    current = next;
  }

  return primeImplicants;
}

// ── Minimal cover (essential PIs + Petrick's method) ──────────────────────────

/** Remove any set in `terms` that is a superset of another set in `terms`. */
function absorb(terms: Set<number>[]): Set<number>[] {
  const result: Set<number>[] = [];
  outer: for (let i = 0; i < terms.length; i++) {
    for (let j = 0; j < terms.length; j++) {
      if (i === j) continue;
      const tj = terms[j];
      const ti = terms[i];
      // terms[j] is a proper subset of terms[i] → drop terms[i]
      if (tj.size < ti.size) {
        let sub = true;
        for (const x of tj) if (!ti.has(x)) { sub = false; break; }
        if (sub) continue outer;
      }
      // terms[j] equals terms[i] and appeared earlier → drop terms[i]
      if (tj.size === ti.size && j < i) {
        let eq = true;
        for (const x of tj) if (!ti.has(x)) { eq = false; break; }
        if (eq) continue outer;
      }
    }
    result.push(terms[i]);
  }
  return result;
}

function minimalCover(pis: Implicant[], minterms: number[], varCount: number): Implicant[] {
  if (minterms.length === 0 || pis.length === 0) return [];

  // coverage: PI key → set of minterm indices (0..minterms.length-1) covered
  const coverage = new Map<string, Set<number>>();
  for (const pi of pis) {
    const s = new Set<number>();
    for (let i = 0; i < minterms.length; i++) {
      if (implicantCovers(pi, minterms[i], varCount)) s.add(i);
    }
    coverage.set(impKey(pi), s);
  }

  // coveredBy: minterm index → list of PI keys covering it
  const coveredBy = new Map<number, string[]>();
  for (let i = 0; i < minterms.length; i++) coveredBy.set(i, []);
  for (const [k, s] of coverage) for (const i of s) coveredBy.get(i)!.push(k);

  const selected = new Set<string>();
  const covered  = new Set<number>();

  // Step 1: select essential PIs (only cover for some minterm).
  for (const [mintermIdx, piKeys] of coveredBy) {
    if (piKeys.length === 1) {
      const k = piKeys[0];
      if (!selected.has(k)) {
        selected.add(k);
        for (const m of coverage.get(k)!) covered.add(m);
      }
    }
  }

  // Step 2: Petrick's method for remaining uncovered minterms.
  //
  // Build the product-of-sums expression P where each sum factor lists the
  // (indices of) candidate PIs that cover one uncovered minterm.  Expanding P
  // via the distributive law yields every minimal cover; absorption prunes
  // redundant supersets at each step.  The smallest resulting set is chosen,
  // with ties broken by fewest total literals (more dashes = broader PIs).
  const uncoveredMinterms = [...coveredBy.keys()].filter(i => !covered.has(i));
  if (uncoveredMinterms.length > 0) {
    const candidatePIs  = pis.filter(pi => !selected.has(impKey(pi)));
    const candidateKeys = candidatePIs.map(impKey);

    // For each uncovered minterm, indices into candidatePIs that cover it.
    const mintermCoverers: number[][] = uncoveredMinterms.map(mintermIdx =>
      candidateKeys.reduce<number[]>((acc, k, i) => {
        if (coverage.get(k)!.has(mintermIdx)) acc.push(i);
        return acc;
      }, [])
    );

    // Initialise P from the first minterm's coverers.
    let P: Set<number>[] = mintermCoverers[0].map(i => new Set([i]));

    // Distribute each subsequent minterm's sum into P, then absorb.
    for (let m = 1; m < mintermCoverers.length; m++) {
      const newP: Set<number>[] = [];
      for (const term of P) {
        for (const pi of mintermCoverers[m]) {
          const newTerm = new Set(term);
          newTerm.add(pi);
          newP.push(newTerm);
        }
      }
      P = absorb(newP);
    }

    if (P.length > 0) {
      // Keep only minimum-cardinality sets.
      const minSize = Math.min(...P.map(t => t.size));
      const minimal = P.filter(t => t.size === minSize);

      // Tie-break: fewest total literals (non-dash positions) across all PIs.
      const countLits = (term: Set<number>) =>
        [...term].reduce((sum, i) => sum + candidatePIs[i].filter(t => t !== '-').length, 0);

      const best = minimal.reduce((a, b) => countLits(a) <= countLits(b) ? a : b);
      for (const i of best) selected.add(candidateKeys[i]);
    }
  }

  return pis.filter(pi => selected.has(impKey(pi)));
}

// ── Gate counting ──────────────────────────────────────────────────────────────

/**
 * Returns the set of variable names that appear negated somewhere in `expr`.
 * Each such variable requires one NOT gate shared across all uses.
 */
export function getNegatedVars(expr: Expr): Set<string> {
  const acc = new Set<string>();
  collectNegVars(expr, acc);
  return acc;
}

function collectNegVars(expr: Expr, acc: Set<string>): void {
  switch (expr.kind) {
    case 'lit':
      if (expr.neg) acc.add(expr.var);
      break;
    case 'not':
      if (expr.child.kind === 'lit') acc.add(expr.child.var);
      else collectNegVars(expr.child, acc);
      break;
    case 'and':
    case 'or':
    case 'nand':
    case 'nor':
      for (const c of expr.children) collectNegVars(c, acc);
      break;
    case 'xor':
    case 'xnor':
      collectNegVars(expr.left, acc);
      collectNegVars(expr.right, acc);
      break;
  }
}

/**
 * Counts the number of logic gates needed to implement `expr`:
 * - one NOT gate per unique negated variable (shared for all uses)
 * - for AND/OR of k operands: k-1 binary gates
 * - for XOR/XNOR: 1 gate
 * - for structural NOT (NOT on a non-literal sub-expression): 1 gate
 */
export function countGates(expr: Expr): number {
  return getNegatedVars(expr).size + countStructuralGates(expr);
}

function countStructuralGates(expr: Expr): number {
  switch (expr.kind) {
    case 'lit':  return 0;
    case 'not':
      // NOT on a literal is handled by collectNegVars; only a structural NOT adds a gate.
      return expr.child.kind === 'lit' ? 0 : 1 + countStructuralGates(expr.child);
    case 'and':
    case 'or':
    case 'nand':
    case 'nor':
      return (expr.children.length - 1) +
        expr.children.reduce((s, c) => s + countStructuralGates(c), 0);
    case 'xor':
    case 'xnor':
      return 1 + countStructuralGates(expr.left) + countStructuralGates(expr.right);
  }
}

// ── Expr builders from implicant covers ───────────────────────────────────────

/** Build a SOP Expr from an implicant cover of the onset. */
function sopToExpr(cover: Implicant[], varCount: number): Expr {
  const names = VAR_NAMES_ALL.slice(0, varCount);
  const terms: Expr[] = cover.map(imp => {
    const lits: Expr[] = [];
    for (let i = 0; i < imp.length; i++) {
      if (imp[i] !== '-') lits.push({ kind: 'lit', var: names[i], neg: imp[i] === 0 });
    }
    if (lits.length === 0) throw new Error('Unexpected all-dash implicant in non-constant function');
    return lits.length === 1 ? lits[0] : { kind: 'and', children: lits };
  });
  return terms.length === 1 ? terms[0] : { kind: 'or', children: terms };
}

/**
 * Build a POS Expr from an implicant cover of the offset (complement's minterms).
 * By De Morgan's law each implicant becomes a sum clause where:
 *   trit 0 → positive literal   (NOT of "variable = 0" = variable)
 *   trit 1 → negated literal    (NOT of "variable = 1" = NOT variable)
 *   trit '-' → variable absent
 */
function posToExpr(complementCover: Implicant[], varCount: number): Expr {
  const names = VAR_NAMES_ALL.slice(0, varCount);
  const clauses: Expr[] = complementCover.map(imp => {
    const lits: Expr[] = [];
    for (let i = 0; i < imp.length; i++) {
      if (imp[i] !== '-') lits.push({ kind: 'lit', var: names[i], neg: imp[i] === 1 });
    }
    if (lits.length === 0) throw new Error('Unexpected all-dash implicant in non-constant function');
    return lits.length === 1 ? lits[0] : { kind: 'or', children: lits };
  });
  return clauses.length === 1 ? clauses[0] : { kind: 'and', children: clauses };
}

// ── Post-minimization: XOR/XNOR recognition ───────────────────────────────────

type FlatLit = { var: string; neg: boolean };

/** Extract the flat literal list from a product term (lit or AND of lits). */
function getProductLits(expr: Expr): FlatLit[] | null {
  if (expr.kind === 'lit') return [{ var: expr.var, neg: expr.neg }];
  if (expr.kind === 'and') {
    const lits: FlatLit[] = [];
    for (const c of expr.children) {
      if (c.kind !== 'lit') return null;
      lits.push({ var: c.var, neg: c.neg });
    }
    return lits;
  }
  return null;
}

/**
 * If two product terms differ in exactly two variable polarities forming an
 * XOR or XNOR pattern, return the replacement Expr; otherwise null.
 *
 * XOR:  (shared ∧ A ∧ ¬B) ∨ (shared ∧ ¬A ∧ B)  →  shared ∧ (A ⊕ B)
 * XNOR: (shared ∧ A ∧ B)  ∨ (shared ∧ ¬A ∧ ¬B) →  shared ∧ (A ⊙ B)
 */
function tryXorXnorPair(t1: Expr, t2: Expr): Expr | null {
  const lits1 = getProductLits(t1);
  const lits2 = getProductLits(t2);
  if (!lits1 || !lits2 || lits1.length < 2 || lits1.length !== lits2.length) return null;

  // Sort both by variable name so we can compare position-by-position.
  const s1 = [...lits1].sort((a, b) => a.var.localeCompare(b.var));
  const s2 = [...lits2].sort((a, b) => a.var.localeCompare(b.var));

  // Must involve exactly the same variable set.
  if (!s1.every((l, i) => l.var === s2[i].var)) return null;

  // Find which positions differ in polarity.
  const diffIdx = s1
    .map((l, i) => (l.neg !== s2[i].neg ? i : -1))
    .filter(i => i >= 0);
  if (diffIdx.length !== 2) return null;

  const [i1, i2] = diffIdx;
  const vA    = s1[i1].var;
  const vB    = s1[i2].var;
  const negA1 = s1[i1].neg;
  const negB1 = s1[i2].neg;

  // XOR: the two differing vars have opposite polarities within term1.
  //   (A(pos) ∧ B(neg)) combined with (A(neg) ∧ B(pos)) → A ⊕ B
  // XNOR: the two differing vars have the same polarity within term1.
  //   (A(pos) ∧ B(pos)) combined with (A(neg) ∧ B(neg)) → A ⊙ B
  const gateKind: 'xor' | 'xnor' = (negA1 !== negB1) ? 'xor' : 'xnor';
  const gateExpr: Expr = {
    kind:  gateKind,
    left:  { kind: 'lit', var: vA, neg: false },
    right: { kind: 'lit', var: vB, neg: false },
  };

  const sharedLits = s1.filter((_, i) => i !== i1 && i !== i2);
  if (sharedLits.length === 0) return gateExpr;

  const sharedExpr: Expr = sharedLits.length === 1
    ? { kind: 'lit', var: sharedLits[0].var, neg: sharedLits[0].neg }
    : { kind: 'and', children: sharedLits.map(l => ({ kind: 'lit' as const, var: l.var, neg: l.neg })) };

  return { kind: 'and', children: [sharedExpr, gateExpr] };
}

/**
 * One XOR/XNOR pass: scan all pairs of top-level OR terms, apply the first
 * replacement that strictly reduces the gate count, then return.
 * Returns null when no improvement is found.
 */
function xorXnorPass(current: MinimizationResult): MinimizationResult | null {
  const { expr } = current;
  if (expr.kind !== 'or') return null;
  const terms = expr.children;

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const replacement = tryXorXnorPair(terms[i], terms[j]);
      if (replacement === null) continue;

      const remaining = terms.filter((_, k) => k !== i && k !== j);
      const newExpr: Expr = remaining.length === 0
        ? replacement
        : { kind: 'or', children: [...remaining, replacement] };

      const newCount = countGates(newExpr);
      if (newCount < current.gateCount) return { expr: newExpr, gateCount: newCount };
    }
  }
  return null;
}

// ── Post-minimization: common factor extraction ────────────────────────────────

/**
 * One common-factor pass: find the pair of OR terms that share the most common
 * literals (≥ 2), factor them out, and return the improved expression.
 * Returns null when no beneficial factoring exists.
 *
 * (shared ∧ r1) ∨ (shared ∧ r2)  →  shared ∧ (r1 ∨ r2)
 */
function commonFactorPass(current: MinimizationResult): MinimizationResult | null {
  const { expr } = current;
  if (expr.kind !== 'or') return null;
  const terms = expr.children;

  let bestSharedLen = 1;           // require at least 2 shared literals
  let bestI = -1;
  let bestJ = -1;

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const l1 = getProductLits(terms[i]);
      const l2 = getProductLits(terms[j]);
      if (!l1 || !l2) continue;
      const sharedLen = l1.filter(a => l2.some(b => b.var === a.var && b.neg === a.neg)).length;
      if (sharedLen > bestSharedLen) { bestSharedLen = sharedLen; bestI = i; bestJ = j; }
    }
  }
  if (bestI < 0) return null;

  const l1 = getProductLits(terms[bestI])!;
  const l2 = getProductLits(terms[bestJ])!;
  const shared = l1.filter(a => l2.some(b => b.var === a.var && b.neg === a.neg));
  const rest1  = l1.filter(a => !shared.some(s => s.var === a.var && s.neg === a.neg));
  const rest2  = l2.filter(a => !shared.some(s => s.var === a.var && s.neg === a.neg));

  const toLit  = (l: FlatLit): Expr => ({ kind: 'lit', var: l.var, neg: l.neg });
  const toAnd  = (lits: FlatLit[]): Expr =>
    lits.length === 1 ? toLit(lits[0]) : { kind: 'and', children: lits.map(toLit) };

  const sharedExpr: Expr = toAnd(shared);

  // Build factored body: shared ∧ (rest1 ∨ rest2)  or  shared ∧ rest   if one side is empty
  let factoredExpr: Expr;
  if (rest1.length === 0 && rest2.length === 0) {
    factoredExpr = sharedExpr;
  } else if (rest1.length === 0) {
    factoredExpr = { kind: 'and', children: [sharedExpr, toAnd(rest2)] };
  } else if (rest2.length === 0) {
    factoredExpr = { kind: 'and', children: [sharedExpr, toAnd(rest1)] };
  } else {
    factoredExpr = {
      kind: 'and',
      children: [sharedExpr, { kind: 'or', children: [toAnd(rest1), toAnd(rest2)] }],
    };
  }

  const remaining = terms.filter((_, k) => k !== bestI && k !== bestJ);
  const newExpr: Expr = remaining.length === 0
    ? factoredExpr
    : { kind: 'or', children: [...remaining, factoredExpr] };

  const newCount = countGates(newExpr);
  if (newCount < current.gateCount) return { expr: newExpr, gateCount: newCount };
  return null;
}

// ── Post-minimization: NAND/NOR collapse ──────────────────────────────────────

/**
 * If the top-level expression is NOT(AND(...)) or NOT(OR(...)), collapse it to
 * NAND(...) or NOR(...), saving exactly one gate (the structural NOT).
 * Returns null if the expression is not in that form.
 */
function nandNorCollapse(current: MinimizationResult): MinimizationResult | null {
  const { expr } = current;
  if (expr.kind !== 'not') return null;
  const child = expr.child;
  if (child.kind !== 'and' && child.kind !== 'or') return null;
  const newKind = child.kind === 'and' ? 'nand' : 'nor';
  const newExpr: Expr = { kind: newKind, children: child.children };
  const newCount = countGates(newExpr);
  if (newCount < current.gateCount) return { expr: newExpr, gateCount: newCount };
  return null;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function bestOf(candidates: MinimizationResult[]): MinimizationResult {
  return candidates.reduce((a, b) => (a.gateCount <= b.gateCount ? a : b));
}

// ── Main entry point ───────────────────────────────────────────────────────────

/**
 * Derives a minimized Boolean expression from a truth table using
 * Quine-McCluskey plus post-minimization passes.
 *
 * Throws if the truth table is constant (all-0 or all-1).
 */
export function minimize(truthTable: TruthTable): MinimizationResult {
  const { varCount, outputs } = truthTable;

  const minterms: number[] = [];
  const maxterms: number[] = [];
  for (let i = 0; i < outputs.length; i++) {
    (outputs[i] ? minterms : maxterms).push(i);
  }

  if (minterms.length === 0) throw new Error('Truth table is constant 0');
  if (maxterms.length === 0) throw new Error('Truth table is constant 1');

  const candidates: MinimizationResult[] = [];

  // ── Pass 1: SOP (onset) ──────────────────────────────────────────────────
  {
    const pis   = quineMcCluskey(minterms, varCount);
    const cover = minimalCover(pis, minterms, varCount);
    const expr  = sopToExpr(cover, varCount);
    candidates.push({ expr, gateCount: countGates(expr) });
  }

  // ── Pass 2: POS (offset → De Morgan) ────────────────────────────────────
  {
    const pis   = quineMcCluskey(maxterms, varCount);
    const cover = minimalCover(pis, maxterms, varCount);
    if (cover.length > 0) {
      const expr = posToExpr(cover, varCount);
      candidates.push({ expr, gateCount: countGates(expr) });
    }
  }

  // ── Pass 3: Complement output check (SOP of complement + NOT gate) ───────
  {
    const pis   = quineMcCluskey(maxterms, varCount);
    const cover = minimalCover(pis, maxterms, varCount);
    if (cover.length > 0) {
      const inner = sopToExpr(cover, varCount);
      const expr: Expr = { kind: 'not', child: inner };
      candidates.push({ expr, gateCount: countGates(inner) + 1 });
    }
  }

  // ── Pass 4: XOR/XNOR recognition (applied to best so far, iterated) ─────
  {
    let result = bestOf(candidates);
    let improved: MinimizationResult | null;
    while ((improved = xorXnorPass(result)) !== null) result = improved;
    candidates.push(result);
  }

  // ── Pass 5: Common factor extraction (applied to best so far, iterated) ──
  {
    let result = bestOf(candidates);
    let improved: MinimizationResult | null;
    while ((improved = commonFactorPass(result)) !== null) result = improved;
    candidates.push(result);
  }

  // ── Pass 6: NAND/NOR collapse — NOT(AND) → NAND, NOT(OR) → NOR ───────────
  {
    const improved = nandNorCollapse(bestOf(candidates));
    if (improved) candidates.push(improved);
  }

  return bestOf(candidates);
}
