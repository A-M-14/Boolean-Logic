import type { GateType } from '@boolean-logic/shared';
import type { CircuitNode, Position } from '../logic-circuit-simulator-engine/index.js';

export const GATE_W   = 88;
export const GATE_H   = 52;
export const CIRC_R   = 24;
export const PORT_R   = 5.5;
export const HIT_R    = 12;   // click target radius for OUTPUT ports (start wire)
export const IN_HIT_R = 7;    // tighter click target for INPUT ports (complete wire)
export const STUB_LEN = 20;   // straight segment that always exits/enters a port in its direction

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
  if (node.type === 'split') return node.outputCount;
  return 0;
}

/** Rotates point p around center by deg degrees clockwise (matching SVG rotate). */
export function rotateAround(p: Position, center: Position, deg: number): Position {
  if (deg === 0) return p;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getInputPort(node: CircuitNode, i: number): Position {
  const p = node.position;
  let raw: Position;
  if (node.type === 'output') raw = { x: p.x - CIRC_R, y: p.y };
  else if (node.type === 'split') raw = { x: p.x - 10, y: p.y };
  else if (node.type === 'gate') {
    if (node.gateType === 'NOT') raw = { x: p.x - GATE_W / 2, y: p.y };
    else raw = i === 0
      ? { x: p.x - GATE_W / 2, y: p.y - GATE_H / 4 }
      : { x: p.x - GATE_W / 2, y: p.y + GATE_H / 4 };
  } else raw = p;
  return rotateAround(raw, p, node.rotation);
}

export function getOutputPort(node: CircuitNode, i: number): Position {
  const p = node.position;
  let raw: Position;
  if (node.type === 'input') raw = { x: p.x + CIRC_R, y: p.y };
  else if (node.type === 'gate') raw = { x: p.x + GATE_W / 2, y: p.y };
  else if (node.type === 'split') {
    const offset = (node.outputCount - 1) * 12;
    raw = { x: p.x + 10, y: p.y - offset + i * 24 };
  } else raw = p;
  return rotateAround(raw, p, node.rotation);
}

export function sigColor(s: boolean | undefined): string {
  if (s === true)  return '#facc15';   // yellow  = logic 1
  if (s === false) return '#ef4444';   // red     = logic 0
  return '#475569';                    // gray    = uncomputed
}

/**
 * Direction a wire must travel when attached to any port on a node with
 * the given rotation (= the port's outward normal, pointing away from the body).
 *   0°  → rightward  (+x)
 *   90° → downward   (+y)
 *  180° → leftward   (−x)
 *  270° → upward     (−y)
 */
export function portWireDir(rotation: 0 | 90 | 180 | 270): Position {
  if (rotation ===   0) return { x:  1, y:  0 };
  if (rotation ===  90) return { x:  0, y:  1 };
  if (rotation === 180) return { x: -1, y:  0 };
  return                       { x:  0, y: -1 };
}

/**
 * Orthogonal L-routing: goes horizontal-first when the horizontal distance
 * is greater or equal, vertical-first otherwise.
 */
export function wirePath(a: Position, b: Position): string {
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
    return `M${a.x},${a.y} L${b.x},${a.y} L${b.x},${b.y}`;
  } else {
    return `M${a.x},${a.y} L${a.x},${b.y} L${b.x},${b.y}`;
  }
}

/** Like wirePath but uses an explicit routing direction instead of auto-detecting. */
export function wirePathDir(a: Position, b: Position, dir: 'H' | 'V'): string {
  if (dir === 'H') {
    return `M${a.x},${a.y} L${b.x},${a.y} L${b.x},${b.y}`;
  } else {
    return `M${a.x},${a.y} L${a.x},${b.y} L${b.x},${b.y}`;
  }
}
