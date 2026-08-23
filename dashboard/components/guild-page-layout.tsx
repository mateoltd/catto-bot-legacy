'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserDropdown } from '@/components/user-dropdown';
import { Input } from '@/components/ui/input';
import type { Guild, User } from '@/lib/types';

interface GuildPageLayoutProps {
  guild: Guild;
  user: User;
  activeTab: 'overview' | 'text-xp' | 'voice-xp' | 'rewards' | 'temp-voice' | 'logs';
  pageTitle: string;
  children: React.ReactNode;
}

export default function GuildPageLayout({
  guild,
  user,
  activeTab,
  pageTitle,
  children,
}: GuildPageLayoutProps) {
  const pathname = usePathname();

  const guildIconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
    : null;

  const navItems = [
    {
      id: 'overview',
      href: `/guilds/${guild.id}`,
      label: 'Overview',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      id: 'text-xp',
      href: `/guilds/${guild.id}/xp`,
      label: 'Text XP',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    },
    {
      id: 'voice-xp',
      href: `/guilds/${guild.id}/voice-xp`,
      label: 'Voice XP',
      icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    },
    {
      id: 'rewards',
      href: `/guilds/${guild.id}/rewards`,
      label: 'Rewards',
      icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
    },
    {
      id: 'temp-voice',
      href: `/guilds/${guild.id}/temp-voice`,
      label: 'Temp Voice',
      icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
    },
    {
      id: 'logs',
      href: `/guilds/${guild.id}/logs`,
      label: 'Logging',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-float" />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px] animate-float"
          style={{ animationDelay: '-2s' }}
        />
      </div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back button + Guild info */}
            <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
              <Link
                href="/guilds"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Back to servers"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>

              {guildIconUrl ? (
                <img
                  src={guildIconUrl}
                  alt={guild.name}
                  className="w-10 h-10 rounded-full ring-2 ring-primary/20 flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-lg font-semibold ring-2 ring-primary/20 flex-shrink-0">
                  {guild.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="hidden sm:block min-w-0">
                <h1 className="text-base font-semibold text-foreground truncate">{guild.name}</h1>
                <p className="text-xs text-muted-foreground truncate">{pageTitle}</p>
              </div>
            </div>

            {/* Center: Search (hidden on mobile) */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <Input
                type="search"
                placeholder="Search settings..."
                variant="pill"
                className="w-full"
              />
            </div>

            {/* Right: Icons + User dropdown */}
            <div className="flex items-center gap-2">
              {/* Notification icon */}
              <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </button>

              {/* Help icon */}
              <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>

              <div className="h-6 w-px bg-border/50 mx-1" />

              <UserDropdown user={user} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <nav className="glass rounded-xl border border-border/50 p-3 space-y-1">
              {/* Server name header for mobile */}
              <div className="sm:hidden px-3 py-2 mb-2 border-b border-border/50">
                <h2 className="font-semibold text-foreground truncate">{guild.name}</h2>
                <p className="text-xs text-muted-foreground">{pageTitle}</p>
              </div>

              {navItems.map((item) => {
                const isActive = item.id === activeTab;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 relative ${
                      isActive
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full glow-blue" />
                    )}

                    <svg
                      className={`w-5 h-5 flex-shrink-0 transition-colors ${
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={item.icon}
                      />
                    </svg>
                    <span>{item.label}</span>

                    {/* Hover arrow indicator */}
                    <svg
                      className={`w-4 h-4 ml-auto opacity-0 -translate-x-2 transition-all ${
                        isActive
                          ? 'opacity-100 translate-x-0'
                          : 'group-hover:opacity-50 group-hover:translate-x-0'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                );
              })}
            </nav>

            {/* Quick stats card */}
            <div className="glass rounded-xl border border-border/50 p-4 mt-4 hidden lg:block">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Quick Stats
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Server ID</span>
                  <span className="text-sm font-mono text-foreground">{guild.id.slice(-6)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Your Role</span>
                  <span className="text-sm text-primary font-medium">
                    {guild.owner ? 'Owner' : 'Manager'}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-w-0 animate-fade-in">{children}</main>
        </div>
      </div>
    </div>
  );
}
