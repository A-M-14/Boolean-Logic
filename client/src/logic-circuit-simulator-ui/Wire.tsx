import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { Wire, Waypoint, Position } from '../logic-circuit-simulator-engine/index.js';
import type { CircuitState } from '../logic-circuit-simulator-engine/index.js';
import { sigColor, getOutputPort, getInputPort, portWireDir, buildWirePoints, deduplicateWirePath } from './utils.js';

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
  /** Incremented each time this wire is re-animated (feedback / multi-wave). */
  animRev:        number;
  onDblClick:     () => void;
}

function buildWirePath(
  from: Position, fromDir: Position,
  waypoints: readonly Waypoint[],
  to: Position, toDir: Position,
  routeDir: 'H' | 'V',
): string {
  const clean = deduplicateWirePath(buildWirePoints(from, fromDir, waypoints, to, toDir, routeDir));
  let d = `M${clean[0].x},${clean[0].y}`;
  for (let i = 1; i < clean.length; i++) d += ` L${clean[i].x},${clean[i].y}`;
  return d;
}

export function Wire({ wire, cs, isPropagating, futureSignal, animDurationMs, animRev, onDblClick }: WireProps) {
  const fromNode = cs.nodes.get(wire.from.nodeId);
  const toNode   = cs.nodes.get(wire.to.nodeId);
  if (!fromNode || !toNode) return null;

  const fp      = getOutputPort(fromNode, wire.from.portIndex);
  const tp      = getInputPort(toNode,   wire.to.portIndex);
  const fromDir = portWireDir(fromNode.rotation);
  const toDir   = portWireDir(toNode.rotation);
  const pathD   = buildWirePath(fp, fromDir, wire.waypoints, tp, toDir, wire.routeDir);

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
  }, [isPropagating, animRev]);

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
  }, [isPropagating, animRev]);

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
