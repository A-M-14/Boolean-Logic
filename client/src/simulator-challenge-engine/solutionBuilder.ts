/**
 * Solution Builder — converts a minimized Boolean expression into a
 * CircuitState compatible with the Logic Circuit Simulator Engine.
 *
 * Layout: nodes are arranged in a structured left-to-right grid.
 *   Column 0                : input nodes (used variables only, top-to-bottom A → last)
 *   Column 1  (if needed)   : NOT gates for negated variables (same row as their input)
 *   Columns 2 .. depth+1   : expression gates (leaves → root, left to right)
 *   Final column            : output node (same row as root gate)
 *
 * Wire routing: for every binary gate, port-0's wire turns at
 *   gateX − GATE_W/2 − STUB_LEN  (one stub-length before the gate's left edge)
 * and port-1's wire turns at
 *   gateX − GATE_W/2 − 2·STUB_LEN (two stub-lengths before the left edge).
 * The 20 px difference guarantees distinct vertical x-coordinates so the two
 * wires never share any segment, even in multi-level circuits where both
 * children sit on the same side of the gate.
 *
 * Children are also sorted by y before connection: the smaller-y child always
 * goes to port 0 (top input) and the larger-y child to port 1 (bottom input).
 * This, combined with the turn-x stagger, ensures clean wire layouts for all
 * expression shapes produced by the circuit minimizer.
 */

import { CircuitStateManager } from '../logic-circuit-simulator-engine/index.js';
import type { NodeId, Waypoint } from '../logic-circuit-simulator-engine/index.js';
import type { GateType } from '../logic-circuit-simulator-engine/index.js';
import type { CircuitState } from '../logic-circuit-simulator-engine/index.js';
import type { Expr, MinimizationResult } from './types.js';
import { getNegatedVars } from './circuitMinimizer.js';

// ── Layout constants ───────────────────────────────────────────────────────────

const COL_W    = 130;  // horizontal spacing between columns (px)
const ROW_H    = 70;   // vertical spacing between node rows (px)
const GATE_W   = 88;   // gate body width — must match logic-circuit-simulator-ui/utils.ts
const STUB_LEN = 20;   // wire exit/entry stub length — must match utils.ts

const VAR_NAMES_ALL = ['A', 'B', 'C', 'D', 'E'];

// ── Internal helpers ───────────────────────────────────────────────────────────

/** A reference to a node's output port together with its column and y position. */
interface NodePort {
  readonly nodeId:    NodeId;
  readonly portIndex: number;
  readonly col:       number;  // x = col * COL_W
  readonly y:         number;  // vertical centre of the node
}

type Port = { nodeId: NodeId; portIndex: number };

/**
 * Returns the set of variable names that appear anywhere in `expr`.
 * Used to exclude input nodes for variables not referenced by the minimized
 * expression (e.g. variable B in a 3-variable challenge where the solution
 * only uses A and C).
 */
function getUsedVars(expr: Expr): Set<string> {
  const vars = new Set<string>();
  function collect(e: Expr): void {
    switch (e.kind) {
      case 'lit':  vars.add(e.var); break;
      case 'not':  collect(e.child); break;
      case 'and':
      case 'or':
      case 'nand':
      case 'nor':  e.children.forEach(collect); break;
      case 'xor':
      case 'xnor': collect(e.left); collect(e.right); break;
    }
  }
  collect(expr);
  return vars;
}

/**
 * Computes the waypoints and routeDir for one wire leading into a binary gate.
 *
 * Port 0 (top input):  turns at gateX − GATE_W/2 − 1·STUB_LEN
 * Port 1 (bottom input): turns at gateX − GATE_W/2 − 2·STUB_LEN
 *
 * These turn-x values differ by STUB_LEN (20 px), ensuring the two wires
 * always have distinct vertical segments and can never overlap.
 *
 * For adjacent columns (dstCol == srcCol + 1) a single waypoint suffices.
 * For non-adjacent columns the wire is routed through the inter-column channel
 * just right of the source, then travels horizontally in a safe lane (28 px
 * inside the gap between node rows) before turning at the gate.
 */
function gateWireWaypoints(
  srcCol: number, srcY: number,
  dstCol: number, gateX: number, gateY: number,
  portIndex: 0 | 1,
): { waypoints: readonly Waypoint[]; routeDir: 'H' | 'V' } {
  const turnX = gateX - GATE_W / 2 - (portIndex === 0 ? STUB_LEN : 2 * STUB_LEN);

  if (dstCol <= srcCol + 1) {
    // Adjacent columns: one waypoint pins the turn to the unique turnX.
    return {
      waypoints: [{ pos: { x: turnX, y: srcY }, enterDir: 'H' }],
      routeDir: 'H',
    };
  }

  // Non-adjacent: route through the inter-column channel just right of the
  // source, then cross to the turn point in a safe horizontal lane.
  const xCh1 = (srcCol + 0.5) * COL_W;
  const dir   = Math.sign(gateY - srcY) || 1;
  // 0.4 × ROW_H ≈ 28 px, which always falls in the safe gap between node rows
  // (gate half-height is 26 px, input-circle radius is 24 px — both < 28 px).
  const yGap  = srcY + dir * ROW_H * 0.4;

  return {
    waypoints: [
      { pos: { x: xCh1, y: srcY  }, enterDir: 'H' },
      { pos: { x: turnX, y: yGap }, enterDir: 'H' },
    ],
    routeDir: 'H',
  };
}

