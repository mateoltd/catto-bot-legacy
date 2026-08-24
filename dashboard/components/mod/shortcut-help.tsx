'use client';

import { IconX, IconKeyboard } from '@/lib/mod-icons';
import { useEscapeClose } from '@/hooks/use-escape-close';
import { useTranslations } from 'next-intl';

interface ShortcutHelpProps {
  onClose: () => void;
}

interface ShortcutGroup {
  label: string;
  shortcuts: { key: string; description: string }[];
}

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const t = useTranslations('Moderation');
  const shortcutGroups: ShortcutGroup[] = [
    {
      label: t('shortcutNavigation'),
      shortcuts: [
        { key: 'G O', description: t('goToOverview') },
        { key: 'G C', description: t('goToCases') },
        { key: 'G E', description: t('goToEvidence') },
        { key: 'G S', description: t('backToServers') },
        { key: 'Ctrl+K', description: t('openCommandPalette') },
      ],
    },
    {
      label: t('shortcutLists'),
      shortcuts: [
        { key: 'j', description: t('navigateDown') },
        { key: 'k', description: t('navigateUp') },
        { key: 'Enter', description: t('openSelectedItem') },
      ],
    },
    {
      label: t('shortcutEvidence'),
      shortcuts: [
        { key: 'd', description: t('downloadSelectedEvidence') },
        { key: 'h', description: t('viewAmendmentHistory') },
        { key: 'a', description: t('amendSelectedEvidence') },
        { key: 'n', description: t('openEvidenceWizard') },
      ],
    },
    {
      label: t('shortcutGeneral'),
      shortcuts: [
        { key: '?', description: t('showShortcutHelp') },
        { key: 'Esc', description: t('closeOrDeselect') },
      ],
    },
  ];
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
            <h2 className="text-lg font-semibold text-[var(--mono-white)]">{t('keyboardShortcuts')}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-1 text-[var(--mod-text-dim)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] hover:text-[var(--mono-white)]"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {shortcutGroups.map((group) => (
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
          {t('shortcutsDisabledInInput')}
        </p>
      </div>
    </div>
  );
}
