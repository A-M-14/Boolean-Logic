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
  propagateSignalsLayered,
} from '../logic-circuit-simulator-engine/index.js';
import type {
  CircuitState,
  InputNode,
  NodeId,
  Position,
  Waypoint,
  Wire,
  WireId,
} from '../logic-circuit-simulator-engine/index.js';
import { VAR_NAMES } from '../simulator-challenge-engine/types.js';
import { getOutputPort, getInputPort, portWireDir, buildWirePoints, deduplicateWirePath, wirePathHitsNode } from './utils.js';
import type { SimulatorMode, ZoomState, PendingWire, PaletteItemData } from './types.js';
import { ZOOM_IDENTITY } from './types.js';
import { GateBody }          from './GateNode.js';
import { GatePalette }       from './GatePalette.js';
import { CircuitCanvas, CANVAS_DROP_ID } from './CircuitCanvas.js';
import { SimulatorControls } from './SimulatorControls.js';
import './CircuitSimulator.css';

// ── Animation helpers ──────────────────────────────────────────────────────────

/** Per-wire animation info stored in the propagatingWires map. */
type PropWireInfo = { signal: boolean | undefined; durationMs: number; rev: number };

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
    ...wire.waypoints.map(w => w.pos),
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
  challengeMode?: boolean;
}

