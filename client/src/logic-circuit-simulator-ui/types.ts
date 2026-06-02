import type { NodeId } from '../logic-circuit-simulator-engine/index.js';

export type SimulatorMode = 'idle' | 'running' | 'stopped';

export interface ZoomState {
  x: number;
  y: number;
  k: number;
}

export const ZOOM_IDENTITY: ZoomState = { x: 0, y: 0, k: 1 };

export interface PendingWire {
  fromNodeId: NodeId;
  fromPortIndex: number;
  mx: number;
  my: number;
}

export type PaletteItemData =
  | { kind: 'gate';   gateType: import('@boolean-logic/shared').GateType }
  | { kind: 'input' }
  | { kind: 'output' }
  | { kind: 'split' };