/**
 * Waypoints for a single-input wire (NOT gate or output node).
 * There is no port-conflict here, so the original channel-routing approach
 * is used: empty for adjacent columns, two-waypoint Z-route otherwise.
 */
function singleWireWaypoints(
  srcCol: number, srcY: number,
  dstCol: number, dstY: number,
): readonly Waypoint[] {
  if (dstCol <= srcCol + 1) return [];

  const xCh1   = (srcCol + 0.5) * COL_W;
  const xCh2   = (dstCol - 0.5) * COL_W;
  const dstRow  = Math.round(dstY / ROW_H);
  const yGap    = (dstRow - 0.5) * ROW_H;

  return [
    { pos: { x: xCh1, y: srcY }, enterDir: 'H' },
    { pos: { x: xCh2, y: yGap }, enterDir: 'H' },
  ];
}

/**
 * Creates one binary gate, connecting portA and portB to its two inputs.
 * The child with the smaller y is always assigned to port 0 (top input)
 * and the child with the larger y to port 1 (bottom input).
 * Each wire is given a unique turn-x so their vertical segments never share
 * any coordinate.
 */
function addBinaryGate(
  mgr:      CircuitStateManager,
  gateType: GateType,
  col:      number,
  y:        number,
  portA:    NodePort,
  portB:    NodePort,
): NodePort {
  const gateX = col * COL_W;
  const id    = mgr.addNode({ type: 'gate', gateType, position: { x: gateX, y } });

  // Sort so the smaller-y child connects to port 0 (top) and the larger-y
  // child connects to port 1 (bottom).
  const [p0, p1] = portA.y <= portB.y ? [portA, portB] : [portB, portA];

  const { waypoints: wp0, routeDir: rd0 } = gateWireWaypoints(p0.col, p0.y, col, gateX, y, 0);
  const { waypoints: wp1, routeDir: rd1 } = gateWireWaypoints(p1.col, p1.y, col, gateX, y, 1);

  mgr.addWire(toPort(p0), { nodeId: id, portIndex: 0 }, wp0, rd0);
  mgr.addWire(toPort(p1), { nodeId: id, portIndex: 1 }, wp1, rd1);

  return { nodeId: id, portIndex: 0, col, y };
}

/**
 * Recursively builds the expression sub-tree, creating gate nodes and wires.
 * Returns the output port of the top-most node created for `expr`.
 * `yCounter` is incremented each time a new expression gate is placed.
 */
