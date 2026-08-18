import React, { useLayoutEffect, useRef, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import type { CircuitState } from '../logic-circuit-simulator-engine/index.js';
import { CircuitCanvas } from '../logic-circuit-simulator-ui/CircuitCanvas.js';
import type { ZoomState } from '../logic-circuit-simulator-ui/types.js';
import { ZOOM_IDENTITY } from '../logic-circuit-simulator-ui/types.js';
import { GATE_W, GATE_H, CIRC_R } from '../logic-circuit-simulator-ui/utils.js';
import './SolutionDisplay.css';

// An empty map satisfies ReadonlyMap<string, { signal, durationMs }> with no entries.
const EMPTY_PROPAGATING: ReadonlyMap<string, { signal: boolean | undefined; durationMs: number }> =
  new Map();

// All interaction handlers are no-ops — this is a read-only display.
// TypeScript allows () => void to satisfy callbacks with any parameters.
const noop = () => {};

interface SolutionDisplayProps {
  referenceCircuit:   CircuitState;
  referenceGateCount: number;
  onClose:            () => void;
}

export function SolutionDisplay({
  referenceCircuit,
  referenceGateCount,
  onClose,
}: SolutionDisplayProps) {
  const [zoomState, setZoomState] = useState<ZoomState>(ZOOM_IDENTITY);
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of referenceCircuit.nodes.values()) {
      const { x, y } = node.position;
      const hw = node.type === 'gate' ? GATE_W / 2 : CIRC_R;
      const hh = node.type === 'gate' ? GATE_H / 2 : CIRC_R;
      minX = Math.min(minX, x - hw);  maxX = Math.max(maxX, x + hw);
      minY = Math.min(minY, y - hh);  maxY = Math.max(maxY, y + hh);
    }
    if (!isFinite(minX)) return;

    const MARGIN = 40;
    const circW = maxX - minX + 2 * MARGIN;
    const circH = maxY - minY + 2 * MARGIN;
    const k  = Math.min(1.5, width / circW, height / circH);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoomState({ x: width / 2 - cx * k, y: height / 2 - cy * k, k });
  }, [referenceCircuit]);

  return (
    <div className="sol-display__overlay">
      <div className="sol-display" onClick={e => e.stopPropagation()}>

        <div className="sol-display__header">
          <div className="sol-display__header-text">
            <h2 className="sol-display__title">Reference Solution</h2>
            <span className="sol-display__meta">
              {referenceGateCount} gate{referenceGateCount !== 1 ? 's' : ''} (minimum)
            </span>
          </div>
          <button className="sol-display__close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* CircuitCanvas needs a DndContext ancestor for its useDroppable hook. */}
        <div className="sol-display__canvas-wrap" ref={wrapRef}>
          <DndContext>
            <CircuitCanvas
              cs={referenceCircuit}
              pending={null}
              zoomState={zoomState}
              propagatingWires={EMPTY_PROPAGATING}
              onZoomChange={setZoomState}
              onNodeDrag={noop}
              onNodeDragEnd={noop}
              onNodeDelete={noop}
              onNodeRotate={noop}
              onOutPort={noop}
              onInPort={noop}
              onWireDelete={noop}
              onPendingMove={noop}
              onCancelPending={noop}
              onInputSetValue={noop}
              onSplitSetOutputCount={noop}
            />
          </DndContext>
        </div>

      </div>
    </div>
  );
}
