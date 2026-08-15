import type { GateType } from '@boolean-logic/shared';
import type { CircuitNode, Position, Waypoint } from '../logic-circuit-simulator-engine/index.js';

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

// ── Wire path geometry (shared by Wire renderer and routing validation) ─────────

/**
 * Builds the full ordered list of axis-aligned turn-points for a wire,
 * including exit and entry stubs.  Matches the geometry of buildPendingPath.
 */
export function buildWirePoints(
  from: Position, fromDir: Position,
  waypoints: readonly Waypoint[],
  to: Position, toDir: Position,
  routeDir: 'H' | 'V',
): Position[] {
  const approxLen = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  const stub = Math.min(STUB_LEN, approxLen / 4);
  const exitPt:  Position = { x: from.x + fromDir.x * stub, y: from.y + fromDir.y * stub };
  const entryPt: Position = { x: to.x   - toDir.x  * stub, y: to.y   - toDir.y  * stub };

  const pts: Position[] = [from, exitPt];
  let cur = exitPt;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (i === 0) {
      if (Math.abs(fromDir.x) >= Math.abs(fromDir.y)) {
        const span = (wp.pos.x - cur.x) * fromDir.x;
        const tx   = cur.x + fromDir.x * Math.max(0, span * 0.5);
        pts.push({ x: tx, y: cur.y }, { x: tx, y: wp.pos.y }, wp.pos);
      } else {
        const span = (wp.pos.y - cur.y) * fromDir.y;
        const ty   = cur.y + fromDir.y * Math.max(0, span * 0.5);
        pts.push({ x: cur.x, y: ty }, { x: wp.pos.x, y: ty }, wp.pos);
      }
    } else if (wp.enterDir === 'H') {
      pts.push({ x: cur.x, y: wp.pos.y }, wp.pos);
    } else {
      pts.push({ x: wp.pos.x, y: cur.y }, wp.pos);
    }
    cur = wp.pos;
  }

  if (waypoints.length === 0) {
    if (routeDir === 'H') {
      const span = (entryPt.x - cur.x) * fromDir.x;
      const tx   = cur.x + fromDir.x * Math.max(0, span * 0.5);
      pts.push({ x: tx, y: cur.y }, { x: tx, y: entryPt.y }, entryPt);
    } else {
      const span = (entryPt.y - cur.y) * fromDir.y;
      const ty   = cur.y + fromDir.y * Math.max(0, span * 0.5);
      pts.push({ x: cur.x, y: ty }, { x: entryPt.x, y: ty }, entryPt);
    }
  } else if (routeDir === 'H') {
    pts.push({ x: cur.x, y: entryPt.y }, entryPt);
  } else {
    pts.push({ x: entryPt.x, y: cur.y }, entryPt);
  }

  pts.push(to);
  return pts;
}

/**
 * Removes consecutive duplicate points and collinear backtracking from an
 * axis-aligned point list so no segment is traversed twice.
 */
export function deduplicateWirePath(pts: Position[]): Position[] {
  const res: Position[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], last = res[res.length - 1];
    if (p.x !== last.x || p.y !== last.y) res.push(p);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i + 2 < res.length; i++) {
      const a = res[i], b = res[i + 1], c = res[i + 2];
      const horizontal = a.y === b.y && b.y === c.y;
      const vertical   = a.x === b.x && b.x === c.x;
      if (horizontal || vertical) {
        const dab = horizontal ? b.x - a.x : b.y - a.y;
        const dbc = horizontal ? c.x - b.x : c.y - b.y;
        if (dab !== 0 && dbc !== 0 && Math.sign(dab) !== Math.sign(dbc)) {
          res.splice(i + 1, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return res;
}

interface AABB { minX: number; minY: number; maxX: number; maxY: number; }

function nodeAABB(node: CircuitNode): AABB {
  const { x, y } = node.position;
  if (node.type === 'gate') {
    // Swap half-extents when rotated 90° or 270°.
    const [hw, hh] = (node.rotation === 0 || node.rotation === 180)
      ? [GATE_W / 2, GATE_H / 2]
      : [GATE_H / 2, GATE_W / 2];
    return { minX: x - hw, minY: y - hh, maxX: x + hw, maxY: y + hh };
  }
  if (node.type === 'input' || node.type === 'output') {
    // Square box (rotation doesn't affect the AABB of a square).
    return { minX: x - CIRC_R, minY: y - CIRC_R, maxX: x + CIRC_R, maxY: y + CIRC_R };
  }
  // Split: only the central body circle (r = 8).
  return { minX: x - 8, minY: y - 8, maxX: x + 8, maxY: y + 8 };
}

/**
 * Returns true if any axis-aligned segment in pts strictly passes through
 * the body of node (uses strict inequalities, so touching an edge is fine).
 */
export function wirePathHitsNode(pts: Position[], node: CircuitNode): boolean {
  const box = nodeAABB(node);
  for (let i = 0; i + 1 < pts.length; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    if (p1.y === p2.y) {
      // Horizontal segment at y = p1.y
      const sy = p1.y;
      if (sy > box.minY && sy < box.maxY) {
        const xMin = Math.min(p1.x, p2.x), xMax = Math.max(p1.x, p2.x);
        if (xMin < box.maxX && xMax > box.minX) return true;
      }
    } else if (p1.x === p2.x) {
      // Vertical segment at x = p1.x
      const sx = p1.x;
      if (sx > box.minX && sx < box.maxX) {
        const yMin = Math.min(p1.y, p2.y), yMax = Math.max(p1.y, p2.y);
        if (yMin < box.maxY && yMax > box.minY) return true;
      }
    }
  }
  return false;
}