function buildExprNode(
  expr:       Expr,
  mgr:        CircuitStateManager,
  inputMap:   Map<string, NodeId>,
  notMap:     Map<string, NodeId>,
  yCounter:   { value: number },
  nodeY:      Map<NodeId, number>,
): NodePort {
  switch (expr.kind) {

    // ── Leaf: literal ──────────────────────────────────────────────────────
    case 'lit': {
      if (expr.neg) {
        const id = notMap.get(expr.var);
        if (!id) throw new Error(`No NOT gate for negated variable ${expr.var}`);
        return { nodeId: id, portIndex: 0, col: 1, y: nodeY.get(id)! };
      }
      const id = inputMap.get(expr.var);
      if (!id) throw new Error(`Unknown variable ${expr.var}`);
      return { nodeId: id, portIndex: 0, col: 0, y: nodeY.get(id)! };
    }

    // ── NOT ────────────────────────────────────────────────────────────────
    case 'not': {
      // NOT on a bare literal is pre-built in notMap.
      if (expr.child.kind === 'lit') {
        return buildExprNode(
          { kind: 'lit', var: expr.child.var, neg: true },
          mgr, inputMap, notMap, yCounter, nodeY,
        );
      }
      const childPort = buildExprNode(expr.child, mgr, inputMap, notMap, yCounter, nodeY);
      const col = childPort.col + 1;
      const y   = yCounter.value++ * ROW_H;
      const id  = mgr.addNode({ type: 'gate', gateType: 'NOT', position: { x: col * COL_W, y } });
      mgr.addWire(toPort(childPort), { nodeId: id, portIndex: 0 },
        singleWireWaypoints(childPort.col, childPort.y, col, y));
      return { nodeId: id, portIndex: 0, col, y };
    }

    // ── NAND / NOR ────────────────────────────────────────────────────────
    case 'nand':
    case 'nor': {
      const innerType: GateType = expr.kind === 'nand' ? 'AND' : 'OR';
      const outerType: GateType = expr.kind === 'nand' ? 'NAND' : 'NOR';
      const childPorts = expr.children.map(c =>
        buildExprNode(c, mgr, inputMap, notMap, yCounter, nodeY)
      );
      let current = childPorts[0];
      for (let i = 1; i < childPorts.length - 1; i++) {
        const col = Math.max(current.col, childPorts[i].col) + 1;
        const y   = yCounter.value++ * ROW_H;
        current = addBinaryGate(mgr, innerType, col, y, current, childPorts[i]);
      }
      const last = childPorts[childPorts.length - 1];
      const col  = Math.max(current.col, last.col) + 1;
      const y    = yCounter.value++ * ROW_H;
      return addBinaryGate(mgr, outerType, col, y, current, last);
    }

    // ── XOR / XNOR ────────────────────────────────────────────────────────
    case 'xor':
    case 'xnor': {
      const leftPort  = buildExprNode(expr.left,  mgr, inputMap, notMap, yCounter, nodeY);
      const rightPort = buildExprNode(expr.right, mgr, inputMap, notMap, yCounter, nodeY);
      const col      = Math.max(leftPort.col, rightPort.col) + 1;
      const y        = yCounter.value++ * ROW_H;
      const gateType: GateType = expr.kind === 'xor' ? 'XOR' : 'XNOR';
      return addBinaryGate(mgr, gateType, col, y, leftPort, rightPort);
    }

    // ── AND / OR ───────────────────────────────────────────────────────────
    case 'and':
    case 'or': {
      const gateType: GateType = expr.kind === 'and' ? 'AND' : 'OR';
      const childPorts = expr.children.map(c =>
        buildExprNode(c, mgr, inputMap, notMap, yCounter, nodeY)
      );
      // Chain binary gates left-to-right: AND(a,b,c) → AND(AND(a,b), c)
      let current = childPorts[0];
      for (let i = 1; i < childPorts.length; i++) {
        const col = Math.max(current.col, childPorts[i].col) + 1;
        const y   = yCounter.value++ * ROW_H;
        current = addBinaryGate(mgr, gateType, col, y, current, childPorts[i]);
      }
      return current;
    }
  }
}

function toPort(np: NodePort): Port {
  return { nodeId: np.nodeId, portIndex: np.portIndex };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Converts a minimized Boolean expression into a CircuitState that the Logic
 * Circuit Simulator Engine can evaluate and the Circuit Canvas can display.
 *
 * @param result     Output of `minimize()`.
 * @param varCount   Number of truth-table input variables (3, 4, or 5).
 */
export function buildSolution(result: MinimizationResult, varCount: number): CircuitState {
  const { expr } = result;
  const mgr = new CircuitStateManager();

  // Only create input nodes for variables that appear in the expression.
  const usedVarSet = getUsedVars(expr);
  const names = VAR_NAMES_ALL.slice(0, varCount).filter(n => usedVarSet.has(n));

  // Determine which used variables appear negated (need a NOT gate).
  const negVarSet = getNegatedVars(expr);

  // nodeY maps each input/NOT node's ID to its y-coordinate so that
  // gateWireWaypoints can compute collision-free paths.
  const nodeY = new Map<NodeId, number>();

  // ── Column 0: input nodes (used variables only, top-to-bottom) ───────────
  const inputMap = new Map<string, NodeId>();
  names.forEach((name, i) => {
    const y  = i * ROW_H;
    const id = mgr.addNode({ type: 'input', label: name, value: null, position: { x: 0, y } });
    inputMap.set(name, id);
    nodeY.set(id, y);
  });

  // ── Column 1: NOT gates placed on the same row as their input ─────────────
  // Co-locating the NOT gate with its input keeps the A→A' wire horizontal and
  // avoids the NOT gate landing on a row already occupied by another variable.
  const notMap = new Map<string, NodeId>();
  if (negVarSet.size > 0) {
    for (const name of names) {
      if (negVarSet.has(name)) {
        const inputId = inputMap.get(name)!;
        const y  = nodeY.get(inputId)!;
        const id = mgr.addNode({ type: 'gate', gateType: 'NOT', position: { x: COL_W, y } });
        mgr.addWire({ nodeId: inputId, portIndex: 0 }, { nodeId: id, portIndex: 0 });
        notMap.set(name, id);
        nodeY.set(id, y);
      }
    }
  }

  // ── Expression gate tree ──────────────────────────────────────────────────
  const yCounter = { value: 0 };
  const outPort  = buildExprNode(expr, mgr, inputMap, notMap, yCounter, nodeY);

  // ── Final column: output node on the same row as the root gate ────────────
  const outCol = outPort.col + 1;
  const outId  = mgr.addNode({ type: 'output', position: { x: outCol * COL_W, y: outPort.y } });
  mgr.addWire(toPort(outPort), { nodeId: outId, portIndex: 0 });

  return mgr.getState();
}
