import React from 'react';
import type { FormulaNode, BinaryOperator } from '@boolean-logic/shared';
import type { FormulaNotation } from './types.js';
import './FormulaDisplay.css';

// ─── Gate symbol helpers ──────────────────────────────────────────────────────

function binarySymbol(operator: BinaryOperator, notation: FormulaNotation): string {
  switch (notation) {
    case 'mathematical':
      switch (operator) {
        case 'AND': return '\u2227';   // ∧
        case 'OR':  return '\u2228';   // ∨
        case 'XOR': return '\u2295';   // ⊕
      }
      break;
    case 'text':
      return operator.toLowerCase();   // 'and' | 'or' | 'xor'
    case 'c':
      switch (operator) {
        case 'AND': return '&';
        case 'OR':  return '|';
        case 'XOR': return '^';
      }
      break;
  }
}

// ─── Recursive renderer ───────────────────────────────────────────────────────

function renderNode(node: FormulaNode, notation: FormulaNotation): React.ReactNode {
  switch (node.type) {
    case 'variable':
      return <span className="formula-var">{node.name}</span>;

    case 'not': {
      const inner = renderNode(node.operand, notation);
      if (notation === 'mathematical') {
        // overline bar spanning the entire operand
        return <span className="formula-not">{inner}</span>;
      }
      if (notation === 'c') {
        // !x  or  !(x & y)  — parens already added by binary rendering
        return (
          <span className="formula-c-not">
            <span className="formula-op" style={{ margin: 0 }}>!</span>{inner}
          </span>
        );
      }
      // text: not(x)  or  not(x and y)
      // Binary operands already render with outer parens, so append directly.
      // Variable/not operands need explicit parens added.
      const needsParens = node.operand.type !== 'binary';
      return (
        <span className="formula-text-not">
          <span className="formula-op" style={{ margin: 0 }}>not</span>
          {needsParens && '('}
          {inner}
          {needsParens && ')'}
        </span>
      );
    }

    case 'binary': {
      const symbol = binarySymbol(node.operator, notation);
      return (
        <span className="formula-paren">
          ({renderNode(node.left, notation)}
          <span className="formula-op">{symbol}</span>
          {renderNode(node.right, notation)})
        </span>
      );
    }
  }
}

// ─── Public component ─────────────────────────────────────────────────────────

interface FormulaDisplayProps {
  node:       FormulaNode;
  /** Optional label shown to the left, e.g. "A" or "B" in equivalence mode. */
  label?:     string;
  notation?:  FormulaNotation;
}

export function FormulaDisplay({ node, label, notation = 'mathematical' }: FormulaDisplayProps) {
  return (
    <div className="formula-display">
      {label !== undefined && (
        <span className="formula-label">{label}</span>
      )}
      <span className="formula-root">{renderNode(node, notation)}</span>
    </div>
  );
}
