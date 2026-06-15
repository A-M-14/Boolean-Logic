import React from 'react';
import type { OutputNode, CircuitState } from '../logic-circuit-simulator-engine/index.js';
import { CIRC_R, PORT_R, IN_HIT_R, sigColor, getInputPort } from './utils.js';

const BOX = CIRC_R * 2;   // 48 × 48

interface CircuitOutputProps {
  node:       OutputNode;
  cs:         CircuitState;
  hasPending: boolean;
  onDown:     (e: React.MouseEvent) => void;
  onDblClick: (e: React.MouseEvent) => void;
  onClick:    (e: React.MouseEvent) => void;
  onInPort:   (e: React.MouseEvent) => void;
}

export function CircuitOutput({
  node, cs, hasPending,
  onDown, onDblClick, onClick, onInPort,
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
      {/* Box body — rotates */}
      <g onMouseDown={onDown} onDoubleClick={onDblClick} onClick={onClick}
         style={{ cursor: 'grab' }}
         transform={`rotate(${node.rotation}, ${x}, ${y})`}>
        <rect
          x={x - BOX / 2} y={y - BOX / 2}
          width={BOX} height={BOX}
          rx={4}
          fill={signal !== undefined ? `${col}18` : '#111827'}
          stroke={col} strokeWidth={2}
        />
      </g>

      {/* Label — always horizontal at box center */}
      <text
        x={x} y={y}
        textAnchor="middle" dominantBaseline="central"
        fill={col}
        fontSize={signal !== undefined ? 18 : 9}
        fontWeight={700}
        style={{ fontFamily: signal !== undefined ? 'Georgia, serif' : 'system-ui, sans-serif', pointerEvents: 'none', userSelect: 'none' }}
      >
        {signal === true ? '1' : signal === false ? '0' : 'OUTPUT'}
      </text>

      {/* Input port */}
      <circle cx={pp.x} cy={pp.y} r={PORT_R}
        fill="#111827" stroke={hasPending ? '#facc1588' : '#374151'} strokeWidth={1.5}
        style={{ pointerEvents: 'none' }} />
      <circle cx={pp.x} cy={pp.y} r={IN_HIT_R} fill="transparent"
        style={{ cursor: hasPending ? 'pointer' : 'default' }}
        onClick={onInPort} />
    </g>
  );
}
