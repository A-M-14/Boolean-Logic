import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { GateType, BoardState } from '@boolean-logic/shared';
import { GateTooltip } from './GateTooltip.js';
import './GateCellComponent.css';

const GATE_LABELS: Record<GateType, string> = {
  AND:  'AND',
  OR:   'OR',
  XOR:  'XOR',
  NAND: 'NAND',
  NOR:  'NOR',
  XNOR: 'XNOR',
  NOT:  'NOT',
};

const GATE_COLORS: Partial<Record<GateType, string>> = {
  AND:  '#64ffda',
  OR:   '#a78bfa',
  XOR:  '#f472b6',
  NAND: '#fb923c',
  NOR:  '#38bdf8',
  XNOR: '#facc15',
};

interface GateCellComponentProps {
  gate:         GateType;
  row:          number;
  col:          number;
  state:        BoardState;
  selectorOpen: boolean;
}

export function GateCellComponent({ gate, row, col, state, selectorOpen }: GateCellComponentProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectorOpen) setShowTooltip(false);
  }, [selectorOpen]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowTooltip(prev => !prev);
  }

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    setShowTooltip(false);
  }

  const color = GATE_COLORS[gate] ?? '#e2e8f0';

  return (
    <div
      ref={cellRef}
      className="gate-cell"
      style={{ '--gate-color': color } as React.CSSProperties}
      onClick={handleClick}
    >
      <span className="gate-cell__label">{GATE_LABELS[gate]}</span>
      {showTooltip && cellRef.current && createPortal(
        <>
          <div className="gate-tooltip__backdrop" onClick={handleClose} />
          <GateTooltip
            row={row}
            col={col}
            state={state}
            anchor={cellRef.current.getBoundingClientRect()}
          />
        </>,
        document.body,
      )}
    </div>
  );
}
