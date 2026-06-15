import React, { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { GateType } from '@boolean-logic/shared';
import {
  CircuitStateManager,
  propagateSignals,
} from '../logic-circuit-simulator-engine/index.js';
import type {
  CircuitState,
  NodeId,
  Position,
  Wire,
  WireId,
} from '../logic-circuit-simulator-engine/index.js';
import { getOutputPort, getInputPort } from './utils.js';
import type { SimulatorMode, ZoomState, PendingWire, PaletteItemData } from './types.js';
import { ZOOM_IDENTITY } from './types.js';
import { GateBody }          from './GateNode.js';
import { GatePalette }       from './GatePalette.js';
import { CircuitCanvas, CANVAS_DROP_ID } from './CircuitCanvas.js';
import { SimulatorControls } from './SimulatorControls.js';
import './CircuitSimulator.css';

// ── Animation helpers ──────────────────────────────────────────────────────────

/** Per-wire animation info stored in the propagatingWires map. */
type PropWireInfo = { signal: boolean | undefined; durationMs: number };

/** Speed constant and clamp bounds for wire animation duration. */
const WIRE_SPEED   = 0.25 / 3;   // SVG user units (px) per millisecond
const WIRE_MIN_MS  = 600;
const WIRE_MAX_MS  = 3000;

/** Manhattan path length of a wire across all its L-routed segments. */
function manhattanWireLength(wire: Wire, cs: CircuitState): number {
  const fromNode = cs.nodes.get(wire.from.nodeId);
  const toNode   = cs.nodes.get(wire.to.nodeId);
  if (!fromNode || !toNode) return 100;
  const pts: Position[] = [
    getOutputPort(fromNode, wire.from.portIndex),
    ...wire.waypoints,
    getInputPort(toNode, wire.to.portIndex),
  ];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
  }
  return total;
}

// ── Drag overlay: tiny gate preview shown while dragging from palette ─────────

const svgPreviewStyle: React.CSSProperties = {
  display: 'block',
  filter: 'drop-shadow(0 3px 8px #000a)',
  opacity: 0.92,
  pointerEvents: 'none',
};

