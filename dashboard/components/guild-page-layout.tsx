import Link from 'next/link';
import Image from 'next/image';
import {
  IconArrowLeft,
  IconBolt,
  IconGift,
  IconGavel,
  IconHome,
  IconListDetails,
  IconMicrophone,
  IconWaveSine,
  type Icon,
} from '@tabler/icons-react';
import { BrandMark } from '@/components/dashboard/brand-mark';
import { UserDropdown } from '@/components/user-dropdown';
import type { Guild, User } from '@/lib/types';

type DashboardTab = 'overview' | 'text-xp' | 'voice-xp' | 'rewards' | 'temp-voice' | 'logs';

interface GuildPageLayoutProps {
  guild: Guild;
  user: User;
  activeTab: DashboardTab;
  pageTitle: string;
  children: React.ReactNode;
}

interface NavigationItem {
  id: DashboardTab | 'moderation';
  label: string;
  href: string;
  icon: Icon;
}

function getNavigation(guildId: string): NavigationItem[] {
  return [
    { id: 'overview', label: 'Overview', href: `/guilds/${guildId}`, icon: IconHome },
    { id: 'text-xp', label: 'Text XP', href: `/guilds/${guildId}/xp`, icon: IconBolt },
    {
      id: 'voice-xp',
      label: 'Voice XP',
      href: `/guilds/${guildId}/voice-xp`,
      icon: IconWaveSine,
    },
    { id: 'rewards', label: 'Rewards', href: `/guilds/${guildId}/rewards`, icon: IconGift },
    {
      id: 'temp-voice',
      label: 'Temp voice',
      href: `/guilds/${guildId}/temp-voice`,
      icon: IconMicrophone,
    },
    { id: 'logs', label: 'Logging', href: `/guilds/${guildId}/logs`, icon: IconListDetails },
    { id: 'moderation', label: 'Moderation', href: `/mod/${guildId}`, icon: IconGavel },
  ];
}

export default function GuildPageLayout({
  guild,
  user,
  activeTab,
  pageTitle,
  children,
}: GuildPageLayoutProps) {
  const guildIconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`
    : null;
  const navigation = getNavigation(guild.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <BrandMark compact />
            <span className="hidden h-6 w-px bg-border sm:block" />
            <Link
              href="/guilds"
              className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground sm:flex"
            >
              <IconArrowLeft size={14} />
              Servers
            </Link>
          </div>
          <UserDropdown user={user} />
        </div>
      </header>

      <div className="border-b border-border bg-card px-4 py-4 sm:hidden">
        <ServerIdentity guild={guild} iconUrl={guildIconUrl} pageTitle={pageTitle} />
      </div>

      <nav className="scrollbar-none flex overflow-x-auto border-b border-border bg-card px-2 sm:hidden">
        {navigation.map((item) => (
          <NavigationLink key={item.id} item={item} isActive={item.id === activeTab} compact />
        ))}
      </nav>

      <div className="grid w-full md:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] border-r border-border bg-card md:flex md:flex-col">
          <div className="border-b border-border p-4">
            <ServerIdentity guild={guild} iconUrl={guildIconUrl} pageTitle={pageTitle} />
          </div>
          <nav className="flex-1 p-2">
            <p className="mb-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Configuration
            </p>
            {navigation.map((item) => (
              <NavigationLink key={item.id} item={item} isActive={item.id === activeTab} />
            ))}
          </nav>
          <div className="border-t border-border px-4 py-3 font-mono text-[10px] text-muted-foreground">
            ID {guild.id}
          </div>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
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

function NavigationLink({
  item,
  isActive,
  compact = false,
}: {
  item: NavigationItem;
  isActive: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={item.href}
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
    </Link>
  );
}
