'use client';

import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UnsavedChangesBarProps {
  visible: boolean;
  saving?: boolean;
  disabled?: boolean;
  onSave?: () => void;
  saveLabel?: string;
  message?: string;
  className?: string;
}

export function UnsavedChangesBar({
  visible,
  saving = false,
  disabled = false,
  onSave,
  saveLabel,
  message,
  className,
}: UnsavedChangesBarProps) {
  const t = useTranslations('ConfigCommon');
  const resolvedSaveLabel = saveLabel ?? t('saveChanges');
  const resolvedMessage = message ?? t('unsavedChanges');

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:left-56">
      <div
        role="status"
        className={cn(
          'pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-4 border border-foreground/30 bg-foreground px-3 py-3 text-background shadow-[0_12px_40px_rgba(0,0,0,0.55)] sm:px-4',
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="truncate font-mono text-xs font-medium uppercase tracking-wide">
            {saving ? t('savingChanges') : resolvedMessage}
          </span>
        </div>
        <Button
          type={onSave ? 'button' : 'submit'}
          aria-label={resolvedSaveLabel}
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={saving || disabled}
          className="shrink-0 border-background/30 bg-background text-foreground hover:bg-background/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          <span className="hidden sm:inline">{resolvedSaveLabel}</span>
          <span className="sm:hidden">{t('save')}</span>
        </Button>
      </div>
    </div>
  );
}
