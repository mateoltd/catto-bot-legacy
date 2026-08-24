import {
  IconBolt,
  IconChartBar,
  IconFolder,
  IconGavel,
  IconGift,
  IconHome,
  IconListDetails,
  IconMicrophone,
  IconUsers,
  IconWaveSine,
  type Icon,
} from '@tabler/icons-react';

export interface GuildNavigationAccess {
  canConfigure: boolean;
  canModerate: boolean;
}

export interface GuildNavigationItem {
  id: string;
  label: string;
  href: string;
  icon: Icon;
  shortcut?: string;
}

export type GuildNavigationLabelKey =
  | 'server'
  | 'configuration'
  | 'moderation'
  | 'overview'
  | 'textXp'
  | 'voiceXp'
  | 'rewards'
  | 'tempVoice'
  | 'logging'
  | 'cases'
  | 'evidence'
  | 'users'
  | 'analytics';

const defaultLabels: Record<GuildNavigationLabelKey, string> = {
  server: 'Server',
  configuration: 'Configuration',
  moderation: 'Moderation',
  overview: 'Overview',
  textXp: 'Text XP',
  voiceXp: 'Voice XP',
  rewards: 'Rewards',
  tempVoice: 'Temp voice',
  logging: 'Logging',
  cases: 'Cases',
  evidence: 'Evidence',
  users: 'Users',
  analytics: 'Analytics',
};

export function isGuildNavigationItemActive(
  pathname: string,
  item: GuildNavigationItem,
): boolean {
  return (
    pathname === item.href ||
    (!['overview', 'moderation'].includes(item.id) && pathname.startsWith(`${item.href}/`))
  );
}

interface GuildNavigationSection {
  label: string;
  items: GuildNavigationItem[];
}

export function getGuildNavigation(
  guildId: string,
  access: GuildNavigationAccess,
  translate: (key: GuildNavigationLabelKey) => string = (key) => defaultLabels[key],
): GuildNavigationSection[] {
  const sections: GuildNavigationSection[] = [
    {
      label: translate('server'),
      items: [
        {
          id: 'overview',
          label: translate('overview'),
          href: `/guilds/${guildId}`,
          icon: IconHome,
        },
      ],
    },
  ];

  if (access.canConfigure) {
    sections.push({
      label: translate('configuration'),
      items: [
        {
          id: 'text-xp',
          label: translate('textXp'),
          href: `/guilds/${guildId}/xp`,
          icon: IconBolt,
        },
        {
          id: 'voice-xp',
          label: translate('voiceXp'),
          href: `/guilds/${guildId}/voice-xp`,
          icon: IconWaveSine,
        },
        {
          id: 'rewards',
          label: translate('rewards'),
          href: `/guilds/${guildId}/rewards`,
          icon: IconGift,
        },
        {
          id: 'temp-voice',
          label: translate('tempVoice'),
          href: `/guilds/${guildId}/temp-voice`,
          icon: IconMicrophone,
        },
        {
          id: 'logs',
          label: translate('logging'),
          href: `/guilds/${guildId}/logs`,
          icon: IconListDetails,
        },
      ],
    });
  }

  if (access.canModerate) {
    sections.push({
      label: translate('moderation'),
      items: [
        {
          id: 'moderation',
          label: translate('overview'),
          href: `/mod/${guildId}`,
          icon: IconGavel,
          shortcut: 'G O',
        },
        {
          id: 'cases',
          label: translate('cases'),
          href: `/mod/${guildId}/cases`,
          icon: IconGavel,
          shortcut: 'G C',
        },
        {
          id: 'evidence',
          label: translate('evidence'),
          href: `/mod/${guildId}/evidence`,
          icon: IconFolder,
          shortcut: 'G E',
        },
        {
          id: 'users',
          label: translate('users'),
          href: `/mod/${guildId}/users`,
          icon: IconUsers,
          shortcut: 'G U',
        },
        {
          id: 'analytics',
          label: translate('analytics'),
          href: `/mod/${guildId}/analytics`,
          icon: IconChartBar,
          shortcut: 'G A',
        },
      ],
    });
  }

  return sections;
}
