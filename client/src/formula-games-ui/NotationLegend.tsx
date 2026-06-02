import React, { useState, useRef, useEffect } from 'react';
import './NotationLegend.css';

export function NotationLegend() {
  const [open, setOpen] = useState(false);
  const containerRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open]);

  return (
    <div
      className={`notation-legend-container${open ? ' notation-legend-container--open' : ''}`}
      ref={containerRef}
    >
      <button
        className="notation-legend-button"
        onClick={() => setOpen(previousValue => !previousValue)}
        type="button"
      >
        Logic Gates Notation Legend
      </button>

      <div className="notation-legend-panel">
        <table className="notation-legend-table">
          <thead>
            <tr>
              <th>Mathematical</th>
              <th>Text</th>
              <th>C language</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="notation-legend-math">x ∨ y</td>
              <td>x or y</td>
              <td>x | y</td>
            </tr>
            <tr>
              <td className="notation-legend-math">x ∧ y</td>
              <td>x and y</td>
              <td>x &amp; y</td>
            </tr>
            <tr>
              <td className="notation-legend-math">x ⊕ y</td>
              <td>x xor y</td>
              <td>x ^ y</td>
            </tr>
            <tr>
              <td className="notation-legend-math"><span className="notation-legend-overline">x</span></td>
              <td>not(x)</td>
              <td>!x</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
