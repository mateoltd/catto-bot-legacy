export const dynamic = 'force-dynamic';
import { getUserSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import GuildPageLayout from '@/components/guild-page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { Guild } from '@/lib/types';

export default async function GuildPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await getUserSession();

  if (!session) {
    redirect('/');
  }

  const { user, guilds } = session;
  const guild = guilds.find((g: Guild) => g.id === guildId);

  if (!guild) {
    redirect('/guilds');
  }

  const hasManageGuild = (BigInt(guild.permissions) & BigInt(0x20)) !== BigInt(0);
  const canManage = guild.owner || hasManageGuild;

  if (!canManage) {
    redirect('/guilds');
  }

  const quickActions = [
    {
      href: `/guilds/${guild.id}/xp`,
      label: 'Configure Text XP',
      description: 'Set up XP rewards for chat activity',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    },
    {
      href: `/guilds/${guild.id}/voice-xp`,
      label: 'Configure Voice XP',
      description: 'Reward members for voice channel time',
      icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    },
    {
      href: `/guilds/${guild.id}/rewards`,
      label: 'Manage Rewards',
      description: 'Create role rewards for leveling up',
      icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
    },
    {
      href: `/guilds/${guild.id}/temp-voice`,
      label: 'Temp Voice Channels',
      description: 'Enable temporary voice channels',
      icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
    },
    {
      href: `/guilds/${guild.id}/logs`,
      label: 'Setup Logging',
      description: 'Configure event logging channels',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
  ];

  return (
    <GuildPageLayout guild={guild} user={user} activeTab="overview" pageTitle="Overview">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Server Overview</h2>
            <p className="text-muted-foreground mt-1">Manage your server settings and modules</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Server Status */}
          <Card variant="glass" className="hover-scale group">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10 text-success">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Bot Status</p>
                  <p className="text-lg font-semibold text-foreground">Online</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Role */}
          <Card variant="glass" className="hover-scale group">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Your Role</p>
                  <p className="text-lg font-semibold text-primary">
                    {guild.owner ? 'Owner' : 'Manager'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Server ID */}
          <Card variant="glass" className="hover-scale group sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-secondary/10 text-secondary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">Server ID</p>
                  <p className="text-sm font-mono text-foreground truncate">{guild.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-muted/30 hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
                >
                  <div className="p-2.5 rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={action.icon}
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {action.label}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{action.description}</p>
                  </div>
                  <svg
                    className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all"
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
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Getting Started Tips */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">Enable XP System</p>
                  <p className="text-sm text-muted-foreground">
                    Configure text and voice XP to reward active members
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">Set Up Rewards</p>
                  <p className="text-sm text-muted-foreground">
                    Create role rewards that members unlock when leveling up
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">Configure Logging</p>
                  <p className="text-sm text-muted-foreground">
                    Keep track of moderation actions and server events
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </GuildPageLayout>
  );
}
