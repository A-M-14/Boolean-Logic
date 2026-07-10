import { useState, useRef } from 'react';
import type { BitCell, GameMode, BitValue } from '@boolean-logic/shared';
import { BitSelector } from './BitSelector.js';
import './BitCellComponent.css';

interface BitCellComponentProps {
  cell:             BitCell;
  row:              number;
  col:              number;
  gameMode:         GameMode;
  onPlace:          (row: number, col: number, value: BitValue) => void;
  onClear?:         (row: number, col: number) => void;
  onSelectorToggle: (isOpen: boolean) => void;
}

export function BitCellComponent({ cell, row, col, gameMode, onPlace, onClear, onSelectorToggle }: BitCellComponentProps) {
  const [open, setOpen] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  const canClick = cell.value === null || gameMode === 'solo';

  function handleClick() {
    if (!canClick) return;
    setOpen(true);
    onSelectorToggle(true);
  }

  function handleSelect(value: BitValue) {
    setOpen(false);
    onSelectorToggle(false);
    onPlace(row, col, value);
  }

  function handleClear() {
    setOpen(false);
    onSelectorToggle(false);
    onClear?.(row, col);
  }

  function handleClose() {
    setOpen(false);
    onSelectorToggle(false);
  }

  const playerClass = cell.placedBy ? `bit-cell--${cell.placedBy}` : '';

  return (
    <div
      ref={cellRef}
      className={`bit-cell${playerClass ? ` ${playerClass}` : ''}${canClick ? ' bit-cell--interactive' : ''}`}
      onClick={handleClick}
      role={canClick ? 'button' : undefined}
      aria-label={
        canClick
          ? `Place bit at row ${row + 1}, column ${col + 1}`
          : cell.value !== null
          ? `Bit ${cell.value} placed by ${cell.placedBy}`
          : 'Empty cell'
      }
    >
      {cell.value !== null && (
        <span className="bit-cell__value">{cell.value}</span>
      )}
      {open && cellRef.current && (
        <BitSelector
          onSelect={handleSelect}
          onClose={handleClose}
          onClear={gameMode === 'solo' ? handleClear : undefined}
          currentValue={cell.value}
          anchor={cellRef.current.getBoundingClientRect()}
        />
      )}
    </div>
  );
}
