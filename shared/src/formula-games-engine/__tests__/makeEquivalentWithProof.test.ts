import { describe, it, expect } from 'vitest';
import { generateEquivalenceRound } from '../formulaGenerator';
import { checkEquivalence } from '../expressionEvaluator';
import type {
  FormulaNode,
  EquivalenceProofStep,
  EquivalenceRound,
  Formula,
  Difficulty,
} from '../types';

// ─── helpers ───────────────────────────────────────────────────────────────

function serialize(node: FormulaNode): string {
  switch (node.type) {
    case 'variable': return node.name;
    case 'not':      return `NOT(${serialize(node.operand)})`;
    case 'binary':   return `${node.operator}(${serialize(node.left)},${serialize(node.right)})`;
  }
}

function wrap(root: FormulaNode, variables: readonly string[]): Formula {
  return { root, variables };
}

// Returns the binary operator of a node, or '' for non-binary nodes.
// Avoids verbose type narrowing in filter predicates.
const op = (n: FormulaNode): string => (n as any).operator ?? '';

// Collect all non-Given rule steps from N equivalent rounds at `difficulty`.
function ruleSteps(
  n: number,
  difficulty: Difficulty,
): Array<{ round: EquivalenceRound; step: EquivalenceProofStep }> {
  const out: Array<{ round: EquivalenceRound; step: EquivalenceProofStep }> = [];
  for (let i = 0; i < n; i++) {
    const round = generateEquivalenceRound(difficulty, true);
    if (!round.proof) continue;
    for (const step of round.proof.slice(1)) out.push({ round, step });
  }
  return out;
}

const VALID_RULE_NAMES = new Set([
  'Given', 'Commutativity', 'Double Negation',
  "De Morgan's", 'XOR expansion', 'XOR contraction', 'Distribution',
]);

// ─── structure ─────────────────────────────────────────────────────────────

describe('proof chain — structure', () => {

  it.each(['easy', 'medium', 'hard'] as const)(
    '%s: proof is present, starts with Given (no `on`), and every rule step has a valid ruleName and `on`',
    (difficulty) => {
      for (let i = 0; i < 30; i++) {
        const round = generateEquivalenceRound(difficulty, true);
        const proof = round.proof;

        expect(proof).toBeDefined();
        expect(proof!.length).toBeGreaterThanOrEqual(2);
        expect(proof![0].ruleName).toBe('Given');
        expect(proof![0].on).toBeUndefined();

        for (const step of proof!.slice(1)) {
          expect(VALID_RULE_NAMES.has(step.ruleName)).toBe(true);
          expect(step.on).toBeDefined();
        }
      }
    },
  );

  it.each(['easy', 'medium', 'hard'] as const)(
    '%s: last step formula equals formulaB root',
    (difficulty) => {
      for (let i = 0; i < 30; i++) {
        const round = generateEquivalenceRound(difficulty, true);
        const proof = round.proof!;
        expect(serialize(proof[proof.length - 1].formula))
          .toBe(serialize(round.formulaB.root));
      }
    },
  );

  it('formulaB is syntactically different from formulaA in ≥ 90 of 100 easy rounds', () => {
    let different = 0;
    for (let i = 0; i < 100; i++) {
      const round = generateEquivalenceRound('easy', true);
      if (serialize(round.formulaA.root) !== serialize(round.formulaB.root)) different++;
    }
    expect(different).toBeGreaterThanOrEqual(90);
  });

});

// ─── step count bounds ─────────────────────────────────────────────────────

describe('proof chain — step count bounds', () => {
  //   easy:   1 pass  × 5 max steps = 5 rule steps + 1 Given + 1 safety = 7
  //   medium: 2 passes × 5 max steps = 10 rule steps + 1 Given + 1 safety = 12
  //   hard:   3 passes × 5 max steps = 15 rule steps + 1 Given + 1 safety = 17

  it('easy: at most 7 proof steps', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateEquivalenceRound('easy', true).proof!.length).toBeLessThanOrEqual(7);
    }
  });

  it('medium: at most 12 proof steps', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateEquivalenceRound('medium', true).proof!.length).toBeLessThanOrEqual(12);
    }
  });

  it('hard: at most 17 proof steps', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateEquivalenceRound('hard', true).proof!.length).toBeLessThanOrEqual(17);
    }
  });

  it('hard rounds average more steps than easy rounds', () => {
    const avg = (d: Difficulty) =>
      Array.from({ length: 100 }, () => generateEquivalenceRound(d, true).proof!.length)
           .reduce((a, b) => a + b, 0) / 100;
    expect(avg('hard')).toBeGreaterThan(avg('easy'));
  });

});

// ─── logical correctness ───────────────────────────────────────────────────

