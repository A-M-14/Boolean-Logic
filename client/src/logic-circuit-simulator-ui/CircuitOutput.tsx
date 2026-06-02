import React from 'react';
import type { OutputNode, CircuitState } from '../logic-circuit-simulator-engine/index.js';
import { CIRC_R, PORT_R, HIT_R, sigColor, getInputPort } from './utils.js';

const BOX = CIRC_R * 2;   // 48 × 48

interface CircuitOutputProps {
  node:       OutputNode;
  cs:         CircuitState;
  hasPending: boolean;
  onDown:     (e: React.MouseEvent) => void;
  onDblClick: (e: React.MouseEvent) => void;
  onInPort:   (e: React.MouseEvent) => void;
}

export function CircuitOutput({
  node, cs, hasPending,
  onDown, onDblClick, onInPort,
}: CircuitOutputProps) {
  let signal: boolean | undefined;
  for (const w of cs.wires.values()) {
    if (w.to.nodeId === node.id && w.to.portIndex === 0) {
      signal = w.signal;
      break;
    }
  }

  const col = sigColor(signal);
  const pp  = getInputPort(node, 0);
  const { x, y } = node.position;

  return (
    <g>
      {/* Box body */}
      <g onMouseDown={onDown} onDoubleClick={onDblClick} style={{ cursor: 'grab' }}>
        <rect
          x={x - BOX / 2} y={y - BOX / 2}
          width={BOX} height={BOX}
          rx={4}
          fill={signal !== undefined ? `${col}18` : '#111827'}
          stroke={col} strokeWidth={2}
        />
        {/* Inner circle indicator */}
        <circle cx={x} cy={y} r={8}
          fill={col} opacity={signal !== undefined ? 0.8 : 0.2}
          style={{ pointerEvents: 'none' }} />
        <text
          x={x} y={y}
          textAnchor="middle" dominantBaseline="central"
          fill={signal !== undefined ? col : '#475569'}
          fontSize={signal !== undefined ? 14 : 9}
          fontWeight={700}
          style={{ fontFamily: 'Georgia, serif', pointerEvents: 'none', userSelect: 'none' }}
        >
          {signal !== undefined ? (signal ? '1' : '0') : 'OUT'}
        </text>
      </g>

      {/* Input port */}
      <circle cx={pp.x} cy={pp.y} r={PORT_R}
        fill="#111827" stroke={hasPending ? '#facc1588' : '#374151'} strokeWidth={1.5}
        style={{ pointerEvents: 'none' }} />
      <circle cx={pp.x} cy={pp.y} r={HIT_R} fill="transparent"
        style={{ cursor: hasPending ? 'pointer' : 'default' }}
        onClick={onInPort} />
    </g>
  );
}
