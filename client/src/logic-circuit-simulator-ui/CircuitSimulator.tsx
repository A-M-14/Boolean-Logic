import React, { useRef, useState } from 'react';
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
} from '../logic-circuit-simulator-engine/index.js';
import type { SimulatorMode, ZoomState, PendingWire, PaletteItemData } from './types.js';
import { ZOOM_IDENTITY } from './types.js';
import { GATE_SYMBOLS } from './utils.js';
import { GatePalette }       from './GatePalette.js';
import { CircuitCanvas, CANVAS_DROP_ID } from './CircuitCanvas.js';
import { SimulatorControls } from './SimulatorControls.js';
import './CircuitSimulator.css';

// ── Drag overlay: tiny gate preview shown while dragging from palette ─────────

function DragPreview({ data }: { data: PaletteItemData | null }) {
  if (!data) return null;
  if (data.kind === 'gate') {
    return (
      <div className="cs-drag-preview cs-drag-preview--gate">
        <span className="cs-drag-preview__sym">{GATE_SYMBOLS[data.gateType]}</span>
        <span className="cs-drag-preview__label">{data.gateType}</span>
      </div>
    );
  }
  if (data.kind === 'input')  return <div className="cs-drag-preview cs-drag-preview--io">Input</div>;
  if (data.kind === 'output') return <div className="cs-drag-preview cs-drag-preview--io">Output</div>;
  if (data.kind === 'split')  return <div className="cs-drag-preview cs-drag-preview--io">Split</div>;
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

  // Require 6 px movement before a palette item is considered a drag
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── Circuit state helpers ──────────────────────────────────────────────────
  function refresh(propagate = true) {
    const m = managerRef.current;
    if (propagate && mode === 'running') {
      const fresh = propagateSignals(m.getState());
      m.applySignals(fresh.wires);
    }
    setCs(m.getState());
  }

  function propagateAndRefresh() {
    const m     = managerRef.current;
    const fresh = propagateSignals(m.getState());
    m.applySignals(fresh.wires);
    setCs(m.getState());
  }

  // ── Simulator controls ─────────────────────────────────────────────────────
  function handleRun() {
    setMode('running');
    propagateAndRefresh();
  }

  function handleStop() {
    setMode('stopped');
  }

  function handleReset() {
    managerRef.current.resetSignals();
    setMode('idle');
    setCs(managerRef.current.getState());
  }

  function handleClear() {
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
    if (data.kind === 'input')  m.addNode({ type: 'input',  value: false, position });
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

  function handleNodeDelete(nodeId: NodeId) {
    managerRef.current.removeNode(nodeId);
    if (pending?.fromNodeId === nodeId) setPending(null);
    mode === 'running' ? propagateAndRefresh() : setCs(managerRef.current.getState());
  }

  function handleInputToggle(nodeId: NodeId) {
    const node = cs.nodes.get(nodeId);
    if (!node || node.type !== 'input') return;
    managerRef.current.setInputValue(nodeId, !node.value);
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

  function handleInPort(nodeId: NodeId, portIndex: number) {
    if (!pending) return;
    if (pending.fromNodeId === nodeId) { setPending(null); return; }
    managerRef.current.addWire(
      { nodeId: pending.fromNodeId, portIndex: pending.fromPortIndex },
      { nodeId, portIndex },
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
          <button className="game-back-btn" onClick={onBack}>← Back</button>
          <h2 className="cs-title">Logic Circuit Simulator</h2>
        </div>

        {/* Body — canvas fills all remaining space */}
        <div className="cs-body">
          <CircuitCanvas
            cs={cs}
            pending={pending}
            zoomState={zoomState}
            onZoomChange={setZoomState}
            onNodeDrag={handleNodeDrag}
            onNodeDelete={handleNodeDelete}
            onInputToggle={handleInputToggle}
            onOutPort={handleOutPort}
            onInPort={handleInPort}
            onWireDelete={handleWireDelete}
            onPendingMove={handlePendingMove}
            onCancelPending={() => setPending(null)}
          />
        </div>

        {/* Bottom toolbar: Run/Stop/Reset  +  gate palette */}
        <div className="cs-bottombar">
          <SimulatorControls
            mode={mode}
            onRun={handleRun}
            onStop={handleStop}
            onReset={handleReset}
          />
          {cs.nodes.size > 0 && (
            <button className="cs-clear-btn" onClick={handleClear}>Clear</button>
          )}
          <div className="cs-bottombar__sep" />
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
