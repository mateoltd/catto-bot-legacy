'use client';

import Image from 'next/image';
import { createContext, useContext, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AccountMenu } from '@/components/dashboard/account-menu';
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar';
import { GuildNavigationLink } from '@/components/dashboard/guild-navigation-link';
import { GuildSidebar } from '@/components/dashboard/guild-sidebar';
import {
  getGuildNavigation,
  isGuildNavigationItemActive,
  type GuildNavigationAccess,
} from '@/lib/guild-navigation';
import { UserDropdown } from '@/components/user-dropdown';
import type { Guild, User } from '@/lib/types';

interface GuildPageLayoutProps {
  guild: Guild;
  user: User;
  access: GuildNavigationAccess;
  children: React.ReactNode;
}

interface GuildDashboardContextValue {
  guild: Guild;
  user: User;
  access: GuildNavigationAccess;
}

const GuildDashboardContext = createContext<GuildDashboardContextValue | null>(null);

export function useGuildDashboard() {
  const context = useContext(GuildDashboardContext);
  if (!context) throw new Error('useGuildDashboard must be used inside GuildPageLayout');
  return context;
}

export default function GuildPageLayout({
  guild,
  user,
  access,
  children,
}: GuildPageLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const guildIconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`
    : null;
  const navigation = getGuildNavigation(guild.id, access).flatMap((section) => section.items);
  const activeItem = navigation.find((item) => isGuildNavigationItemActive(pathname, item));
  const configurationPrefix = `/guilds/${guild.id}/`;
  const configurationRoute = pathname.startsWith(configurationPrefix);
  const accessDenied = configurationRoute && !access.canConfigure;

  useEffect(() => {
    if (accessDenied) router.replace(`/guilds/${guild.id}`);
  }, [accessDenied, guild.id, router]);

  return (
    <GuildDashboardContext.Provider value={{ guild, user, access }}>
      <div className="min-h-screen bg-background">
        <DashboardTopbar
          showServersLink
          trailing={
            <div className="md:hidden">
              <UserDropdown user={user} />
            </div>
          }
        />

        <div className="border-b border-border bg-card px-4 py-4 sm:hidden">
          <ServerIdentity
            guild={guild}
            iconUrl={guildIconUrl}
            pageTitle={activeItem?.label ?? 'Overview'}
          />
        </div>

        <nav className="scrollbar-none flex overflow-x-auto border-b border-border bg-card px-2 sm:hidden">
          {navigation.map((item) => (
            <GuildNavigationLink
              key={item.id}
              item={item}
              isActive={item.id === activeItem?.id}
              compact
            />
          ))}
        </nav>

        <div className="grid w-full md:grid-cols-[224px_minmax(0,1fr)]">
          <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] border-r border-border bg-card md:flex md:flex-col">
            <GuildSidebar
              guild={guild}
              access={access}
              account={<AccountMenu user={user} variant="sidebar" allowAccountSwitch />}
            />
          </aside>

          <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
            {accessDenied ? null : children}
          </main>
        </div>
      </div>
    </GuildDashboardContext.Provider>
  );
}

function ServerIdentity({
  guild,
  iconUrl,
  pageTitle,
}: {
  guild: Guild;
  iconUrl: string | null;
  pageTitle: string;
}) {
  return (
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
        <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {pageTitle}
        </p>
      </div>
    </div>
  );
}
