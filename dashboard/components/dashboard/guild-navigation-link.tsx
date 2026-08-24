'use client';

import Link from 'next/link';
import type { GuildNavigationItem } from '@/lib/guild-navigation';

interface GuildNavigationLinkProps {
  item: GuildNavigationItem;
  isActive: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}

export function GuildNavigationLink({
  item,
  isActive,
  compact = false,
  onNavigate,
}: GuildNavigationLinkProps) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-2 text-xs transition-colors ${
        compact ? 'shrink-0 px-3 py-3' : 'mb-0.5 px-3 py-2.5'
      } ${
        isActive
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <item.icon size={16} />
      <span>{item.label}</span>
      {!compact && item.shortcut && (
        <span className="ml-auto font-mono text-[9px] opacity-60">{item.shortcut}</span>
      )}
    </Link>
  );
}
