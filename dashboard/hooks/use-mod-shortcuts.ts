import { useEffect, useCallback } from 'react';

export interface ModShortcutHandlers {
  onNavigateUp?: () => void;       // k
  onNavigateDown?: () => void;     // j
  onOpen?: () => void;             // Enter
  onDownload?: () => void;         // d
  onHistory?: () => void;          // h
  onAmend?: () => void;            // a
  onNewEvidence?: () => void;      // n
  onHelp?: () => void;             // ?
}

function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((active as HTMLElement).contentEditable === 'true') return true;
  return false;
}

export function useModShortcuts(handlers: ModShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'k':
          e.preventDefault();
          handlers.onNavigateUp?.();
          break;
        case 'j':
          e.preventDefault();
          handlers.onNavigateDown?.();
          break;
        case 'Enter':
          e.preventDefault();
          handlers.onOpen?.();
          break;
        case 'd':
          e.preventDefault();
          handlers.onDownload?.();
          break;
        case 'h':
          e.preventDefault();
          handlers.onHistory?.();
          break;
        case 'a':
          e.preventDefault();
          handlers.onAmend?.();
          break;
        case 'n':
          e.preventDefault();
          handlers.onNewEvidence?.();
          break;
        case '?':
          e.preventDefault();
          handlers.onHelp?.();
          break;
      }
    },
    [handlers]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
