import React from 'react';
import './DraftKeyboard.css';

interface DraftKeyboardProps {
  onKey:      (text: string) => void;
  onBackspace: () => void;
}

interface KeyDefinition {
  label:   string;
  value:   string;
  wide?:   boolean;
}

// All variables that can ever appear across all difficulty levels
const ALL_VARIABLES = ['x', 'y', 'z', 'w'];

export function DraftKeyboard({ onKey, onBackspace }: DraftKeyboardProps) {
  const variableKeys: KeyDefinition[] = ALL_VARIABLES.map(variable => ({ label: variable, value: variable }));

  const mathKeys: KeyDefinition[] = [
    { label: '∧',  value: '∧'  },
    { label: '∨',  value: '∨'  },
    { label: '⊕',  value: '⊕'  },
    { label: '¬',  value: '¬'  },
  ];

  const textKeys: KeyDefinition[] = [
    { label: 'and',  value: 'and',  wide: true },
    { label: 'or',   value: 'or'              },
    { label: 'xor',  value: 'xor',  wide: true },
    { label: 'not',  value: 'not',  wide: true },
  ];

  const cKeys: KeyDefinition[] = [
    { label: '&',  value: '&' },
    { label: '|',  value: '|' },
    { label: '^',  value: '^' },
    { label: '!',  value: '!' },
  ];

  const commonKeys: KeyDefinition[] = [
    { label: '(',    value: '('   },
    { label: ')',    value: ')'   },
    { label: '=',    value: '='   },
    { label: '0',    value: '0'   },
    { label: '1',    value: '1'   },
    { label: 'Space', value: ' '  },
  ];

  function renderRow(label: string, keys: KeyDefinition[]) {
    return (
      <div className="draft-keyboard-row">
        <span className="draft-keyboard-row-label">{label}</span>
        <div className="draft-keyboard-keys">
          {keys.map(key => (
            <button
              key={key.value + key.label}
              className={`draft-keyboard-key${key.wide ? ' draft-keyboard-key--wide' : ''}`}
              type="button"
              onMouseDown={e => { e.preventDefault(); onKey(key.value); }}
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="draft-keyboard-container">
      {renderRow('Variables', variableKeys)}
      {renderRow('Math', mathKeys)}
      {renderRow('Text', textKeys)}
      {renderRow('C', cKeys)}
      <div className="draft-keyboard-row">
        <span className="draft-keyboard-row-label">Common</span>
        <div className="draft-keyboard-keys">
          {commonKeys.map(key => (
            <button
              key={key.label}
              className="draft-keyboard-key"
              type="button"
              onMouseDown={e => { e.preventDefault(); onKey(key.value); }}
            >
              {key.label}
            </button>
          ))}
          <button
            className="draft-keyboard-key draft-keyboard-key--wide draft-keyboard-key--backspace"
            type="button"
            onMouseDown={e => { e.preventDefault(); onBackspace(); }}
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}
