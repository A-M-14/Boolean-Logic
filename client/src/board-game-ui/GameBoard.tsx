import { useState } from 'react';
import type { BoardState, BitValue, Cell } from '@boolean-logic/shared';
import { GateCellComponent } from './GateCellComponent.js';
import { BitCellComponent }  from './BitCellComponent.js';
import './GameBoard.css';

interface GameBoardProps {
  state:    BoardState;
  disabled: boolean;
  onPlace:  (row: number, col: number, value: BitValue) => void;
  onClear?: (row: number, col: number) => void;
}

export function GameBoard({ state, disabled, onPlace, onClear }: GameBoardProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);

  return (
    <div
      className={`game-board${disabled ? ' game-board--disabled' : ''}${selectorOpen ? ' game-board--selector-open' : ''}`}
      aria-label="Boolean Logic Game Board"
    >
      {state.cells.map((rowCells: Cell[], r: number) =>
        rowCells.map((cell: Cell, c: number) => (
          <div key={`${r}-${c}`} className="game-board__cell">
            {cell.type === 'gate' ? (
              <GateCellComponent
                gate={cell.gate}
                row={r}
                col={c}
                state={state}
                selectorOpen={selectorOpen}
              />
            ) : (
              <BitCellComponent
                cell={cell}
                row={r}
                col={c}
                gameMode={state.gameMode}
                onPlace={onPlace}
                onClear={onClear}
                onSelectorToggle={setSelectorOpen}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}
