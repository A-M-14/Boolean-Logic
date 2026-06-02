import React from 'react';
import type { SimulatorMode } from './types.js';
import './SimulatorControls.css';

interface SimulatorControlsProps {
  mode:    SimulatorMode;
  onRun:   () => void;
  onStop:  () => void;
  onReset: () => void;
}

export function SimulatorControls({ mode, onRun, onStop, onReset }: SimulatorControlsProps) {
  return (
    <div className="sim-controls">
      <button
        className={`sim-controls__btn sim-controls__btn--run${mode === 'running' ? ' sim-controls__btn--active' : ''}`}
        onClick={onRun}
        disabled={mode === 'running'}
        title="Propagate signals through the circuit"
      >
        ▶ Run
      </button>

      <button
        className="sim-controls__btn sim-controls__btn--stop"
        onClick={onStop}
        disabled={mode !== 'running'}
        title="Pause signal propagation"
      >
        ■ Stop
      </button>

      <button
        className="sim-controls__btn sim-controls__btn--reset"
        onClick={onReset}
        title="Clear all computed signal values"
      >
        ↺ Reset
      </button>
    </div>
  );
}
