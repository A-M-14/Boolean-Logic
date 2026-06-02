import React from 'react';
import type { Wire } from '../logic-circuit-simulator-engine/index.js';
import type { CircuitState } from '../logic-circuit-simulator-engine/index.js';
import { sigColor, wirePath, getOutputPort, getInputPort } from './utils.js';

interface WireComponentProps {
  wire:      Wire;
  cs:        CircuitState;
  onDblClick: () => void;
}

/**
 * Renders a single wire as a cubic-bezier SVG path.
 * Color reflects the live signal value: green = 1, red = 0, gray = unresolved.
 * Double-clicking the wire deletes it.
 */
export function WireComponent({ wire, cs, onDblClick }: WireComponentProps) {
  const fromNode = cs.nodes.get(wire.from.nodeId);
  const toNode   = cs.nodes.get(wire.to.nodeId);
  if (!fromNode || !toNode) return null;

  const fp = getOutputPort(fromNode, wire.from.portIndex);
  const tp = getInputPort(toNode,   wire.to.portIndex);

  return (
    <path
      d={wirePath(fp, tp)}
      fill="none"
      stroke={sigColor(wire.signal)}
      strokeWidth={2}
      strokeLinecap="round"
      style={{ cursor: 'pointer' }}
      onDoubleClick={onDblClick}
    />
  );
}
