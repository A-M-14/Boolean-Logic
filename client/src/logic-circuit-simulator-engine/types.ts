import type { GateType } from '@boolean-logic/shared';

export type { GateType };

export type NodeId = string;
export type WireId = string;

export interface Position {
  readonly x: number;
  readonly y: number;
}

interface BaseNode {
  readonly id: NodeId;
  readonly position: Position;
  readonly rotation: 0 | 90 | 180 | 270;
}

export interface GateNode extends BaseNode {
  readonly type: 'gate';
  readonly gateType: GateType;
}

export interface InputNode extends BaseNode {
  readonly type: 'input';
  readonly value: boolean | null;
}

export interface OutputNode extends BaseNode {
  readonly type: 'output';
}

export interface SplitNode extends BaseNode {
  readonly type: 'split';
  readonly outputCount: number;
}

export type CircuitNode = GateNode | InputNode | OutputNode | SplitNode;

/** An output port (from) or input port (to) on a node. portIndex is 0-based. */
export interface Port {
  readonly nodeId: NodeId;
  readonly portIndex: number;
}

export interface Wire {
  readonly id: WireId;
  readonly from: Port;
  readonly to: Port;
  readonly signal: boolean | undefined;
  /** Intermediate turn-points in circuit space, in order from→to. */
  readonly waypoints: readonly Position[];
}

export interface CircuitState {
  readonly nodes: ReadonlyMap<NodeId, CircuitNode>;
  readonly wires: ReadonlyMap<WireId, Wire>;
}

/** Payload passed to CircuitStateManager.addNode — id is assigned internally. */
export type NodeInit =
  | { readonly type: 'gate';   readonly gateType: GateType; readonly position: Position; readonly rotation?: 0 | 90 | 180 | 270 }
  | { readonly type: 'input';  readonly value?: boolean | null; readonly position: Position; readonly rotation?: 0 | 90 | 180 | 270 }
  | { readonly type: 'output';                              readonly position: Position; readonly rotation?: 0 | 90 | 180 | 270 }
  | { readonly type: 'split'; readonly outputCount?: number; readonly position: Position; readonly rotation?: 0 | 90 | 180 | 270 };
