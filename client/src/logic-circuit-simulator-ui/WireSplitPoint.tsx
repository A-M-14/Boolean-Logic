import React from 'react';
import type { SplitNode } from '../logic-circuit-simulator-engine/index.js';
import { PORT_R, HIT_R, IN_HIT_R, getInputPort, getOutputPort } from './utils.js';

interface WireSplitPointProps {
  node:        SplitNode;
  hasPending:  boolean;
  onDown:      (e: React.MouseEvent) => void;
  onDblClick:  (e: React.MouseEvent) => void;
  onBodyClick: (e: React.MouseEvent) => void;
  onOutPort:   (e: React.MouseEvent, portIndex: number) => void;
  onInPort:    (e: React.MouseEvent) => void;
}

export function WireSplitPoint({
  node, hasPending,
  onDown, onDblClick, onBodyClick, onOutPort, onInPort,
}: WireSplitPointProps) {
  const ip = getInputPort(node, 0);
  const nx = node.position.x;
  const ny = node.position.y;

  // Spine x-coordinate and top/bottom port y-coordinates (in unrotated space)
  const spineX      = nx + 10;
  const topPortY    = ny - (node.outputCount - 1) * 12;
  const bottomPortY = ny + (node.outputCount - 1) * 12;

  return (
    <g>
      {/* Structural elements — rotate as a group around the node center */}
      <g transform={`rotate(${node.rotation}, ${nx}, ${ny})`}>
        {/* Trunk: horizontal stub from body centre to spine */}
        <line x1={nx} y1={ny} x2={spineX} y2={ny}
          stroke="#64748b" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />

        {/* Spine: vertical bar connecting all output ports */}
        <line x1={spineX} y1={topPortY} x2={spineX} y2={bottomPortY}
          stroke="#64748b" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />

        {/* Body circle */}
        <circle cx={nx} cy={ny} r={8}
          fill="#2d2a50" stroke="#64748b" strokeWidth={1.5}
          style={{ pointerEvents: 'none' }} />
      </g>

      {/* Input port — position already rotated by getInputPort */}
      <circle cx={ip.x} cy={ip.y} r={PORT_R}
        fill="#151230" stroke={hasPending ? '#64ffda88' : '#374151'} strokeWidth={1.5}
        style={{ pointerEvents: 'none' }} />
      <circle cx={ip.x} cy={ip.y} r={IN_HIT_R} fill="transparent"
        style={{ cursor: hasPending ? 'pointer' : 'default' }}
        onClick={onInPort} />

      {/* Output ports — positions already rotated by getOutputPort */}
      {Array.from({ length: node.outputCount }, (_, i) => {
        const pp = getOutputPort(node, i);
        return (
          <g key={i}>
            <circle cx={pp.x} cy={pp.y} r={PORT_R}
              fill="#151230" stroke="#64ffda88" strokeWidth={1.5}
              style={{ pointerEvents: 'none' }} />
            <circle cx={pp.x} cy={pp.y} r={HIT_R} fill="transparent"
              style={{ cursor: 'crosshair' }}
              onClick={e => onOutPort(e, i)} />
          </g>
        );
      })}

      {/* Body interaction target — always at node center */}
      <circle cx={nx} cy={ny} r={8}
        fill="transparent"
        onMouseDown={onDown}
        onDoubleClick={onDblClick}
        onClick={onBodyClick}
        style={{ cursor: 'grab' }}
      />
    </g>
  );
}
