/**
 * Solution Builder — converts a minimized Boolean expression into a
 * CircuitState compatible with the Logic Circuit Simulator Engine.
 *
 * Layout: nodes are arranged in a structured left-to-right grid.
 *   Column 0                : input nodes (one per variable, top-to-bottom A → last)
 *   Column 1  (if needed)   : NOT gates for negated variables
 *   Columns 2 .. depth+1   : expression gates (leaves → root, left to right)
 *   Final column            : output node
 */

import { CircuitStateManager } from '../logic-circuit-simulator-engine/index.js';
import type { NodeId } from '../logic-circuit-simulator-engine/index.js';
import type { GateType } from '../logic-circuit-simulator-engine/index.js';
import type { CircuitState } from '../logic-circuit-simulator-engine/index.js';
import type { Expr, MinimizationResult } from './types.js';
import { getNegatedVars } from './circuitMinimizer.js';

// ── Layout constants ───────────────────────────────────────────────────────────

const COL_W = 130;   // horizontal spacing between columns (px)
const ROW_H = 70;    // vertical spacing between node rows (px)

const VAR_NAMES_ALL = ['A', 'B', 'C', 'D', 'E'];

// ── Internal helpers ───────────────────────────────────────────────────────────

/** A reference to a node's output port together with its column index. */
interface NodePort {
  readonly nodeId:    NodeId;
  readonly portIndex: number;
  readonly col:       number;   // determines x-coordinate: x = col * COL_W
}

type Port = { nodeId: NodeId; portIndex: number };

/**
 * Recursively builds the expression sub-tree, creating gate nodes and wires.
 * Returns the output port of the top-most node created (or reused) for `expr`.
 * `yCounter` is incremented each time a new gate node is placed.
 */
