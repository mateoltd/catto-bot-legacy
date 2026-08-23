'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useGuildInfo } from '@/hooks/use-guild-info';

const SEGMENT_LABELS: Record<string, string> = {
  cases: 'Cases',
  evidence: 'Evidence',
  audit: 'Audit Log',
  reports: 'Reports',
  automod: 'Auto-Mod Rules',
  filters: 'Filters & Triggers',
  settings: 'Settings',
};

export function ModBreadcrumb() {
  const pathname = usePathname();
  const params = useParams();
  const guildId = params.guildId as string;
  const guildInfo = useGuildInfo(guildId);

  // Build breadcrumb segments from pathname
  // /mod/123456/cases/5 -> ["SERVERS", "Guild Name", "Cases", "#5"]
  const segments: { label: string; href?: string }[] = [
    { label: 'SERVERS', href: '/mod' },
  ];

  if (guildInfo) {
    segments.push({ label: guildInfo.name, href: `/mod/${guildId}` });
  } else {
    segments.push({ label: guildId, href: `/mod/${guildId}` });
  }

  // Parse remaining path segments after /mod/[guildId]
  const basePath = `/mod/${guildId}`;
  const remainder = pathname.slice(basePath.length);
  const parts = remainder.split('/').filter(Boolean);

  let currentPath = basePath;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    currentPath += `/${part}`;
    const isLast = i === parts.length - 1;

    // Check if this looks like a case number (all digits)
    if (/^\d+$/.test(part)) {
      segments.push({
        label: `#${part}`,
        href: isLast ? undefined : currentPath,
      });
    } else {
      segments.push({
        label: SEGMENT_LABELS[part] || part.charAt(0).toUpperCase() + part.slice(1),
        href: isLast ? undefined : currentPath,
      });
    }
  }

  // Don't show breadcrumb if we're just at the overview page (only SERVERS / Guild Name)
  if (segments.length <= 2 && pathname === basePath) {
    return null;
  }

  return (
    <nav
      className="mb-6 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-[var(--mod-text-dim)] scrollbar-none"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[var(--mono-600)]">/</span>}
          {seg.href ? (
            <Link
              href={seg.href}
              className="uppercase tracking-wider transition-[color] duration-75 hover:text-[var(--mod-text-muted)]"
            >
              {seg.label}
            </Link>
          ) : (
            <span className="uppercase tracking-wider text-[var(--mod-text-muted)]">
              {seg.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
