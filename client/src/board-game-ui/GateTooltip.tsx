import { evaluateGate } from '@boolean-logic/shared';
import type { BoardState } from '@boolean-logic/shared';
import './GateTooltip.css';

interface GateTooltipProps {
  row:    number;
  col:    number;
  state:  BoardState;
  anchor: DOMRect;
}

function getDirectionValue(
  cells: BoardState['cells'],
  gateRow: number,
  gateCol: number,
  dir: 'horizontal' | 'vertical',
): string {
  const BOARD_SIZE = 7;

  const [r1, c1, r2, c2] =
    dir === 'horizontal'
      ? [gateRow, gateCol - 1, gateRow, gateCol + 1]
      : [gateRow - 1, gateCol, gateRow + 1, gateCol];

  if (
    r1 < 0 || r1 >= BOARD_SIZE || c1 < 0 || c1 >= BOARD_SIZE ||
    r2 < 0 || r2 >= BOARD_SIZE || c2 < 0 || c2 >= BOARD_SIZE
  ) {
    return '—';
  }

  const cell1 = cells[r1][c1];
  const cell2 = cells[r2][c2];

  if (
    cell1.type !== 'bit' || cell2.type !== 'bit' ||
    cell1.value === null || cell2.value === null
  ) {
    return '—';
  }

  const gateCell = cells[gateRow][gateCol];
  if (gateCell.type !== 'gate') return '—';

  const result = evaluateGate(gateCell.gate, [cell1.value === 1, cell2.value === 1]);
  return result ? '1' : '0';
}

export function GateTooltip({ row, col, state, anchor }: GateTooltipProps) {
  const cell = state.cells[row][col];
  if (cell.type !== 'gate') return null;

  const openBelow = anchor.top < window.innerHeight * 0.35;
  const style: React.CSSProperties = openBelow
    ? { top: anchor.bottom + 6, left: anchor.left + anchor.width / 2 }
    : { bottom: window.innerHeight - anchor.top + 6, left: anchor.left + anchor.width / 2 };

  const hValue = getDirectionValue(state.cells, row, col, 'horizontal');
  const vValue = getDirectionValue(state.cells, row, col, 'vertical');

  return (
    <div className={`gate-tooltip${openBelow ? ' gate-tooltip--below' : ''}`} style={style}>
      <div className="gate-tooltip__gate">{cell.gate}</div>
      <div className="gate-tooltip__row">
        <span className="gate-tooltip__label">H:</span>
        <span className={`gate-tooltip__value${hValue === '—' ? ' gate-tooltip__value--na' : ''}`}>
          {hValue}
        </span>
      </div>
      <div className="gate-tooltip__row">
        <span className="gate-tooltip__label">V:</span>
        <span className={`gate-tooltip__value${vValue === '—' ? ' gate-tooltip__value--na' : ''}`}>
          {vValue}
        </span>
      </div>
    </div>
  );
}
