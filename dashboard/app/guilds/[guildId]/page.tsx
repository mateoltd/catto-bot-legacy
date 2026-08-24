export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  IconArrowRight,
  IconBolt,
  IconGift,
  IconGavel,
  IconListDetails,
  IconMicrophone,
  IconUsers,
  IconWaveSine,
  type Icon,
} from '@tabler/icons-react';
import GuildPageLayout from '@/components/guild-page-layout';
import { getGuildStats, getGuildOverviewPageData } from '@/lib/server';

interface ModuleLink {
  title: string;
  description: string;
  href: string;
  icon: Icon;
  capability: 'configure' | 'moderate';
}

export default async function GuildPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, user, authCookie, access } = await getGuildOverviewPageData(guildId);
  const stats = await getGuildStats(guildId, authCookie);
  const modules: ModuleLink[] = [
    {
      title: 'Text XP',
      description: 'Message rewards, cooldowns, filters, announcements, and level curves.',
      href: `/guilds/${guild.id}/xp`,
      icon: IconBolt,
      capability: 'configure',
    },
    {
      title: 'Voice XP',
      description: 'Voice session rewards, anti-farm rules, and participation filters.',
      href: `/guilds/${guild.id}/voice-xp`,
      icon: IconWaveSine,
      capability: 'configure',
    },
    {
      title: 'Rewards',
      description: 'Role rewards, permission grants, announcements, and claim history.',
      href: `/guilds/${guild.id}/rewards`,
      icon: IconGift,
      capability: 'configure',
    },
    {
      title: 'Temporary voice',
      description: 'Join channels, naming rules, defaults, moderation, and active rooms.',
      href: `/guilds/${guild.id}/temp-voice`,
      icon: IconMicrophone,
      capability: 'configure',
    },
    {
      title: 'Event logging',
      description: 'Log destinations, event categories, ignored channels, and delivery state.',
      href: `/guilds/${guild.id}/logs`,
      icon: IconListDetails,
      capability: 'configure',
    },
    {
      title: 'Moderation',
      description: 'Cases, evidence, user history, analytics, and moderation operations.',
      href: `/mod/${guild.id}`,
      icon: IconGavel,
      capability: 'moderate',
    },
  ];
  const metricCards = [
    { label: 'Members', value: stats?.memberCount },
    { label: 'Channels', value: stats?.channelCount },
    { label: 'Roles', value: stats?.roleCount },
    { label: 'Tracked users', value: stats?.databaseUsers },
  ];

  return (
    <GuildPageLayout
      guild={guild}
      user={user}
      access={access}
      activeTab="overview"
      pageTitle="Overview"
    >
      <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Server overview
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{guild.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {access.canConfigure
              ? 'Configure server modules and open moderation from one workspace.'
              : 'Open the moderation tools available to your account.'}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span
            className={`h-2 w-2 ${stats ? 'bg-green-500' : 'bg-yellow-500'}`}
            aria-hidden="true"
          />
          {stats ? 'Connected to bot' : 'Live stats unavailable'}
        </div>
      </div>

      <section aria-labelledby="server-metrics-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="server-metrics-heading"
            className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
          >
            Live server data
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {guild.owner ? 'Owner' : 'Manager'} access
          </span>
        </div>
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <div key={metric.label} className="bg-card px-4 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
                {metric.value?.toLocaleString() ?? '—'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-9" aria-labelledby="modules-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="modules-heading"
            className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
          >
            Modules
          </h2>
          <IconUsers size={16} className="text-muted-foreground" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {modules
            .filter((module) =>
              module.capability === 'configure' ? access.canConfigure : access.canModerate,
            )
            .map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="group flex min-h-32 items-start gap-4 border border-border bg-card p-5 hover:border-muted-foreground/50 hover:bg-accent"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground group-hover:text-foreground">
                  <module.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-foreground">{module.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {module.description}
                  </p>
                </div>
                <IconArrowRight size={16} className="mt-1 shrink-0 text-muted-foreground" />
              </Link>
            ))}
        </div>
      </section>

      <div className="mt-9 flex items-center justify-between border border-border bg-card px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Server ID
          </p>
          <p className="mt-1 font-mono text-xs text-foreground">{guild.id}</p>
        </div>
        {access.canModerate && (
          <Link
            href={`/mod/${guild.id}`}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Open moderation
            <IconArrowRight size={14} />
          </Link>
        )}
      </div>
    </GuildPageLayout>
  );
}
