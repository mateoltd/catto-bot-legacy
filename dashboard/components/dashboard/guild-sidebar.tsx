'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { GuildNavigationLink } from '@/components/dashboard/guild-navigation-link';
import { ServerAccessBadges } from '@/components/dashboard/server-access-badges';
import {
  getGuildNavigation,
  isGuildNavigationItemActive,
  type GuildNavigationAccess,
} from '@/lib/guild-navigation';

interface GuildSidebarProps {
  guild: {
    id: string;
    name: string;
    icon: string | null;
  };
  access: GuildNavigationAccess;
  account: React.ReactNode;
  onNavigate?: () => void;
}

export function GuildSidebar({ guild, access, account, onNavigate }: GuildSidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('Navigation');
  const iconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="border-b border-border p-4">
        <div className="flex min-w-0 items-center gap-3">
          {iconUrl ? (
            <Image src={iconUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-muted font-mono text-sm text-foreground">
              {guild.name.charAt(0).toLocaleUpperCase(locale)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{guild.name}</p>
            <ServerAccessBadges
              canConfigure={access.canConfigure}
              canModerate={access.canModerate}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {getGuildNavigation(guild.id, access, t).map((section) => (
          <div key={section.label} className="mb-4">
            <p className="mb-1 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              {section.label}
            </p>
            {section.items.map((item) => {
              const isActive = isGuildNavigationItemActive(pathname, item);
              return (
                <GuildNavigationLink
                  key={item.id}
                  item={item}
                  isActive={isActive}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-2 font-mono text-[9px] text-muted-foreground">
        ID {guild.id}
      </div>
      {account}
    </div>
  );
}
