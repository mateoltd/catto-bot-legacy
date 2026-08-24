'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IconLock } from '@/lib/mod-icons';
import { useModPermissions } from '@/hooks/use-mod-permissions';
import { useTranslations } from 'next-intl';

interface SectionGateProps {
  /** Key from DashboardPermissions.sections (e.g. 'evidence', 'cases') */
  section: 'cases' | 'evidence' | 'evidenceAdd' | 'evidenceCapture';
  /** Human-readable label for the denied message */
  label: string;
  children: React.ReactNode;
}

/**
 * Prevents rendering children when the user lacks access to a dashboard section.
 * Shows an inline "no permission" block instead of letting the page 403 on fetch.
 */
export function SectionGate({ section, label, children }: SectionGateProps) {
  const t = useTranslations('Moderation');
  const { guildId } = useParams() as { guildId: string };
  const { sections, isAdmin, isLoading } = useModPermissions(guildId);

  // Admins always pass
  if (isAdmin) return <>{children}</>;

  // While the layout's SWR is still resolving, show nothing (layout handles the full-page loader)
  if (isLoading) return null;

  if (!sections[section]) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <IconLock size={32} className="text-[var(--mod-text-dim)]" />
        <p
          className="text-xs uppercase tracking-widest text-[var(--mod-text-dim)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {t('permissionRequired')}
        </p>
        <p className="max-w-xs text-sm text-[var(--mod-text-muted)]">
          {t('noSectionPermission', { label })}
        </p>
        <Link
          href={`/mod/${guildId}`}
          className="mt-1 border border-[var(--mod-border)] bg-[var(--mod-surface)] px-4 py-2 text-xs uppercase tracking-widest text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mono-850)] hover:text-[var(--mono-white)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          &larr; {t('overview')}
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
