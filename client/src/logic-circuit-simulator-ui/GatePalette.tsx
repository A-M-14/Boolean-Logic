import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { GateType } from '@boolean-logic/shared';
import type { PaletteItemData } from './types.js';
import { GATE_TYPES } from './utils.js';
import './GatePalette.css';

// ── Miniature SVG gate icons ──────────────────────────────────────────────────
// Drawn in a 56×36 viewBox, same proportions as the canvas gate shapes.

const FILL   = '#1c193a';
const STROKE = '#a78bfa';
const SW     = 1.8;
const NONE   = 'none';

function MiniGate({ gateType }: { gateType: string }) {
  // Local space centre at (28, 18) inside the 56×36 box
  // Paths translated so the gate body is centred
  const T = 'translate(28,18)';

  const body = (() => {
    switch (gateType) {
      case 'AND':
        return <path d="M -20,-12 L 5,-12 A 12,12 0 0,1 5,12 L -20,12 Z"
                 fill={FILL} stroke={STROKE} strokeWidth={SW} />;
      case 'OR':
        return <path d="M -20,-12 Q -4,-12 20,0 Q -4,12 -20,12 Q -9,0 -20,-12 Z"
                 fill={FILL} stroke={STROKE} strokeWidth={SW} />;
      case 'XOR':
        return <>
          <path d="M -20,-12 Q -4,-12 20,0 Q -4,12 -20,12 Q -9,0 -20,-12 Z"
            fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <path d="M -24,-10 Q -13,0 -24,10" fill={NONE} stroke={STROKE} strokeWidth={SW} />
        </>;
      case 'NOT':
        return <>
          <path d="M -20,-12 L 15,0 L -20,12 Z" fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <circle cx={18} cy={0} r={3} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        </>;
      case 'NAND':
        return <>
          <path d="M -20,-12 L 2,-12 A 12,12 0 0,1 2,12 L -20,12 Z"
            fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <circle cx={17} cy={0} r={3} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        </>;
      case 'NOR':
        return <>
          <path d="M -20,-12 Q -7,-12 15,0 Q -7,12 -20,12 Q -9,0 -20,-12 Z"
            fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <circle cx={18} cy={0} r={3} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        </>;
      case 'XNOR':
        return <>
          <path d="M -20,-12 Q -7,-12 15,0 Q -7,12 -20,12 Q -9,0 -20,-12 Z"
            fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <path d="M -24,-10 Q -13,0 -24,10" fill={NONE} stroke={STROKE} strokeWidth={SW} />
          <circle cx={18} cy={0} r={3} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        </>;
      default:
        return <rect x={-20} y={-12} width={40} height={24} rx={3}
                 fill={FILL} stroke={STROKE} strokeWidth={SW} />;
    }
  })();

  // Short input wire stubs
  const iCount = gateType === 'NOT' ? 1 : 2;
  const stubs = Array.from({ length: iCount }, (_, i) => {
    const sy = iCount === 1 ? 0 : (i === 0 ? -6 : 6);
    return <line key={i} x1={-26} y1={sy} x2={-20} y2={sy}
      stroke={STROKE} strokeWidth={SW * 0.7} opacity={0.5} />;
  });
  const outStub = <line x1={gateType === 'NOT' || gateType === 'NAND' || gateType === 'NOR' || gateType === 'XNOR' ? 21 : 20}
    y1={0} x2={26} y2={0} stroke={STROKE} strokeWidth={SW * 0.7} opacity={0.5} />;

  return (
    <svg viewBox="0 0 56 36" className="palette-entry__icon" aria-hidden="true">
      <g transform={T}>
        {stubs}
        {body}
        {outStub}
      </g>
    </svg>
  );
}

// ── I/O mini icons ────────────────────────────────────────────────────────────

function MiniInput() {
  return (
    <svg viewBox="0 0 56 36" className="palette-entry__icon" aria-hidden="true">
      <rect x={16} y={8} width={20} height={20} rx={3}
        fill="#111827" stroke="#facc15" strokeWidth={1.8} />
      <text x={26} y={19} textAnchor="middle" dominantBaseline="central"
        fill="#facc15" fontSize={10} fontWeight={700} fontFamily="Georgia,serif">1</text>
      <line x1={36} y1={18} x2={44} y2={18} stroke="#a78bfa" strokeWidth={1.5} opacity={0.6} />
    </svg>
  );
}

function MiniOutput() {
  return (
    <svg viewBox="0 0 56 36" className="palette-entry__icon" aria-hidden="true">
      <rect x={16} y={8} width={20} height={20} rx={3}
        fill="#111827" stroke="#a78bfa" strokeWidth={1.8} />
      <circle cx={26} cy={18} r={5} fill="#a78bfa" opacity={0.35} />
      <line x1={12} y1={18} x2={16} y2={18} stroke="#a78bfa" strokeWidth={1.5} opacity={0.6} />
    </svg>
  );
}

function MiniSplit() {
  return (
    <svg viewBox="0 0 56 36" className="palette-entry__icon" aria-hidden="true">
      <circle cx={26} cy={18} r={6} fill="#1e1b3a" stroke="#64748b" strokeWidth={1.8} />
      <line x1={14} y1={18} x2={20} y2={18} stroke="#64748b" strokeWidth={1.5} />
      <line x1={32} y1={18} x2={38} y2={14} stroke="#64748b" strokeWidth={1.5} />
      <line x1={32} y1={18} x2={38} y2={22} stroke="#64748b" strokeWidth={1.5} />
    </svg>
  );
}

// ── Draggable palette entry ────────────────────────────────────────────────────

interface PaletteEntryProps {
  id:      string;
  data:    PaletteItemData;
  label:   string;
  icon:    React.ReactNode;
  color:   'gate' | 'io' | 'split';
}

function PaletteEntry({ id, data, label, icon, color }: PaletteEntryProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`palette-entry palette-entry--${color}${isDragging ? ' palette-entry--dragging' : ''}`}
      title={`Drag to canvas to place ${label}`}
    >
      {icon}
      <span className="palette-entry__label">{label}</span>
    </button>
  );
}

// ── Gate Palette (horizontal bottom bar) ──────────────────────────────────────

export function GatePalette() {
  return (
    <>
      {/* I/O items */}
      <PaletteEntry id="palette-input"  data={{ kind: 'input'  }} label="Input"  icon={<MiniInput  />} color="io" />
      <PaletteEntry id="palette-output" data={{ kind: 'output' }} label="Output" icon={<MiniOutput />} color="io" />
      <PaletteEntry id="palette-split"  data={{ kind: 'split'  }} label="Split"  icon={<MiniSplit  />} color="split" />

      <div className="palette-sep" />

      {/* Gate items */}
      {GATE_TYPES.map(g => (
        <PaletteEntry
          key={g}
          id={`palette-gate-${g}`}
          data={{ kind: 'gate', gateType: g as GateType }}
          label={g}
          icon={<MiniGate gateType={g} />}
          color="gate"
        />
      ))}
    </>
  );
}
