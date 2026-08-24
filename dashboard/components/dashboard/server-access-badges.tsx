'use client';

import { IconSettings, IconShield } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ServerAccessBadgesProps {
  canConfigure: boolean;
  canModerate: boolean;
  className?: string;
  focusable?: boolean;
}

export function ServerAccessBadges({
  canConfigure,
  canModerate,
  className,
  focusable = true,
}: ServerAccessBadgesProps) {
  const t = useTranslations('Access');
  if (!canConfigure && !canModerate) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex items-center gap-1.5', className)} aria-label={t('serverAccess')}>
        {canConfigure && (
          <AccessBadge label={t('configuration')} focusable={focusable}>
            <IconSettings size={13} stroke={1.5} aria-hidden="true" />
          </AccessBadge>
        )}
        {canModerate && (
          <AccessBadge label={t('moderation')} focusable={focusable}>
            <IconShield size={13} stroke={1.5} aria-hidden="true" />
          </AccessBadge>
        )}
      </div>
    </TooltipProvider>
  );
}

function AccessBadge({
  label,
  children,
  focusable,
}: {
  label: string;
  children: React.ReactNode;
  focusable: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={focusable ? 0 : undefined}
          aria-label={label}
          className="inline-flex h-5 w-5 items-center justify-center border border-border text-muted-foreground outline-none transition-colors hover:border-muted-foreground hover:text-foreground focus-visible:border-foreground focus-visible:text-foreground"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="rounded-none font-mono text-[10px] uppercase tracking-wider">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
