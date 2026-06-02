import type { GateType } from '@boolean-logic/shared';
import type { CircuitNode, Position } from '../logic-circuit-simulator-engine/index.js';

export const GATE_W = 88;
export const GATE_H = 52;
export const CIRC_R = 24;
export const PORT_R = 5.5;
export const HIT_R  = 12;

export const GATE_SYMBOLS: Record<GateType, string> = {
  AND: '∧', OR: '∨', XOR: '⊕', NOT: '¬', NAND: '↑', NOR: '↓', XNOR: '⊙',
};

export const GATE_TYPES: GateType[] = ['AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR', 'XNOR'];

export function inputPortCount(node: CircuitNode): number {
  if (node.type === 'output') return 1;
  if (node.type === 'split')  return 1;
  if (node.type === 'gate')   return node.gateType === 'NOT' ? 1 : 2;
  return 0;
}

export function outputPortCount(node: CircuitNode): number {
  if (node.type === 'input') return 1;
  if (node.type === 'gate')  return 1;
  if (node.type === 'split') return 2;
  return 0;
}

export function getInputPort(node: CircuitNode, i: number): Position {
  const p = node.position;
  if (node.type === 'output') return { x: p.x - CIRC_R, y: p.y };
  if (node.type === 'split')  return { x: p.x - 10, y: p.y };
  if (node.type === 'gate') {
    if (node.gateType === 'NOT') return { x: p.x - GATE_W / 2, y: p.y };
    return i === 0
      ? { x: p.x - GATE_W / 2, y: p.y - GATE_H / 4 }
      : { x: p.x - GATE_W / 2, y: p.y + GATE_H / 4 };
  }
  return p;
}

export function getOutputPort(node: CircuitNode, i: number): Position {
  const p = node.position;
  if (node.type === 'input') return { x: p.x + CIRC_R, y: p.y };
  if (node.type === 'gate')  return { x: p.x + GATE_W / 2, y: p.y };
  if (node.type === 'split') {
    return i === 0
      ? { x: p.x + 10, y: p.y - 12 }
      : { x: p.x + 10, y: p.y + 12 };
  }
  return p;
}

export function sigColor(s: boolean | undefined): string {
  if (s === true)  return '#facc15';   // yellow  = logic 1
  if (s === false) return '#ef4444';   // red     = logic 0
  return '#475569';                    // gray    = uncomputed
}

// Orthogonal (right-angle) routing matching the sketch
export function wirePath(a: Position, b: Position): string {
  const mx = (a.x + b.x) / 2;
  return `M${a.x},${a.y} L${mx},${a.y} L${mx},${b.y} L${b.x},${b.y}`;
}
