import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { Wire, Position } from '../logic-circuit-simulator-engine/index.js';
import type { CircuitState } from '../logic-circuit-simulator-engine/index.js';
import { sigColor, getOutputPort, getInputPort, portWireDir, STUB_LEN } from './utils.js';

/** Length of the traveling dash in SVG user units (px). */
const HALO_LEN = 3;
/** Stroke width of the halo path — diameter of the traveling dot. */
const HALO_W   = 8;
/**
 * How far before the wire start the halo sits at progress=0.
 * = HALO_LEN + HALO_W/2 + 1, so the round cap doesn't touch position 0.
 */
const HALO_LEAD = HALO_LEN + HALO_W / 2 + 1; // = 11

interface WireProps {
  wire:           Wire;
  cs:             CircuitState;
  /** True while the halo is traveling over this wire. */
  isPropagating:  boolean;
  /** The signal value this wire will carry after the halo passes (halo color). */
  futureSignal:   boolean | undefined;
  /** How long the halo takes to travel this wire, in milliseconds. */
  animDurationMs: number;
  onDblClick:     () => void;
}

function buildWirePath(
  from: Position, fromDir: Position,
  waypoints: readonly Position[],
  to: Position, toDir: Position,
): string {
  // Stubs scale down on very short wires so they never overlap each other.
  const approxLen = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  const stub = Math.min(STUB_LEN, approxLen / 4);

  // Exit stub: straight segment leaving the from-port in its direction.
  const exitPt:  Position = { x: from.x + fromDir.x * stub, y: from.y + fromDir.y * stub };
  // Entry stub: straight segment arriving at the to-port from its direction.
  const entryPt: Position = { x: to.x   - toDir.x  * stub, y: to.y   - toDir.y  * stub };

  // Single continuous path: exit stub → L-routed middle → entry stub → port
  let d = `M${from.x},${from.y} L${exitPt.x},${exitPt.y}`;

  const pts = [exitPt, ...waypoints, entryPt];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
      d += ` L${b.x},${a.y} L${b.x},${b.y}`;
    } else {
      d += ` L${a.x},${b.y} L${b.x},${b.y}`;
    }
  }

  d += ` L${to.x},${to.y}`;
  return d;
}

export function Wire({ wire, cs, isPropagating, futureSignal, animDurationMs, onDblClick }: WireProps) {
  const fromNode = cs.nodes.get(wire.from.nodeId);
  const toNode   = cs.nodes.get(wire.to.nodeId);
  if (!fromNode || !toNode) return null;

  const fp      = getOutputPort(fromNode, wire.from.portIndex);
  const tp      = getInputPort(toNode,   wire.to.portIndex);
  const fromDir = portWireDir(fromNode.rotation);
  const toDir   = portWireDir(toNode.rotation);
  const pathD   = buildWirePath(fp, fromDir, wire.waypoints, tp, toDir);

  const baseRef  = useRef<SVGPathElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const haloRef  = useRef<SVGPathElement>(null);
  const rafRef   = useRef<number | null>(null);

  // Before the first paint, make the animation paths fully transparent so
  // no full-stroke flash or initial dot appears.  We use opacity (not JSX
  // style) so React re-renders cannot reset it mid-animation.
  useLayoutEffect(() => {
    if (!isPropagating) return;
    if (trailRef.current) trailRef.current.style.opacity = '0';
    if (haloRef.current)  haloRef.current.style.opacity  = '0';
  }, [isPropagating]);

  useEffect(() => {
    if (!isPropagating) return;

    const base  = baseRef.current;
    const trail = trailRef.current;
    const halo  = haloRef.current;
    if (!base || !trail || !halo) return;

    const totalLen = base.getTotalLength();
    if (totalLen === 0) return;

    // Trail: full-length dash that starts invisible (offset=totalLen) and
    // expands to offset=0 as the dot advances.
    trail.style.strokeDasharray  = `${totalLen} ${totalLen + 1}`;
    trail.style.strokeDashoffset = String(totalLen);
    trail.style.opacity          = '1';

    // Halo: tiny dash positioned BEFORE the wire start (HALO_LEAD px back)
    // so it's invisible until it crosses position 0 — no flash at origin.
    const dotEndOffset   = -(totalLen + HALO_LEN);
    const totalHaloRange = HALO_LEAD - dotEndOffset; // full travel distance
    halo.style.strokeDasharray  = `${HALO_LEN} ${totalLen + HALO_LEN * 2}`;
    halo.style.strokeDashoffset = String(HALO_LEAD);
    halo.style.opacity          = '1';

    const t0 = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - t0) / animDurationMs);

      halo!.style.strokeDashoffset  = String(HALO_LEAD - totalHaloRange * progress);
      trail!.style.strokeDashoffset = String(totalLen  * (1 - progress));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPropagating]);

  return (
    <>
      {/* Base wire — gray while animating, signal color after reveal */}
      <path
        ref={baseRef}
        d={pathD}
        fill="none"
        stroke={sigColor(wire.signal)}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ cursor: 'pointer' }}
        onDoubleClick={onDblClick}
      />
      {isPropagating && (
        <>
          {/* Colored trail that grows behind the dot in real time. */}
          <path
            ref={trailRef}
            d={pathD}
            fill="none"
            stroke={sigColor(futureSignal)}
            strokeWidth={2}
            strokeLinecap="round"
            style={{ pointerEvents: 'none' }}
          />
          {/* Glowing dot */}
          <path
            ref={haloRef}
            d={pathD}
            fill="none"
            stroke={sigColor(futureSignal)}
            strokeWidth={HALO_W}
            strokeLinecap="round"
            style={{ pointerEvents: 'none', filter: 'url(#wire-halo-glow)' }}
          />
        </>
      )}
    </>
  );
}
