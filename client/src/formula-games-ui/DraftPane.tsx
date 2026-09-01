import React, { useState, useRef, useEffect } from 'react';
import { DraftKeyboard } from './DraftKeyboard.js';
import './DraftPane.css';

interface DraftPaneProps {
  initialText?: string;
}

export function DraftPane({ initialText }: DraftPaneProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !initialText) return;
    const len = textarea.value.length;
    textarea.focus();
    textarea.setSelectionRange(len, len);
  }, []);

  useEffect(() => {
    if (!keyboardOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setKeyboardOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [keyboardOpen]);

  function insertAtCursor(text: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end   = textarea.selectionEnd   ?? textarea.value.length;

    const before = textarea.value.slice(0, start);
    const after  = textarea.value.slice(end);
    textarea.value = before + text + after;

    // Restore cursor position after the inserted text
    const cursorPosition = start + text.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
    textarea.focus();
  }

  function handleBackspace() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end   = textarea.selectionEnd   ?? textarea.value.length;

    if (start !== end) {
      // Selection exists — delete it
      const before = textarea.value.slice(0, start);
      const after  = textarea.value.slice(end);
      textarea.value = before + after;
      textarea.setSelectionRange(start, start);
    } else if (start > 0) {
      // No selection — delete one char to the left
      const before = textarea.value.slice(0, start - 1);
      const after  = textarea.value.slice(start);
      textarea.value = before + after;
      textarea.setSelectionRange(start - 1, start - 1);
    }
    textarea.focus();
  }

  return (
    <div className="draft-pane-wrapper" ref={wrapperRef}>
      <div className="draft-pane-editor">
        <textarea
          ref={textareaRef}
          className="draft-pane-textarea"
          defaultValue={initialText}
          placeholder="Draft area — write your working here…"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className={`draft-pane-keyboard-toggle${keyboardOpen ? ' draft-pane-keyboard-toggle--active' : ''}`}
          type="button"
          title={keyboardOpen ? 'Close keyboard' : 'Open on-screen keyboard'}
          onClick={() => setKeyboardOpen(previousValue => !previousValue)}
        >
          ⌨
        </button>
      </div>

      {keyboardOpen && (
        <DraftKeyboard
          onKey={insertAtCursor}
          onBackspace={handleBackspace}
        />
      )}
    </div>
  );
}