function buildExprNode(
  expr:       Expr,
  mgr:        CircuitStateManager,
  inputMap:   Map<string, NodeId>,
  notMap:     Map<string, NodeId>,
  yCounter:   { value: number },
): NodePort {
  switch (expr.kind) {
    // ── Leaf: literal ──────────────────────────────────────────────────────
    case 'lit': {
      if (expr.neg) {
        const id = notMap.get(expr.var);
        if (!id) throw new Error(`No NOT gate for negated variable ${expr.var}`);
        return { nodeId: id, portIndex: 0, col: 1 };
      }
      const id = inputMap.get(expr.var);
      if (!id) throw new Error(`Unknown variable ${expr.var}`);
      return { nodeId: id, portIndex: 0, col: 0 };
    }

    // ── NOT ────────────────────────────────────────────────────────────────
    case 'not': {
      // NOT on a bare literal is pre-built as a NOT gate in notMap.
      if (expr.child.kind === 'lit') {
        return buildExprNode({ kind: 'lit', var: expr.child.var, neg: true }, mgr, inputMap, notMap, yCounter);
      }
      const childPort = buildExprNode(expr.child, mgr, inputMap, notMap, yCounter);
      const col = childPort.col + 1;
      const y   = yCounter.value++ * ROW_H;
      const id  = mgr.addNode({ type: 'gate', gateType: 'NOT', position: { x: col * COL_W, y } });
      mgr.addWire(toPort(childPort), { nodeId: id, portIndex: 0 });
      return { nodeId: id, portIndex: 0, col };
    }

    // ── NAND / NOR ────────────────────────────────────────────────────────
    // NAND([a,b,c]) = NOT(AND(a,b,c))  built as  AND(a,b) → NAND(result,c)
    // This uses (k-2) inner AND/OR gates + 1 final NAND/NOR = k-1 gates total.
    case 'nand':
    case 'nor': {
      const innerType: GateType = expr.kind === 'nand' ? 'AND' : 'OR';
      const outerType: GateType = expr.kind === 'nand' ? 'NAND' : 'NOR';
      const childPorts = expr.children.map(c =>
        buildExprNode(c, mgr, inputMap, notMap, yCounter)
      );
      let current = childPorts[0];
      for (let i = 1; i < childPorts.length - 1; i++) {
        const col = Math.max(current.col, childPorts[i].col) + 1;
        const y   = yCounter.value++ * ROW_H;
        const id  = mgr.addNode({ type: 'gate', gateType: innerType, position: { x: col * COL_W, y } });
        mgr.addWire(toPort(current),       { nodeId: id, portIndex: 0 });
        mgr.addWire(toPort(childPorts[i]), { nodeId: id, portIndex: 1 });
        current = { nodeId: id, portIndex: 0, col };
      }
      const last = childPorts[childPorts.length - 1];
      const col  = Math.max(current.col, last.col) + 1;
      const y    = yCounter.value++ * ROW_H;
      const id   = mgr.addNode({ type: 'gate', gateType: outerType, position: { x: col * COL_W, y } });
      mgr.addWire(toPort(current), { nodeId: id, portIndex: 0 });
      mgr.addWire(toPort(last),    { nodeId: id, portIndex: 1 });
      return { nodeId: id, portIndex: 0, col };
    }

    // ── XOR / XNOR ────────────────────────────────────────────────────────
    case 'xor':
    case 'xnor': {
      const leftPort  = buildExprNode(expr.left,  mgr, inputMap, notMap, yCounter);
      const rightPort = buildExprNode(expr.right, mgr, inputMap, notMap, yCounter);
      const col = Math.max(leftPort.col, rightPort.col) + 1;
      const y   = yCounter.value++ * ROW_H;
      const gateType: GateType = expr.kind === 'xor' ? 'XOR' : 'XNOR';
      const id  = mgr.addNode({ type: 'gate', gateType, position: { x: col * COL_W, y } });
      mgr.addWire(toPort(leftPort),  { nodeId: id, portIndex: 0 });
      mgr.addWire(toPort(rightPort), { nodeId: id, portIndex: 1 });
      return { nodeId: id, portIndex: 0, col };
    }

    // ── AND / OR ───────────────────────────────────────────────────────────
    case 'and':
    case 'or': {
      const gateType: GateType = expr.kind === 'and' ? 'AND' : 'OR';
      const childPorts = expr.children.map(c =>
        buildExprNode(c, mgr, inputMap, notMap, yCounter)
      );

      // Chain binary gates left-to-right: AND(a,b,c) → AND(AND(a,b), c)
      let current = childPorts[0];
      for (let i = 1; i < childPorts.length; i++) {
        const col = Math.max(current.col, childPorts[i].col) + 1;
        const y   = yCounter.value++ * ROW_H;
        const id  = mgr.addNode({ type: 'gate', gateType, position: { x: col * COL_W, y } });
        mgr.addWire(toPort(current),      { nodeId: id, portIndex: 0 });
        mgr.addWire(toPort(childPorts[i]), { nodeId: id, portIndex: 1 });
        current = { nodeId: id, portIndex: 0, col };
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
  const mgr   = new CircuitStateManager();
  const names = VAR_NAMES_ALL.slice(0, varCount);

  // Determine which variables appear negated in the expression.
  const negVarSet = getNegatedVars(expr);

  // ── Column 0: input nodes (one per variable, top-to-bottom) ──────────────
  const inputMap = new Map<string, NodeId>();
  names.forEach((name, i) => {
    const id = mgr.addNode({ type: 'input', label: name, value: null, position: { x: 0, y: i * ROW_H } });
    inputMap.set(name, id);
  });

  // ── Column 1: NOT gates for each negated variable ─────────────────────────
  const notMap = new Map<string, NodeId>();
  const hasNot = negVarSet.size > 0;
  let notRow = 0;
  if (hasNot) {
    for (const name of names) {
      if (negVarSet.has(name)) {
        const id = mgr.addNode({ type: 'gate', gateType: 'NOT', position: { x: COL_W, y: notRow * ROW_H } });
        mgr.addWire({ nodeId: inputMap.get(name)!, portIndex: 0 }, { nodeId: id, portIndex: 0 });
        notMap.set(name, id);
        notRow++;
      }
    }
  }

  // ── Expression gate tree (columns 1/2 …) ─────────────────────────────────
  const yCounter = { value: 0 };
  const outPort  = buildExprNode(expr, mgr, inputMap, notMap, yCounter);

  // ── Final column: single output node ─────────────────────────────────────
  const outCol = outPort.col + 1;
  // Vertically centred among all gate rows placed so far.
  const outY   = Math.max(0, Math.floor((yCounter.value - 1) / 2)) * ROW_H;
  const outId  = mgr.addNode({ type: 'output', position: { x: outCol * COL_W, y: outY } });
  mgr.addWire(toPort(outPort), { nodeId: outId, portIndex: 0 });

  return mgr.getState();
}