describe('proof chain — logical correctness', () => {

  it.each(['easy', 'medium', 'hard'] as const)(
    '%s: every intermediate formula is logically equivalent to formulaA',
    (difficulty) => {
      for (let i = 0; i < 30; i++) {
        const round = generateEquivalenceRound(difficulty, true);
        for (const step of round.proof!.slice(1)) {
          const intermediate = wrap(step.formula, round.formulaA.variables);
          expect(checkEquivalence(round.formulaA, intermediate)).toBe(true);
        }
      }
    },
  );

  it.each(['easy', 'medium', 'hard'] as const)(
    '%s: no two proof steps share the same serialized formula (no cycles)',
    (difficulty) => {
      for (let i = 0; i < 30; i++) {
        const round = generateEquivalenceRound(difficulty, true);
        const seen = new Set<string>();
        for (const step of round.proof!) {
          const s = serialize(step.formula);
          expect(seen.has(s)).toBe(false);
          seen.add(s);
        }
      }
    },
  );

});

// ─── rule coverage ─────────────────────────────────────────────────────────

describe('rule coverage — all rules fire across many rounds', () => {

  it("easy: Commutativity, De Morgan's forward, and De Morgan's reverse all appear", () => {
    const steps = ruleSteps(300, 'easy');

    // Commutativity
    expect(steps.some(e => e.step.ruleName === 'Commutativity')).toBe(true);

    // De Morgan's forward: on = NOT wrapping a binary
    expect(steps.some(({ step }) =>
      step.ruleName === "De Morgan's" &&
      step.on!.type === 'not' &&
      step.on!.operand.type === 'binary',
    )).toBe(true);

    // De Morgan's reverse: on = binary whose both children are NOT
    expect(steps.some(({ step }) =>
      step.ruleName === "De Morgan's" &&
      step.on!.type === 'binary' &&
      step.on!.left.type === 'not' &&
      step.on!.right.type === 'not',
    )).toBe(true);
  });

  it('Double Negation elimination appears across easy rounds', () => {
    const steps = ruleSteps(500, 'easy');
    expect(steps.some(e => e.step.ruleName === 'Double Negation')).toBe(true);
  });

  it('medium/hard: XOR expansion appears', () => {
    const steps = ruleSteps(300, 'medium');
    expect(steps.some(e => e.step.ruleName === 'XOR expansion')).toBe(true);
  });

  it('hard: XOR contraction appears (pass 3 can undo pass 1 expansion when pass 2 leaves the node untouched)', () => {
    const steps = ruleSteps(500, 'hard');
    expect(steps.some(e => e.step.ruleName === 'XOR contraction')).toBe(true);
  });

  it('XOR expansion `on` is always an XOR node', () => {
    const steps = ruleSteps(300, 'medium');
    for (const { step } of steps.filter(e => e.step.ruleName === 'XOR expansion')) {
      expect(step.on!.type).toBe('binary');
      expect(op(step.on!)).toBe('XOR');
    }
  });

  it('XOR contraction `on` always matches pattern (A OR B) AND NOT(A AND B)', () => {
    const steps = ruleSteps(500, 'hard');
    for (const { step } of steps.filter(e => e.step.ruleName === 'XOR contraction')) {
      const on = step.on!;
      expect(on.type).toBe('binary');
      if (on.type !== 'binary') continue;
      expect(op(on)).toBe('AND');
      // left: A OR B
      expect(on.left.type).toBe('binary');
      expect(op(on.left)).toBe('OR');
      // right: NOT(A AND B)
      expect(on.right.type).toBe('not');
      if (on.right.type !== 'not') continue;
      expect(on.right.operand.type).toBe('binary');
      expect(op(on.right.operand)).toBe('AND');
    }
  });

  it('medium/hard: Distribution forward appears', () => {
    const steps = ruleSteps(300, 'medium');
    // Forward: on has a child with the other connective (e.g. AND has an OR child)
    const fwd = steps.some(({ step }) => {
      const on = step.on;
      return (
        on?.type === 'binary' &&
        step.ruleName === 'Distribution' &&
        (op(on.left) !== op(on) || op(on.right) !== op(on))
      );
    });
    expect(fwd).toBe(true);
  });

  it('hard: Distribution reverse (factoring) appears — on is (A AND B) OR (A AND C)', () => {
    const steps = ruleSteps(300, 'hard');
    const rev = steps.some(({ step }) => {
      const on = step.on;
      return (
        step.ruleName === 'Distribution' &&
        on?.type === 'binary' &&
        op(on) === 'OR' &&
        on.left.type  === 'binary' && op(on.left)  === 'AND' &&
        on.right.type === 'binary' && op(on.right) === 'AND'
      );
    });
    expect(rev).toBe(true);
  });

});

// ─── anti-reversal between passes ──────────────────────────────────────────

describe('anti-reversal — proof never revisits formulaA', () => {

  it.each(['easy', 'medium', 'hard'] as const)(
    '%s: no rule step formula equals formulaA (all pass-changes are preserved)',
    (difficulty) => {
      for (let i = 0; i < 100; i++) {
        const round = generateEquivalenceRound(difficulty, true);
        const formulaASer = serialize(round.formulaA.root);
        for (const step of round.proof!.slice(1)) {
          expect(serialize(step.formula)).not.toBe(formulaASer);
        }
      }
    },
  );

});