function DragPreview({ data }: { data: PaletteItemData | null }) {
  if (!data) return null;

  if (data.kind === 'gate') {
    return (
      <svg width={100} height={58} viewBox="-56 -32 112 64" style={svgPreviewStyle}>
        <GateBody gateType={data.gateType} />
      </svg>
    );
  }

  if (data.kind === 'input') {
    return (
      <svg width={52} height={52} viewBox="-28 -28 56 56" style={svgPreviewStyle}>
        <rect x={-24} y={-24} width={48} height={48} rx={4}
          fill="#111827" stroke="#475569" strokeWidth={2} />
        <text x={0} y={0} textAnchor="middle" dominantBaseline="central"
          fill="#475569" fontSize={9} fontWeight={700}
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >INPUT</text>
      </svg>
    );
  }

  if (data.kind === 'output') {
    return (
      <svg width={52} height={52} viewBox="-28 -28 56 56" style={svgPreviewStyle}>
        <rect x={-24} y={-24} width={48} height={48} rx={4}
          fill="#111827" stroke="#475569" strokeWidth={2} />
        <text x={0} y={0} textAnchor="middle" dominantBaseline="central"
          fill="#475569" fontSize={9} fontWeight={700}
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >OUTPUT</text>
      </svg>
    );
  }

  if (data.kind === 'split') {
    return (
      <svg width={40} height={40} viewBox="-18 -20 40 40" style={svgPreviewStyle}>
        <line x1={0} y1={0} x2={10} y2={0} stroke="#64748b" strokeWidth={1.5} />
        <line x1={10} y1={-12} x2={10} y2={12} stroke="#64748b" strokeWidth={1.5} />
        <circle cx={0} cy={0} r={8} fill="#2d2a50" stroke="#64748b" strokeWidth={1.5} />
        <circle cx={10} cy={-12} r={5.5} fill="#151230" stroke="#64ffda88" strokeWidth={1.5} />
        <circle cx={10} cy={12} r={5.5} fill="#151230" stroke="#64ffda88" strokeWidth={1.5} />
        <circle cx={-10} cy={0} r={5.5} fill="#151230" stroke="#374151" strokeWidth={1.5} />
      </svg>
    );
  }

  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface CircuitSimulatorProps {
  onBack: () => void;
}

export function CircuitSimulator({ onBack }: CircuitSimulatorProps) {
  const managerRef = useRef(new CircuitStateManager());
  const [cs, setCs]         = useState<CircuitState>(() => managerRef.current.getState());
  const [mode, setMode]     = useState<SimulatorMode>('idle');
  const [pending, setPending] = useState<PendingWire | null>(null);
  const [zoomState, setZoomState] = useState<ZoomState>(ZOOM_IDENTITY);
  const [activeDrag, setActiveDrag] = useState<PaletteItemData | null>(null);

  // ── Propagation animation ──────────────────────────────────────────────────
  /** Partially-revealed circuit state shown during the propagation animation.
   *  null = not animating; the canvas renders the real `cs` instead. */
  const [animCs, setAnimCs] = useState<CircuitState | null>(null);
  /** Wires whose halos are currently traveling: wireId → future signal + duration. */
  const [propagatingWires, setPropagatingWires] =
    useState<ReadonlyMap<WireId, PropWireInfo>>(() => new Map<WireId, PropWireInfo>());
  /** Pending setTimeout handles so we can cancel mid-animation. */
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** Cancel any in-progress propagation animation and reset animation state. */
  function cancelAnimation() {
    if (animTimersRef.current.length === 0) return;
    for (const t of animTimersRef.current) clearTimeout(t);
    animTimersRef.current = [];
    setAnimCs(null);
    setPropagatingWires(new Map<WireId, PropWireInfo>());
  }

  // Clear timers if the component unmounts mid-animation.
  useEffect(() => {
    return () => { for (const t of animTimersRef.current) clearTimeout(t); };
  }, []);

  // Require 6 px movement before a palette item is considered a drag
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── Circuit state helpers ──────────────────────────────────────────────────
  function refresh(propagate = true) {
    cancelAnimation();
    const m = managerRef.current;
    if (propagate && mode === 'running') {
      const fresh = propagateSignals(m.getState());
      m.applySignals(fresh.wires);
    }
    setCs(m.getState());
  }

  function propagateAndRefresh() {
    cancelAnimation();
    const m     = managerRef.current;
    const fresh = propagateSignals(m.getState());
    m.applySignals(fresh.wires);
    setCs(m.getState());
  }

  // ── Simulator controls ─────────────────────────────────────────────────────

  function handleRun() {
    setMode('running');
    cancelAnimation();

    const m = managerRef.current;
    const finalState = propagateSignals(m.getState());
    m.applySignals(finalState.wires);
    setCs(m.getState());

    const { wires, nodes } = finalState;

    // Only animate wires that carry a defined signal.
    const signalWires = new Map(
      Array.from(wires.entries()).filter(([, w]) => w.signal !== undefined),
    );
    if (signalWires.size === 0) return;

    // ── 1. Wire durations ────────────────────────────────────────────────────
    const wireDurMap = new Map<WireId, number>();
    for (const [wireId, wire] of signalWires) {
      const len = manhattanWireLength(wire, finalState);
      wireDurMap.set(wireId, Math.min(Math.max(len / WIRE_SPEED, WIRE_MIN_MS), WIRE_MAX_MS));
    }

    // ── 2. Topological traversal → per-wire start times ─────────────────────
    // Each node becomes "ready" once all its incoming signal wires have arrived.
    const outgoing  = new Map<NodeId, WireId[]>();
    const inDegree  = new Map<NodeId, number>();
    for (const [nodeId] of nodes) { outgoing.set(nodeId, []); inDegree.set(nodeId, 0); }
    for (const [wireId, wire] of signalWires) {
      outgoing.get(wire.from.nodeId)!.push(wireId);
      inDegree.set(wire.to.nodeId, (inDegree.get(wire.to.nodeId) ?? 0) + 1);
    }

    const nodeReadyMs = new Map<NodeId, number>();
    const queue: NodeId[] = [];
    for (const [nodeId, deg] of inDegree) {
      if (deg === 0) { queue.push(nodeId); nodeReadyMs.set(nodeId, 0); }
    }

    const wireStartMs = new Map<WireId, number>();
    const wireEndMs   = new Map<WireId, number>();
    let totalMs = 0;

    for (let qi = 0; qi < queue.length; qi++) {
      const nodeId    = queue[qi];
      const readyTime = nodeReadyMs.get(nodeId) ?? 0;

      for (const wireId of (outgoing.get(nodeId) ?? [])) {
        const wire = signalWires.get(wireId)!;
        const dur  = wireDurMap.get(wireId)!;
        const et   = readyTime + dur;
        wireStartMs.set(wireId, readyTime);
        wireEndMs.set(wireId, et);
        totalMs = Math.max(totalMs, et);

        const toId     = wire.to.nodeId;
        nodeReadyMs.set(toId, Math.max(nodeReadyMs.get(toId) ?? 0, et));
        const newDeg = (inDegree.get(toId) ?? 1) - 1;
        inDegree.set(toId, newDeg);
        if (newDeg === 0) queue.push(toId);
      }
    }

    // ── 3. Initial state: all wires blank ────────────────────────────────────
    const blankWires = new Map(
      Array.from(wires.entries()).map(([id, w]) => [id, { ...w, signal: undefined as boolean | undefined }]),
    );

    // t=0 wires start synchronously in the same React batch as setAnimCs.
    const initProp = new Map<WireId, PropWireInfo>();
    for (const [wireId, st] of wireStartMs) {
      if (st === 0) {
        initProp.set(wireId, { signal: signalWires.get(wireId)?.signal, durationMs: wireDurMap.get(wireId)! });
      }
    }
    setAnimCs({ nodes, wires: blankWires });
    if (initProp.size > 0) setPropagatingWires(initProp);

    // ── 4. Schedule one callback per unique timestamp ────────────────────────
    type Evt = { starts: WireId[]; ends: WireId[] };
    const events = new Map<number, Evt>();
    const getEvt = (t: number): Evt => {
      if (!events.has(t)) events.set(t, { starts: [], ends: [] });
      return events.get(t)!;
    };
    for (const [wireId, st] of wireStartMs) {
      if (st > 0) getEvt(st).starts.push(wireId);
    }
    for (const [wireId, et] of wireEndMs) {
      getEvt(et).ends.push(wireId);
    }

    for (const [time, { starts, ends }] of events) {
      const t = setTimeout(() => {
        // Reveal finished wires first (so they appear colored as the dot departs).
        if (ends.length > 0) {
          setAnimCs(prev => {
            if (!prev) return prev;
            const nw = new Map(prev.wires);
            for (const wireId of ends) {
              const fw = wires.get(wireId);
              if (fw) nw.set(wireId, fw);
            }
            return { nodes: prev.nodes, wires: nw };
          });
          setPropagatingWires(prev => {
            const next = new Map(prev);
            for (const wireId of ends) next.delete(wireId);
            return next;
          });
        }
        // Then start newly-ready wires.
        if (starts.length > 0) {
          setPropagatingWires(prev => {
            const next = new Map(prev);
            for (const wireId of starts) {
              next.set(wireId, { signal: signalWires.get(wireId)?.signal, durationMs: wireDurMap.get(wireId)! });
            }
            return next;
          });
        }
      }, time);
      animTimersRef.current.push(t);
    }

    // ── 5. Final cleanup ─────────────────────────────────────────────────────
    const tDone = setTimeout(() => {
      setAnimCs(null);
      animTimersRef.current = [];
    }, totalMs + 50);
    animTimersRef.current.push(tDone);
  }

  function handleStop() {
    cancelAnimation();
    setMode('stopped');
  }

  function handleReset() {
    cancelAnimation();
    managerRef.current.resetSignals();
    setMode('idle');
    setCs(managerRef.current.getState());
  }

  function handleNodeRotate(nodeId: NodeId) {
    managerRef.current.rotateNode(nodeId);
    mode === 'running' ? propagateAndRefresh() : setCs(managerRef.current.getState());
  }

  function handleInputSetValue(nodeId: NodeId, value: boolean) {
    managerRef.current.setInputValue(nodeId, value);
    mode === 'running' ? propagateAndRefresh() : setCs(managerRef.current.getState());
  }

  function handleClear() {
    cancelAnimation();
    managerRef.current.clear();
    setMode('idle');
    setPending(null);
    setCs(managerRef.current.getState());
  }

  // ── DnD: drag from palette ─────────────────────────────────────────────────
  function onDragStart(event: DragStartEvent) {
    setActiveDrag((event.active.data.current as PaletteItemData) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (over?.id !== CANVAS_DROP_ID) return;

    const data = active.data.current as PaletteItemData | undefined;
    if (!data) return;

    // Compute drop position in circuit-space from the translated rect
    const droppedRect = active.rect.current.translated;
    const canvasEl    = document.getElementById(CANVAS_DROP_ID);
    if (!droppedRect || !canvasEl) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const sx = droppedRect.left + droppedRect.width  / 2 - canvasRect.left;
    const sy = droppedRect.top  + droppedRect.height / 2 - canvasRect.top;
    const cx = (sx - zoomState.x) / zoomState.k;
    const cy = (sy - zoomState.y) / zoomState.k;
    const position: Position = { x: cx, y: cy };

    const m = managerRef.current;
    if (data.kind === 'gate')   m.addNode({ type: 'gate',   gateType: data.gateType as GateType, position });
    if (data.kind === 'input')  m.addNode({ type: 'input', position });
    if (data.kind === 'output') m.addNode({ type: 'output', position });
    if (data.kind === 'split')  m.addNode({ type: 'split',  position });

    if (mode === 'running') {
      propagateAndRefresh();
    } else {
      setCs(m.getState());
    }
  }

  // ── Canvas interactions ────────────────────────────────────────────────────
  function handleNodeDrag(nodeId: NodeId, pos: Position) {
    managerRef.current.moveNode(nodeId, pos);
    refresh(false);      // don't re-propagate during a drag for performance
  }

  function handleNodeDragEnd(nodeId: NodeId) {
    managerRef.current.disconnectNode(nodeId);
    mode === 'running' ? propagateAndRefresh() : setCs(managerRef.current.getState());
  }

  function handleNodeDelete(nodeId: NodeId) {
    managerRef.current.removeNode(nodeId);
    if (pending?.fromNodeId === nodeId) setPending(null);
    mode === 'running' ? propagateAndRefresh() : setCs(managerRef.current.getState());
  }

  function handleOutPort(nodeId: NodeId, portIndex: number, e: React.MouseEvent) {
    e.stopPropagation();
    const svg = document.querySelector('.circuit-canvas') as SVGSVGElement | null;
    if (!svg) return;
    const r  = svg.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const mx = (sx - zoomState.x) / zoomState.k;
    const my = (sy - zoomState.y) / zoomState.k;
    setPending({ fromNodeId: nodeId, fromPortIndex: portIndex, mx, my });
  }

  function handleInPort(nodeId: NodeId, portIndex: number, waypoints: Position[]) {
    if (!pending) return;
    if (pending.fromNodeId === nodeId) { setPending(null); return; }
    managerRef.current.addWire(
      { nodeId: pending.fromNodeId, portIndex: pending.fromPortIndex },
      { nodeId, portIndex },
      waypoints,
    );
    setPending(null);
    mode === 'running' ? propagateAndRefresh() : setCs(managerRef.current.getState());
  }

  function handleWireDelete(wireId: string) {
    managerRef.current.removeWire(wireId);
    mode === 'running' ? propagateAndRefresh() : setCs(managerRef.current.getState());
  }

  function handlePendingMove(pos: Position) {
    setPending(p => p ? { ...p, mx: pos.x, my: pos.y } : null);
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="circuit-simulator">

        {/* Top bar */}
        <div className="cs-topbar">
          <div className="cs-topbar__left">
            <button className="game-back-btn" onClick={onBack}>← Back to Menu</button>
          </div>
          <div className="cs-topbar__center">
            <SimulatorControls
              mode={mode}
              hasNodes={cs.nodes.size > 0}
              onRun={handleRun}
              onStop={handleStop}
              onReset={handleReset}
              onClear={handleClear}
            />
          </div>
          <div className="cs-topbar__right" />
        </div>

        {/* Body — canvas fills all remaining space */}
        <div className="cs-body">
          <CircuitCanvas
            cs={animCs ?? cs}
            pending={pending}
            zoomState={zoomState}
            propagatingWires={propagatingWires}
            onZoomChange={setZoomState}
            onNodeDrag={handleNodeDrag}
            onNodeDragEnd={handleNodeDragEnd}
            onNodeDelete={handleNodeDelete}
            onNodeRotate={handleNodeRotate}
            onOutPort={handleOutPort}
            onInPort={handleInPort}
            onWireDelete={handleWireDelete}
            onPendingMove={handlePendingMove}
            onCancelPending={() => setPending(null)}
            onInputSetValue={handleInputSetValue}
          />
        </div>

        {/* Bottom toolbar: gate palette */}
        <div className="cs-bottombar">
          <GatePalette />
        </div>

      </div>

      {/* Drag overlay — shown while dragging from palette */}
      <DragOverlay>
        <DragPreview data={activeDrag} />
      </DragOverlay>
    </DndContext>
  );
}
