'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  getGuildNavigation,
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
  const iconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="border-b border-border p-4">
        <Link
          href="/guilds"
          onClick={onNavigate}
          className="mb-3 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          &larr; All servers
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          {iconUrl ? (
            <Image src={iconUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-muted font-mono text-sm text-foreground">
              {guild.name.charAt(0).toLocaleUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{guild.name}</p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {access.canConfigure && access.canModerate
                ? 'Configuration + moderation'
                : access.canConfigure
                  ? 'Configuration'
                  : 'Moderation'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {getGuildNavigation(guild.id, access).map((section) => (
          <div key={section.label} className="mb-4">
            <p className="mb-1 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              {section.label}
            </p>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (!['overview', 'moderation'].includes(item.id) &&
                  pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={`mb-0.5 flex items-center gap-2 px-3 py-2.5 text-xs transition-colors ${
                    isActive
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="ml-auto font-mono text-[9px] opacity-60">
                      {item.shortcut}
                    </span>
                  )}
                </Link>
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
