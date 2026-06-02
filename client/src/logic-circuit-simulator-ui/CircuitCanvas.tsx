import React, { useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import type { CircuitState, NodeId, Position } from '../logic-circuit-simulator-engine/index.js';
import type { PendingWire, ZoomState } from './types.js';
import { GateNode }        from './GateNode.js';
import { CircuitInput }    from './CircuitInput.js';
import { CircuitOutput }   from './CircuitOutput.js';
import { WireSplitPoint }  from './WireSplitPoint.js';
import { WireComponent }   from './WireComponent.js';
import { wirePath, getOutputPort } from './utils.js';
import './CircuitCanvas.css';

export const CANVAS_DROP_ID = 'circuit-canvas';

interface CircuitCanvasProps {
  cs:           CircuitState;
  pending:      PendingWire | null;
  zoomState:    ZoomState;
  onZoomChange: (z: ZoomState) => void;
  onNodeDrag:   (nodeId: NodeId, pos: Position) => void;
  onNodeDelete: (nodeId: NodeId) => void;
  onInputToggle:(nodeId: NodeId) => void;
  onOutPort:    (nodeId: NodeId, portIndex: number, e: React.MouseEvent) => void;
  onInPort:     (nodeId: NodeId, portIndex: number) => void;
  onWireDelete: (wireId: string) => void;
  onPendingMove:(pos: Position) => void;
  onCancelPending: () => void;
}

export function CircuitCanvas({
  cs, pending, zoomState, onZoomChange,
  onNodeDrag, onNodeDelete, onInputToggle,
  onOutPort, onInPort, onWireDelete,
  onPendingMove, onCancelPending,
}: CircuitCanvasProps) {

  const svgRef      = useRef<SVGSVGElement>(null);
  const dragRef     = useRef<{ nodeId: NodeId; ox: number; oy: number } | null>(null);
  const movedRef    = useRef(false);

  // @dnd-kit: this div is the drop target for gates dragged from the palette
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: CANVAS_DROP_ID });

  // ── d3-zoom setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter(event => {
        // Always allow scroll-to-zoom; for drag-to-pan, only start on the background
        if (event.type === 'wheel') return true;
        const target = event.target as Element;
        return target.classList.contains('canvas-bg');
      })
      .on('zoom', event => {
        const t = event.transform;
        onZoomChange({ x: t.x, y: t.y, k: t.k });
      });

    select(svg).call(zoomBehavior);

    return () => { select(svg).on('.zoom', null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── SVG coordinate conversion ──────────────────────────────────────────────
  function toCircuit(e: React.MouseEvent): Position {
    const svg = svgRef.current!;
    const r   = svg.getBoundingClientRect();
    const sx  = e.clientX - r.left;
    const sy  = e.clientY - r.top;
    return {
      x: (sx - zoomState.x) / zoomState.k,
      y: (sy - zoomState.y) / zoomState.k,
    };
  }

  // ── Node drag handlers ─────────────────────────────────────────────────────
  function onNodeDown(e: React.MouseEvent, nodeId: NodeId) {
    if (pending) return;
    e.stopPropagation();
    const pos  = toCircuit(e);
    const node = cs.nodes.get(nodeId);
    if (!node) return;
    dragRef.current  = { nodeId, ox: pos.x - node.position.x, oy: pos.y - node.position.y };
    movedRef.current = false;
  }

  function onSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const pos = toCircuit(e);
    if (dragRef.current) {
      movedRef.current = true;
      onNodeDrag(dragRef.current.nodeId, {
        x: pos.x - dragRef.current.ox,
        y: pos.y - dragRef.current.oy,
      });
    }
    if (pending) onPendingMove(pos);
  }

  function onSvgMouseUp() {
    dragRef.current = null;
  }

  function onSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const t = e.target as SVGElement;
    if (t.classList.contains('canvas-bg') || t === svgRef.current) {
      onCancelPending();
    }
  }

  // ── Pending wire from-position ─────────────────────────────────────────────
  let pendingFrom: Position | null = null;
  if (pending) {
    const n = cs.nodes.get(pending.fromNodeId);
    if (n) pendingFrom = getOutputPort(n, pending.fromPortIndex);
  }

  const transform = `translate(${zoomState.x},${zoomState.y}) scale(${zoomState.k})`;
  const isEmpty   = cs.nodes.size === 0;

  return (
    <div
      ref={setDropRef}
      id={CANVAS_DROP_ID}
      className={`circuit-canvas-wrap${isOver ? ' circuit-canvas-wrap--over' : ''}`}
    >
      {isEmpty && (
        <div className="canvas-empty-hint">
          Drag gates from the palette below onto the canvas
        </div>
      )}

      <svg
        ref={svgRef}
        className={`circuit-canvas${pending ? ' circuit-canvas--wiring' : ''}`}
        width="100%"
        height="100%"
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={onSvgMouseUp}
        onClick={onSvgClick}
      >
        {/* Line-grid background (also the pan hit-target) */}
        <defs>
          <pattern id="cs-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40,0 L 0,0 0,40" fill="none" stroke="#1e1b3a" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect className="canvas-bg" x="0" y="0" width="100%" height="100%" fill="url(#cs-grid)" />

        {/* Zoomable/pannable content group */}
        <g transform={transform}>

          {/* Wires */}
          {Array.from(cs.wires.values()).map(w => (
            <WireComponent
              key={w.id}
              wire={w}
              cs={cs}
              onDblClick={() => onWireDelete(w.id)}
            />
          ))}

          {/* Pending wire preview */}
          {pendingFrom && pending && (
            <path
              d={wirePath(pendingFrom, { x: pending.mx, y: pending.my })}
              fill="none" stroke="#64ffda" strokeWidth={1.5}
              strokeDasharray="6 4" strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Nodes */}
          {Array.from(cs.nodes.values()).map(node => {
            const down     = (e: React.MouseEvent) => onNodeDown(e, node.id);
            const dbl      = (e: React.MouseEvent) => { e.stopPropagation(); onNodeDelete(node.id); };
            const outPort  = (e: React.MouseEvent, pi: number) => onOutPort(node.id, pi, e);
            const inPort   = (e: React.MouseEvent, pi: number) => onInPort(node.id, pi);

            if (node.type === 'gate') {
              return (
                <GateNode
                  key={node.id}
                  node={node}
                  hasPending={!!pending}
                  onDown={down}
                  onDblClick={dbl}
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
                  onDown={down}
                  onDblClick={dbl}
                  onClick={e => { if (!movedRef.current) { e.stopPropagation(); onInputToggle(node.id); } }}
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
                  onDown={down}
                  onDblClick={dbl}
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
  );
}
