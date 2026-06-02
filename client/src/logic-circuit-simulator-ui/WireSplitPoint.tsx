import React from 'react';
import type { SplitNode } from '../logic-circuit-simulator-engine/index.js';
import { PORT_R, HIT_R, getInputPort, getOutputPort } from './utils.js';

interface WireSplitPointProps {
  node:       SplitNode;
  hasPending: boolean;
  onDown:     (e: React.MouseEvent) => void;
  onDblClick: (e: React.MouseEvent) => void;
  onOutPort:  (e: React.MouseEvent, portIndex: number) => void;
  onInPort:   (e: React.MouseEvent) => void;
}

/**
 * A wire split-point node that branches one incoming signal into two outgoing wires,
 * distributing the same signal to more than one downstream input port.
 */
export function WireSplitPoint({
  node, hasPending,
  onDown, onDblClick, onOutPort, onInPort,
}: WireSplitPointProps) {
  const ip  = getInputPort(node, 0);
  const op0 = getOutputPort(node, 0);
  const op1 = getOutputPort(node, 1);

  return (
    <g>
      {/* Body */}
      <g onMouseDown={onDown} onDoubleClick={onDblClick} style={{ cursor: 'grab' }}>
        <circle cx={node.position.x} cy={node.position.y} r={8}
          fill="#2d2a50" stroke="#64748b" strokeWidth={1.5} />
      </g>

      {/* Input port */}
      <circle cx={ip.x} cy={ip.y} r={PORT_R}
        fill="#151230" stroke={hasPending ? '#64ffda88' : '#374151'} strokeWidth={1.5}
        style={{ pointerEvents: 'none' }} />
      <circle cx={ip.x} cy={ip.y} r={HIT_R} fill="transparent"
        style={{ cursor: hasPending ? 'pointer' : 'default' }}
        onClick={onInPort} />

      {/* Output ports (top and bottom) */}
      {[op0, op1].map((pp, i) => (
        <g key={i}>
          <circle cx={pp.x} cy={pp.y} r={PORT_R}
            fill="#151230" stroke="#64ffda88" strokeWidth={1.5}
            style={{ pointerEvents: 'none' }} />
          <circle cx={pp.x} cy={pp.y} r={HIT_R} fill="transparent"
            style={{ cursor: 'crosshair' }}
            onClick={e => onOutPort(e, i)} />
        </g>
      ))}
    </g>
  );
}