export function CircuitSimulator({ onBack, challengeMode }: CircuitSimulatorProps) {
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
      const fresh = propagateSignals(m.getState(), m.getStableSignals());
      m.applySignals(fresh.wires);
      m.saveStableSignals(fresh.wires);
    }
    setCs(m.getState());
  }

  function propagateAndRefresh() {
    cancelAnimation();
    const m     = managerRef.current;
    const fresh = propagateSignals(m.getState(), m.getStableSignals());
    m.applySignals(fresh.wires);
    m.saveStableSignals(fresh.wires);
    setCs(m.getState());
  }

  // ── Simulator controls ─────────────────────────────────────────────────────

  function handleRun() {
    setMode('running');
    cancelAnimation();

    const m = managerRef.current;
    const stableSignals = m.getStableSignals();

    // ── 1. Full fixed-point propagation (with seed from stable state) ─────────
    const { state: finalState, waves } = propagateSignalsLayered(m.getState(), stableSignals);
    m.applySignals(finalState.wires);
    m.saveStableSignals(finalState.wires);
    setCs(m.getState());

    if (waves.length === 0) return; // already stable — nothing to animate

    // ── 2. Initial animCs: all wires start gray; the dot reveals them ──────────
    const initWires = new Map<WireId, Wire>();
    for (const [wireId, wire] of finalState.wires) {
      initWires.set(wireId, { ...wire, signal: undefined });
    }

    // ── 3. Per-wire duration ──────────────────────────────────────────────────
    function wireMs(wireId: WireId): number {
      const wire = finalState.wires.get(wireId);
      if (!wire) return WIRE_MIN_MS;
      const len = manhattanWireLength(wire, finalState);
      return Math.min(Math.max(len / WIRE_SPEED, WIRE_MIN_MS), WIRE_MAX_MS);
    }

    // ── 4. Build wave events with sequential timing ───────────────────────────
    // Each wave animates all its wires simultaneously; next wave starts only
    // after the longest wire in the current wave finishes.
    //
    // wireRevMap ensures that if the same wire appears in multiple waves
    // (feedback confirmation), its animRev increments — retriggers Wire's
    // useEffect even though isPropagating stays true.
    type WaveEvent = {
      endMs:       number;
      propagating: Map<WireId, PropWireInfo>;
      reveal:      Map<WireId, boolean | undefined>;
    };

    const wireRevMap = new Map<WireId, number>();
    const waveEvents: WaveEvent[] = [];
    let cursor = 0;

    for (const waveEntries of waves) {
      let maxDur = 0;
      const propagating = new Map<WireId, PropWireInfo>();
      const reveal      = new Map<WireId, boolean | undefined>();

      for (const { wireId, signal } of waveEntries) {
        const durationMs = wireMs(wireId);
        const rev        = (wireRevMap.get(wireId) ?? 0) + 1;
        wireRevMap.set(wireId, rev);
        propagating.set(wireId, { signal, durationMs, rev });
        reveal.set(wireId, signal);
        maxDur = Math.max(maxDur, durationMs);
      }

      cursor += maxDur;
      waveEvents.push({ endMs: cursor, propagating, reveal });
    }

    const totalMs = cursor;

    // ── 5. Kick off animation ─────────────────────────────────────────────────
    setAnimCs({ nodes: finalState.nodes, wires: initWires });
    setPropagatingWires(waveEvents[0].propagating);

    // Schedule one timeout per wave-end: reveal that wave's signals, then
    // immediately start the next wave (or clear propagation if last wave).
    for (let wi = 0; wi < waveEvents.length; wi++) {
      const wave     = waveEvents[wi];
      const nextWave = waveEvents[wi + 1] ?? null;

      const t = setTimeout(() => {
        // Reveal this wave's wires with their wave signal.
        setAnimCs(prev => {
          if (!prev) return prev;
          const nw = new Map(prev.wires);
          for (const [wireId, signal] of wave.reveal) {
            const fw = finalState.wires.get(wireId);
            if (fw) nw.set(wireId, { ...fw, signal });
          }
          return { nodes: prev.nodes, wires: nw };
        });
        // Start next wave's halos (or clear if this was the last wave).
        setPropagatingWires(nextWave ? nextWave.propagating : new Map<WireId, PropWireInfo>());
      }, wave.endMs);

      animTimersRef.current.push(t);
    }

    // ── 6. Final cleanup ──────────────────────────────────────────────────────
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
    const m = managerRef.current;
    m.disconnectNode(nodeId);
    m.rotateNode(nodeId);
    mode === 'running' ? propagateAndRefresh() : setCs(m.getState());
  }

  function handleInputSetValue(nodeId: NodeId, value: boolean) {
    managerRef.current.setInputValue(nodeId, value);
    mode === 'running' ? propagateAndRefresh() : setCs(managerRef.current.getState());
  }

  function handleSplitSetOutputCount(nodeId: NodeId, count: number) {
    managerRef.current.setSplitOutputCount(nodeId, count);
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
    if (data.kind === 'input') {
      let label: string | undefined;
      if (challengeMode) {
        const usedLabels = new Set(
          [...cs.nodes.values()]
            .filter((n): n is InputNode => n.type === 'input')
            .map(n => n.label)
            .filter((l): l is string => l !== undefined),
        );
        label = VAR_NAMES.find(name => !usedLabels.has(name));
      }
      m.addNode({ type: 'input', label, position });
    }
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

  function handleInPort(nodeId: NodeId, portIndex: number, waypoints: Waypoint[], routeDir: 'H' | 'V') {
    if (!pending) return;
    if (pending.fromNodeId === nodeId) { setPending(null); return; }

    // Reject the wire if its path cuts through any node body (other than the
    // two endpoints, which the wire legitimately connects to).
    const fromNode = cs.nodes.get(pending.fromNodeId);
    const toNode   = cs.nodes.get(nodeId);
    if (!fromNode || !toNode) { setPending(null); return; }

    const fp  = getOutputPort(fromNode, pending.fromPortIndex);
    const tp  = getInputPort(toNode, portIndex);
    const pts = deduplicateWirePath(
      buildWirePoints(fp, portWireDir(fromNode.rotation), waypoints, tp, portWireDir(toNode.rotation), routeDir),
    );
    for (const [nid, node] of cs.nodes) {
      if (nid === pending.fromNodeId || nid === nodeId) continue;
      if (wirePathHitsNode(pts, node)) { setPending(null); return; }
    }

    // Reject if the target input port already has a wire connected to it.
    for (const wire of cs.wires.values()) {
      if (wire.to.nodeId === nodeId && wire.to.portIndex === portIndex) {
        setPending(null);
        return;
      }
    }

    managerRef.current.addWire(
      { nodeId: pending.fromNodeId, portIndex: pending.fromPortIndex },
      { nodeId, portIndex },
      waypoints,
      routeDir,
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
            onSplitSetOutputCount={handleSplitSetOutputCount}
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
