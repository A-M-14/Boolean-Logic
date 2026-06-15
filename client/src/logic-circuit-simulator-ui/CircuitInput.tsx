import React from 'react';
import type { InputNode } from '../logic-circuit-simulator-engine/index.js';
import { CIRC_R, PORT_R, HIT_R, getOutputPort } from './utils.js';

// Box dimensions derived from CIRC_R so port positions stay correct
const BOX = CIRC_R * 2;   // 48 × 48

interface CircuitInputProps {
  node:       InputNode;
  hasPending: boolean;
  onDown:     (e: React.MouseEvent) => void;
  onDblClick: (e: React.MouseEvent) => void;
  onClick:    (e: React.MouseEvent) => void;
  onOutPort:  (e: React.MouseEvent) => void;
}

export function CircuitInput({
  node, hasPending,
  onDown, onDblClick, onClick, onOutPort,
}: CircuitInputProps) {
  const col = node.value === true ? '#facc15' : node.value === false ? '#ef4444' : '#475569';
  const pp  = getOutputPort(node, 0);
  const { x, y } = node.position;

  return (
    <g>
      {/* Box body — rotates */}
      <g onMouseDown={onDown} onDoubleClick={onDblClick} onClick={onClick}
         style={{ cursor: 'pointer' }}
         transform={`rotate(${node.rotation}, ${x}, ${y})`}>
        <rect
          x={x - BOX / 2} y={y - BOX / 2}
          width={BOX} height={BOX}
          rx={4}
          fill="#111827" stroke={col} strokeWidth={2}
        />
      </g>

      {/* Label — always horizontal at box center */}
      <text
        x={x} y={y}
        textAnchor="middle" dominantBaseline="central"
        fill={col}
        fontSize={node.value !== null ? 18 : 9}
        fontWeight={700}
        style={{ fontFamily: node.value !== null ? 'Georgia, serif' : 'system-ui, sans-serif', pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.value === true ? '1' : node.value === false ? '0' : 'INPUT'}
      </text>

      {/* Output port */}
      <circle cx={pp.x} cy={pp.y} r={PORT_R}
        fill="#111827" stroke="#a78bfa88" strokeWidth={1.5}
        style={{ pointerEvents: 'none' }} />
      <circle cx={pp.x} cy={pp.y} r={HIT_R} fill="transparent"
        style={{ cursor: 'crosshair' }}
        onClick={onOutPort} />
    </g>
  );
}
