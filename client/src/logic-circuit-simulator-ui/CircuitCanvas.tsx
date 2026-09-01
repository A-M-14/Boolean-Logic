import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { zoom as d3Zoom } from 'd3-zoom';
import { select } from 'd3-selection';
import type { CircuitState, NodeId, Position, Waypoint, WireId } from '../logic-circuit-simulator-engine/index.js';
import type { PendingWire, ZoomState } from './types.js';
import { GateNode }       from './GateNode.js';
import { CircuitInput }   from './CircuitInput.js';
import { CircuitOutput }  from './CircuitOutput.js';
import { WireSplitPoint } from './WireSplitPoint.js';
import { Wire }           from './Wire.js';
import { getOutputPort, CIRC_R, portWireDir, STUB_LEN } from './utils.js';
import './CircuitCanvas.css';

export const CANVAS_DROP_ID = 'circuit-canvas';

// ── Pending wire path builder ──────────────────────────────────────────────────

function buildPendingPath(
  from: Position, fromDir: Position,
  waypoints: readonly Waypoint[], mouse: Position, dir: 'H' | 'V',
): string {
  // Exit stub: straight segment leaving the port in its direction.
  const approxLen = Math.abs(mouse.x - from.x) + Math.abs(mouse.y - from.y);
  const stub = Math.min(STUB_LEN, approxLen / 4);
  const exitPt: Position = { x: from.x + fromDir.x * stub, y: from.y + fromDir.y * stub };

  // Single continuous path (no extra M commands — dash pattern stays unbroken).
  let d = `M${from.x},${from.y} L${exitPt.x},${exitPt.y}`;
  let cur = exitPt;

  // Waypoint segments.
  // Index 0 (first segment from exitPt): Z-shape — same formula as the
  // no-waypoints preview so the path doesn't change shape when clicking.
  // Index > 0: standard 2-segment L-bend using the stored enterDir.
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (i === 0) {
      if (Math.abs(fromDir.x) >= Math.abs(fromDir.y)) {
        const span = (wp.pos.x - cur.x) * fromDir.x;
        const tx   = cur.x + fromDir.x * Math.max(0, span * 0.5);
        d += ` L${tx},${cur.y} L${tx},${wp.pos.y} L${wp.pos.x},${wp.pos.y}`;
      } else {
        const span = (wp.pos.y - cur.y) * fromDir.y;
        const ty   = cur.y + fromDir.y * Math.max(0, span * 0.5);
        d += ` L${cur.x},${ty} L${wp.pos.x},${ty} L${wp.pos.x},${wp.pos.y}`;
      }
    } else if (wp.enterDir === 'H') {
      d += ` L${cur.x},${wp.pos.y} L${wp.pos.x},${wp.pos.y}`;
    } else {
      d += ` L${wp.pos.x},${cur.y} L${wp.pos.x},${wp.pos.y}`;
    }
    cur = wp.pos;
  }

  // Last segment to the mouse cursor.
  // No waypoints: Z-shape so the tip keeps pointing in the port's direction
  // and the rise/fall happens in the middle (not at the gate exit).
  //   H port: ─H─ midpoint ─V─ ─H─ mouse  (tip arrives horizontally)
  //   V port: ─V─ midpoint ─H─ ─V─ mouse  (tip arrives vertically)
  // With waypoints: standard 2-segment L-bend using the user-locked direction.
  if (waypoints.length === 0) {
    if (Math.abs(fromDir.x) >= Math.abs(fromDir.y)) {
      // H port — Z-shape with horizontal midpoint turn.
      const span = (mouse.x - cur.x) * fromDir.x; // positive if mouse is forward
      const tx   = cur.x + fromDir.x * Math.max(0, span * 0.5);
      d += ` L${tx},${cur.y} L${tx},${mouse.y} L${mouse.x},${mouse.y}`;
    } else {
      // V port — Z-shape with vertical midpoint turn.
      const span = (mouse.y - cur.y) * fromDir.y;
      const ty   = cur.y + fromDir.y * Math.max(0, span * 0.5);
      d += ` L${cur.x},${ty} L${mouse.x},${ty} L${mouse.x},${mouse.y}`;
    }
  } else if (dir === 'H') {
    d += ` L${cur.x},${mouse.y} L${mouse.x},${mouse.y}`;
  } else {
    d += ` L${mouse.x},${cur.y} L${mouse.x},${mouse.y}`;
  }

  return d;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface CircuitCanvasProps {
  cs:               CircuitState;
  pending:          PendingWire | null;
  zoomState:        ZoomState;
  /** Wires currently animating: maps wireId → future signal + animation duration. */
  propagatingWires: ReadonlyMap<WireId, { signal: boolean | undefined; durationMs: number }>;
  onZoomChange:     (z: ZoomState) => void;
  onNodeDrag:       (nodeId: NodeId, pos: Position) => void;
  onNodeDragEnd:    (nodeId: NodeId) => void;
  onNodeDelete:     (nodeId: NodeId) => void;
  onNodeRotate:     (nodeId: NodeId) => void;
  onOutPort:        (nodeId: NodeId, portIndex: number, e: React.MouseEvent) => void;
  /** Called when user completes a wire by clicking an input port. Includes any planted waypoints and the locked routing direction. */
  onInPort:         (nodeId: NodeId, portIndex: number, waypoints: Waypoint[], routeDir: 'H' | 'V') => void;
  onWireDelete:         (wireId: string) => void;
  onPendingMove:        (pos: Position) => void;
  onCancelPending:      () => void;
  onInputSetValue:      (nodeId: NodeId, value: boolean) => void;
  onSplitSetOutputCount:(nodeId: NodeId, count: number) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CircuitCanvas({
  cs, pending, zoomState, propagatingWires, onZoomChange,
  onNodeDrag, onNodeDragEnd, onNodeDelete, onNodeRotate,
  onOutPort, onInPort, onWireDelete,
  onPendingMove, onCancelPending, onInputSetValue, onSplitSetOutputCount,
}: CircuitCanvasProps) {

  const svgRef     = useRef<SVGSVGElement>(null);
  const dragRef      = useRef<{ nodeId: NodeId; ox: number; oy: number } | null>(null);
  const movedRef     = useRef(false);
  const clickTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref (not state) so it's always current in event handlers — no stale-closure issue.
  const lockedDirRef = useRef<'H' | 'V' | null>(null);

  const [contextMenuNodeId, setContextMenuNodeId] = useState<NodeId | null>(null);
  const [splitMenuNodeId,   setSplitMenuNodeId]   = useState<NodeId | null>(null);
  const [waypoints,         setWaypoints]         = useState<Waypoint[]>([]);
  // Ref that always mirrors `waypoints` so event-handler closures see the
  // latest list without depending on React re-renders.
  const waypointsRef = useRef<Waypoint[]>([]);
  waypointsRef.current = waypoints;

  // ── Remove zone ────────────────────────────────────────────────────────────
  const removeZoneRef    = useRef<HTMLDivElement>(null);
  const isOverRemoveRef  = useRef(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [isOverRemove,   setIsOverRemove]   = useState(false);

  // Clear wire state whenever the pending wire ends
  useEffect(() => {
    if (!pending) {
      waypointsRef.current = [];
      setWaypoints([]);
      lockedDirRef.current = null;
      if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    }
  }, [pending]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuNodeId) return;
    function handleOutside(e: PointerEvent) {
      if ((e.target as Element).closest?.('[data-context-menu]')) return;
      setContextMenuNodeId(null);
    }
    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, [contextMenuNodeId]);

  // Close split output-count menu on outside click
  useEffect(() => {
    if (!splitMenuNodeId) return;
    function handleOutside(e: PointerEvent) {
      if ((e.target as Element).closest?.('[data-split-menu]')) return;
      setSplitMenuNodeId(null);
    }
    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, [splitMenuNodeId]);

  // @dnd-kit drop target
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: CANVAS_DROP_ID });

  // ── d3-zoom ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter(event => {
        if (event.type === 'wheel') return true;
        return (event.target as Element).classList.contains('canvas-bg');
      })
      .on('zoom', event => {
        const t = event.transform;
        onZoomChange({ x: t.x, y: t.y, k: t.k });
      });
    select(svg).call(zoomBehavior);
    // Remove d3-zoom's built-in dblclick-to-zoom handler.  Its internal noevent()
    // calls stopImmediatePropagation(), which would swallow the dblclick before
    // React ever sees it — preventing our wire-cancel handler from firing.
    select(svg).on('dblclick.zoom', null);
    return () => { select(svg).on('.zoom', null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── SVG coordinate conversion ──────────────────────────────────────────────
  function toCircuit(e: React.MouseEvent): Position {
    const svg = svgRef.current!;
    const r   = svg.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - zoomState.x) / zoomState.k,
      y: (e.clientY - r.top  - zoomState.y) / zoomState.k,
    };
  }

  // ── Node drag ──────────────────────────────────────────────────────────────
  function onNodeDown(e: React.MouseEvent, nodeId: NodeId) {
    if (pending) return;
    e.stopPropagation();
    const pos  = toCircuit(e);
    const node = cs.nodes.get(nodeId);
    if (!node) return;
    dragRef.current  = { nodeId, ox: pos.x - node.position.x, oy: pos.y - node.position.y };
    movedRef.current = false;
  }

  function onMouseMove(e: React.MouseEvent) {
    const pos = toCircuit(e);
    if (dragRef.current) {
      if (!movedRef.current) {
        movedRef.current = true;
        setIsDraggingNode(true);
      }
      onNodeDrag(dragRef.current.nodeId, {
        x: pos.x - dragRef.current.ox,
        y: pos.y - dragRef.current.oy,
      });
      // Check whether cursor is inside the remove zone.
      if (removeZoneRef.current) {
        const rz   = removeZoneRef.current.getBoundingClientRect();
        const over = e.clientX >= rz.left && e.clientX <= rz.right &&
                     e.clientY >= rz.top  && e.clientY <= rz.bottom;
        if (over !== isOverRemoveRef.current) {
          isOverRemoveRef.current = over;
          setIsOverRemove(over);
        }
      }
    }
    if (pending) {
      if (lockedDirRef.current === null) {
        const wps = waypointsRef.current;
        if (wps.length > 0) {
          // After a waypoint: wait for at least 8px of deliberate movement before
          // locking direction — prevents a tiny accidental mouse shift at click
          // time from locking the wrong axis.
          const ref = wps[wps.length - 1].pos;
          const dx = pos.x - ref.x;
          const dy = pos.y - ref.y;
          if (Math.abs(dx) + Math.abs(dy) >= 8) {
            lockedDirRef.current = Math.abs(dx) >= Math.abs(dy) ? 'H' : 'V';
          }
        }
        // No waypoints: routing is port-direction-first; lockedDirRef stays
        // null until the first waypoint is planted.
      }
      onPendingMove(pos);
    }
  }

  function onMouseUp() {
    if (dragRef.current && movedRef.current) {
      if (isOverRemoveRef.current) {
        onNodeDelete(dragRef.current.nodeId);
      } else {
        onNodeDragEnd(dragRef.current.nodeId);
      }
    }
    dragRef.current         = null;
    isOverRemoveRef.current = false;
    setIsDraggingNode(false);
    setIsOverRemove(false);
  }

  // ── Canvas background interactions ────────────────────────────────────────
  function onSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const t = e.target as SVGElement;
    if (!(t.classList.contains('canvas-bg') || t === svgRef.current)) return;

    if (pending) {
      // While wiring: plant a waypoint.
      // Use a short timer so a rapid double-click can cancel without adding a waypoint.
      const circuitPos = toCircuit(e);
      if (clickTimer.current) return; // second tap of a dblclick — skip
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        // enterDir for the first waypoint is unused in rendering (the first
        // segment uses Z-shape computed geometrically from the source port).
        // For all waypoints it is the direction locked by mouse movement, which
        // is what buildPendingPath/buildWirePath use for segments i > 0.
        const enterDir: 'H' | 'V' = lockedDirRef.current ?? 'H';
        const newWp: Waypoint = { pos: circuitPos, enterDir };
        setWaypoints(wps => {
          const newWps = [...wps, newWp];
          // Update the ref synchronously so the very next mousemove sees the
          // new waypoint as its reference point when re-detecting direction.
          waypointsRef.current = newWps;
          // Reset locked direction — the next mouse move re-detects it from
          // the freshly planted waypoint, letting the user change direction.
          lockedDirRef.current = null;
          return newWps;
        });
      }, 220);
    } else {
      setContextMenuNodeId(null);
    }
  }

  function onSvgDblClick(e: React.MouseEvent<SVGSVGElement>) {
    const t = e.target as SVGElement;
    if (!(t.classList.contains('canvas-bg') || t === svgRef.current)) return;
    if (!pending) return;
    // Cancel the pending single-click timer and abort the whole wire
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    waypointsRef.current = [];
    setWaypoints([]);
    onCancelPending();
  }

  // ── Per-node interaction helpers ───────────────────────────────────────────
  function nodeClick(nodeId: NodeId) {
    return (e: React.MouseEvent) => {
      if (!movedRef.current) {
        e.stopPropagation();
        const type = cs.nodes.get(nodeId)?.type;
        if (type === 'input') {
          setSplitMenuNodeId(null);
          setContextMenuNodeId(id => id === nodeId ? null : nodeId);
        }
        if (type === 'split') {
          setContextMenuNodeId(null);
          setSplitMenuNodeId(id => id === nodeId ? null : nodeId);
        }
      }
    };
  }

  function nodeDbl(nodeId: NodeId) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      setContextMenuNodeId(null);
      onNodeRotate(nodeId);
    };
  }

  // ── Pending wire source port ───────────────────────────────────────────────
  let pendingFrom:    Position | null = null;
  let pendingFromDir: Position        = { x: 1, y: 0 }; // fallback: rightward
  if (pending) {
    const n = cs.nodes.get(pending.fromNodeId);
    if (n) {
      pendingFrom    = getOutputPort(n, pending.fromPortIndex);
      pendingFromDir = portWireDir(n.rotation);
    }
  }

  const occupiedOutPorts = new Set<string>();
  for (const wire of cs.wires.values()) {
    occupiedOutPorts.add(`${wire.from.nodeId}:${wire.from.portIndex}`);
  }

  const transform = `translate(${zoomState.x},${zoomState.y}) scale(${zoomState.k})`;
  const isEmpty   = cs.nodes.size === 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
    <div
      ref={setDropRef}
      id={CANVAS_DROP_ID}
      className={`circuit-canvas-wrap${isOver ? ' circuit-canvas-wrap--over' : ''}`}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {isEmpty && (
        <div className="canvas-empty-hint">
          Drag gates from the palette below onto the canvas
        </div>
      )}

      {/* Remove zone — shown only while dragging a canvas node */}
      {isDraggingNode && (
        <div
          ref={removeZoneRef}
          className={`remove-zone${isOverRemove ? ' remove-zone--hover' : ''}`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="remove-zone__icon">
            <path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" />
          </svg>
          <span>Remove</span>
        </div>
      )}

      <svg
        ref={svgRef}
        className={`circuit-canvas${pending ? ' circuit-canvas--wiring' : ''}`}
        width="100%"
        height="100%"
        onClick={onSvgClick}
        onDoubleClick={onSvgDblClick}
      >
        <defs>
          <pattern id="cs-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40,0 L 0,0 0,40" fill="none" stroke="#1e1b3a" strokeWidth="0.8" />
          </pattern>
          {/* Light-bulb glow filter for the signal-propagation dot.
              Three layers: large soft outer halo, tighter inner bloom,
              and the crisp dot on top — mimics an incandescent bulb. */}
          <filter id="wire-halo-glow" x="-800%" y="-800%" width="1700%" height="1700%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="outerGlow" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="9"  result="innerGlow" />
            <feMerge>
              <feMergeNode in="outerGlow" />
              <feMergeNode in="innerGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect className="canvas-bg" x="0" y="0" width="100%" height="100%" fill="url(#cs-grid)" />

        <g transform={transform}>

          {/* Wires */}
          {Array.from(cs.wires.values()).map(w => (
            <Wire
              key={w.id}
              wire={w}
              cs={cs}
              isPropagating={propagatingWires.has(w.id)}
              futureSignal={propagatingWires.get(w.id)?.signal}
              animDurationMs={propagatingWires.get(w.id)?.durationMs ?? 2400}
              animRev={propagatingWires.get(w.id)?.rev ?? 0}
              onDblClick={() => onWireDelete(w.id)}
            />
          ))}

          {/* Pending wire preview */}
          {pendingFrom && pending && (() => {
            // pendingDir drives the last segment when waypoints exist.
            // For no-waypoints, buildPendingPath uses the source port direction
            // directly, so pendingDir is unused in that case.
            let pendingDir: 'H' | 'V' = lockedDirRef.current ?? 'H';
            if (lockedDirRef.current === null && waypoints.length > 0) {
              const lastWp = waypoints[waypoints.length - 1];
              const dx = pending.mx - lastWp.pos.x;
              const dy = pending.my - lastWp.pos.y;
              pendingDir = Math.abs(dx) >= Math.abs(dy) ? 'H' : 'V';
            }
            return (
            <>
              <path
                d={buildPendingPath(pendingFrom, pendingFromDir, waypoints, { x: pending.mx, y: pending.my }, pendingDir)}
                fill="none" stroke="#64ffda" strokeWidth={1.5}
                strokeDasharray="6 4" strokeLinecap="round"
                style={{ pointerEvents: 'none' }}
              />
              {/* Waypoint markers — visible while dragging only */}
              {waypoints.map((wp, i) => (
                <circle
                  key={i}
                  cx={wp.pos.x} cy={wp.pos.y} r={4}
                  fill="#64ffda" stroke="#111827" strokeWidth={1.5}
                  style={{ pointerEvents: 'none' }}
                />
              ))}
            </>
            );
          })()}

          {/* Nodes */}
          {Array.from(cs.nodes.values()).map(node => {
            const down    = (e: React.MouseEvent) => onNodeDown(e, node.id);
            const dbl     = nodeDbl(node.id);
            const click   = nodeClick(node.id);
            const outPort = (e: React.MouseEvent, pi: number) => onOutPort(node.id, pi, e);
            // routeDir: for no-waypoints, use port-direction-first (same as
            // buildPendingPath); for with-waypoints, use user-locked direction.
            const inPort  = (e: React.MouseEvent, pi: number) => {
              let routeDir: 'H' | 'V';
              if (waypointsRef.current.length === 0 && pending) {
                const srcNode = cs.nodes.get(pending.fromNodeId);
                if (srcNode) {
                  const fd = portWireDir(srcNode.rotation);
                  // Z-shape arrives at destination H for H port, V for V port.
                  routeDir = Math.abs(fd.x) >= Math.abs(fd.y) ? 'H' : 'V';
                } else {
                  routeDir = lockedDirRef.current ?? 'H';
                }
              } else {
                routeDir = lockedDirRef.current ?? 'H';
              }
              onInPort(node.id, pi, waypointsRef.current, routeDir);
            };

            if (node.type === 'gate') {
              return (
                <GateNode
                  key={node.id}
                  node={node}
                  hasPending={!!pending}
                  outPortOccupied={occupiedOutPorts.has(`${node.id}:0`)}
                  onDown={down}
                  onDblClick={dbl}
                  onClick={click}
                  onOutPort={outPort}
                  onInPort={inPort}
                />
              );
            }
            if (node.type === 'input') {
              return (
                <CircuitInput
                  key={node.id}
                  node={node}
                  hasPending={!!pending}
                  outPortOccupied={occupiedOutPorts.has(`${node.id}:0`)}
                  onDown={down}
                  onDblClick={dbl}
                  onClick={click}
                  onOutPort={e => outPort(e, 0)}
                />
              );
            }
            if (node.type === 'output') {
              return (
                <CircuitOutput
                  key={node.id}
                  node={node}
                  cs={cs}
                  hasPending={!!pending}
                  onDown={down}
                  onDblClick={dbl}
                  onClick={click}
                  onInPort={e => inPort(e, 0)}
                />
              );
            }
            if (node.type === 'split') {
              return (
                <WireSplitPoint
                  key={node.id}
                  node={node}
                  hasPending={!!pending}
                  outPortsOccupied={Array.from({ length: node.outputCount }, (_, i) => occupiedOutPorts.has(`${node.id}:${i}`))}
                  onDown={down}
                  onDblClick={dbl}
                  onBodyClick={click}
                  onOutPort={outPort}
                  onInPort={e => inPort(e, 0)}
                />
              );
            }
            return null;
          })}

        </g>
      </svg>
    </div>

    {/* Split output-count selector portal */}
    {splitMenuNodeId && (() => {
      const node = cs.nodes.get(splitMenuNodeId);
      if (!node || node.type !== 'split') return null;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const cx  = rect.left + node.position.x * zoomState.k + zoomState.x;
      const top = rect.top  + node.position.y * zoomState.k + zoomState.y + 8 * zoomState.k + 6;
      return createPortal(
        <div
          className="split-count-selector"
          style={{ left: cx, top }}
          data-split-menu
        >
          {([2, 3, 4] as const).map(n => (
            <button
              key={n}
              className={`split-count-btn${node.outputCount === n ? ' split-count-btn--active' : ''}`}
              onPointerDown={e => {
                e.stopPropagation();
                onSplitSetOutputCount(splitMenuNodeId, n);
                setSplitMenuNodeId(null);
              }}
            >
              {n}
            </button>
          ))}
        </div>,
        document.body
      );
    })()}

    {/* Input value selector portal */}
    {contextMenuNodeId && (() => {
      const node = cs.nodes.get(contextMenuNodeId);
      if (!node || node.type !== 'input') return null;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const cx     = rect.left + node.position.x * zoomState.k + zoomState.x;
      const bottom = rect.top  + node.position.y * zoomState.k + zoomState.y + CIRC_R * zoomState.k;
      return createPortal(
        <div
          className="input-value-selector"
          style={{ left: cx, top: bottom + 6 }}
          data-context-menu
        >
          <button
            className="input-value-btn input-value-btn--0"
            onPointerDown={e => {
              e.stopPropagation();
              onInputSetValue(contextMenuNodeId, false);
              setContextMenuNodeId(null);
            }}
          >
            0
          </button>
          <button
            className="input-value-btn input-value-btn--1"
            onPointerDown={e => {
              e.stopPropagation();
              onInputSetValue(contextMenuNodeId, true);
              setContextMenuNodeId(null);
            }}
          >
            1
          </button>
        </div>,
        document.body
      );
    })()}
    </>
  );
}
