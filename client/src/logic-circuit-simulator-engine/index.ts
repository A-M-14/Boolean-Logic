export type {
  GateType,
  NodeId,
  WireId,
  Position,
  GateNode,
  InputNode,
  OutputNode,
  SplitNode,
  CircuitNode,
  Port,
  Wire,
  CircuitState,
  NodeInit,
} from './types.js';

export { CircuitStateManager } from './circuitStateManager.js';
export { propagateSignals, propagateSignalsLayered } from './signalPropagator.js';
