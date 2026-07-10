import { createPortal } from 'react-dom';
import type { BitValue } from '@boolean-logic/shared';
import './BitSelector.css';

interface BitSelectorProps {
  onSelect:     (value: BitValue) => void;
  onClose:      () => void;
  onClear?:     () => void;
  currentValue?: BitValue | null;
  anchor:       DOMRect;
}

export function BitSelector({ onSelect, onClose, onClear, currentValue, anchor }: BitSelectorProps) {
  const openBelow = anchor.top < window.innerHeight * 0.35;

  const popupStyle: React.CSSProperties = openBelow
    ? { top: anchor.bottom + 6, left: anchor.left + anchor.width / 2 }
    : { bottom: window.innerHeight - anchor.top + 6, left: anchor.left + anchor.width / 2 };

  return createPortal(
    <>
      <div className="bit-selector__backdrop" onClick={e => { e.stopPropagation(); onClose(); }} />
      <div className="bit-selector" style={popupStyle}>
        <button
          className={`bit-selector__option bit-selector__option--zero${currentValue === 0 ? ' bit-selector__option--active' : ''}`}
          onClick={e => { e.stopPropagation(); onSelect(0); }}
        >
          0
        </button>
        <button
          className={`bit-selector__option bit-selector__option--one${currentValue === 1 ? ' bit-selector__option--active' : ''}`}
          onClick={e => { e.stopPropagation(); onSelect(1); }}
        >
          1
        </button>
        {onClear !== undefined && (
          <button
            className={`bit-selector__option bit-selector__option--empty${currentValue === null ? ' bit-selector__option--active' : ''}`}
            onClick={e => { e.stopPropagation(); onClear(); }}
          >
            —
          </button>
        )}
      </div>
    </>,
    document.body,
  );
}
