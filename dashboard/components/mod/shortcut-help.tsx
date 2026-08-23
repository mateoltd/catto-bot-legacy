'use client';

import { IconX, IconKeyboard } from '@/lib/mod-icons';
import { useEscapeClose } from '@/hooks/use-escape-close';

interface ShortcutHelpProps {
  onClose: () => void;
}

interface ShortcutGroup {
  label: string;
  shortcuts: { key: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'Navigation',
    shortcuts: [
      { key: 'G O', description: 'Go to Overview' },
      { key: 'G C', description: 'Go to Cases' },
      { key: 'G E', description: 'Go to Evidence' },
      { key: 'G S', description: 'Back to Servers' },
      { key: 'Ctrl+K', description: 'Open command palette' },
    ],
  },
  {
    label: 'Lists',
    shortcuts: [
      { key: 'j', description: 'Navigate down' },
      { key: 'k', description: 'Navigate up' },
      { key: 'Enter', description: 'Open selected item' },
    ],
  },
  {
    label: 'Evidence',
    shortcuts: [
      { key: 'd', description: 'Download selected evidence' },
      { key: 'h', description: 'View amendment history' },
      { key: 'a', description: 'Amend selected evidence' },
      { key: 'n', description: 'Open new evidence wizard' },
    ],
  },
  {
    label: 'General',
    shortcuts: [
      { key: '?', description: 'Show this help' },
      { key: 'Esc', description: 'Close modal / deselect' },
    ],
  },
];

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  useEscapeClose(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md border border-[var(--mod-border)] bg-[var(--mono-900)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconKeyboard size={20} className="text-[var(--mono-400)]" />
            <h2 className="text-lg font-semibold text-[var(--mono-white)]">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--mod-text-dim)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] hover:text-[var(--mono-white)]"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <p
                className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--mod-text-dim)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {group.label}
              </p>
              <div className="space-y-0 divide-y divide-[var(--mod-border)]">
                {group.shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center justify-between py-2">
                    <span className="text-sm text-[var(--mod-text-muted)]">{s.description}</span>
                    <kbd className="border border-[var(--mono-700)] bg-[var(--mono-850)] px-2 py-0.5 text-xs text-[var(--mono-300)]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-[var(--mod-text-dim)]">
          Shortcuts are disabled when a text input is focused.
        </p>
      </div>
    </div>
  );
}
