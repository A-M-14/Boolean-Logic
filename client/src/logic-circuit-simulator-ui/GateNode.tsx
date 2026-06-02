import React from 'react';
import type { GateNode as GateNodeType } from '../logic-circuit-simulator-engine/index.js';
import { GATE_W, GATE_H, PORT_R, HIT_R, getInputPort, getOutputPort } from './utils.js';

// ── IEEE/ANSI gate body shapes ─────────────────────────────────────────────────
// All paths defined in local space: origin at gate center,
// bounding box ±GATE_W/2 (±44) × ±GATE_H/2 (±26).
// Input ports are at x = -44 (left edge); output port at x = +44 (right edge).

const FILL   = '#111827';
const STROKE = '#a78bfa';
const SW     = 2;
const NONE   = 'none';

function GateBody({ gateType }: { gateType: string }) {
  switch (gateType) {

    case 'AND':
      // Flat left wall + right semicircle (arc centre at x=18, r=26 → tip at x=44)
      return (
        <path
          d="M -44,-26 L 18,-26 A 26,26 0 0,1 18,26 L -44,26 Z"
          fill={FILL} stroke={STROKE} strokeWidth={SW}
        />
      );

    case 'OR':
      // Pointed right, concave left
      return (
        <path
          d="M -44,-26 Q -10,-26 44,0 Q -10,26 -44,26 Q -20,0 -44,-26 Z"
          fill={FILL} stroke={STROKE} strokeWidth={SW}
        />
      );

    case 'XOR':
      return (
        <>
          <path
            d="M -44,-26 Q -10,-26 44,0 Q -10,26 -44,26 Q -20,0 -44,-26 Z"
            fill={FILL} stroke={STROKE} strokeWidth={SW}
          />
          {/* Extra arc to the left of inputs */}
          <path d="M -50,-22 Q -26,0 -50,22" fill={NONE} stroke={STROKE} strokeWidth={SW} />
        </>
      );

    case 'NOT':
      // Triangle pointing right; small negation circle at output
      return (
        <>
          <path d="M -44,-26 L 38,0 L -44,26 Z" fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <circle cx={44} cy={0} r={6} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        </>
      );

    case 'NAND':
      // AND body (arc centre at x=12) + negation circle
      return (
        <>
          <path
            d="M -44,-26 L 12,-26 A 26,26 0 0,1 12,26 L -44,26 Z"
            fill={FILL} stroke={STROKE} strokeWidth={SW}
          />
          <circle cx={44} cy={0} r={6} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        </>
      );

    case 'NOR':
      // OR body tip at x=38, then negation circle
      return (
        <>
          <path
            d="M -44,-26 Q -16,-26 38,0 Q -16,26 -44,26 Q -20,0 -44,-26 Z"
            fill={FILL} stroke={STROKE} strokeWidth={SW}
          />
          <circle cx={44} cy={0} r={6} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        </>
      );

    case 'XNOR':
      return (
        <>
          <path
            d="M -44,-26 Q -16,-26 38,0 Q -16,26 -44,26 Q -20,0 -44,-26 Z"
            fill={FILL} stroke={STROKE} strokeWidth={SW}
          />
          <path d="M -50,-22 Q -26,0 -50,22" fill={NONE} stroke={STROKE} strokeWidth={SW} />
          <circle cx={44} cy={0} r={6} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        </>
      );

    default:
      return (
        <rect x={-44} y={-26} width={GATE_W} height={GATE_H} rx={6}
          fill={FILL} stroke={STROKE} strokeWidth={SW} />
      );
  }
}

// ── Gate node component ────────────────────────────────────────────────────────

interface GateNodeProps {
  node:       GateNodeType;
  hasPending: boolean;
  onDown:     (e: React.MouseEvent) => void;
  onDblClick: (e: React.MouseEvent) => void;
  onOutPort:  (e: React.MouseEvent, portIndex: number) => void;
  onInPort:   (e: React.MouseEvent, portIndex: number) => void;
}

export function GateNode({
  node, hasPending,
  onDown, onDblClick, onOutPort, onInPort,
}: GateNodeProps) {
  const { x, y } = node.position;
  const iCount = node.gateType === 'NOT' ? 1 : 2;

  return (
    <g>
      {/* Gate shape — draggable */}
      <g
        transform={`translate(${x},${y})`}
        onMouseDown={onDown}
        onDoubleClick={onDblClick}
        style={{ cursor: 'grab' }}
      >
        <GateBody gateType={node.gateType} />
        {/* Label below the gate body */}
        <text
          x={0} y={GATE_H / 2 + 13}
          textAnchor="middle" dominantBaseline="central"
          fill="#6d5fd4" fontSize={10} fontWeight={600}
          style={{ fontFamily: 'system-ui, sans-serif', pointerEvents: 'none', userSelect: 'none' }}
        >
          {node.gateType}
        </text>
      </g>

      {/* Input ports */}
      {Array.from({ length: iCount }, (_, i) => {
        const pp = getInputPort(node, i);
        return (
          <g key={`in-${i}`}>
            <circle cx={pp.x} cy={pp.y} r={PORT_R}
              fill="#111827" stroke={hasPending ? '#facc1588' : '#374151'} strokeWidth={1.5}
              style={{ pointerEvents: 'none' }} />
            <circle cx={pp.x} cy={pp.y} r={HIT_R} fill="transparent"
              style={{ cursor: hasPending ? 'pointer' : 'default' }}
              onClick={e => onInPort(e, i)} />
          </g>
        );
      })}

      {/* Output port */}
      {(() => {
        const pp = getOutputPort(node, 0);
        return (
          <g>
            <circle cx={pp.x} cy={pp.y} r={PORT_R}
              fill="#111827" stroke="#a78bfa88" strokeWidth={1.5}
              style={{ pointerEvents: 'none' }} />
            <circle cx={pp.x} cy={pp.y} r={HIT_R} fill="transparent"
              style={{ cursor: 'crosshair' }}
              onClick={e => onOutPort(e, 0)} />
          </g>
        );
      })()}
    </g>
  );
}
