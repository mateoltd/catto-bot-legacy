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
): GuildNavigationSection[] {
  const sections: GuildNavigationSection[] = [
    {
      label: 'Server',
      items: [
        { id: 'overview', label: 'Overview', href: `/guilds/${guildId}`, icon: IconHome },
      ],
    },
  ];

  if (access.canConfigure) {
    sections.push({
      label: 'Configuration',
      items: [
        { id: 'text-xp', label: 'Text XP', href: `/guilds/${guildId}/xp`, icon: IconBolt },
        {
          id: 'voice-xp',
          label: 'Voice XP',
          href: `/guilds/${guildId}/voice-xp`,
          icon: IconWaveSine,
        },
        {
          id: 'rewards',
          label: 'Rewards',
          href: `/guilds/${guildId}/rewards`,
          icon: IconGift,
        },
        {
          id: 'temp-voice',
          label: 'Temp voice',
          href: `/guilds/${guildId}/temp-voice`,
          icon: IconMicrophone,
        },
        {
          id: 'logs',
          label: 'Logging',
          href: `/guilds/${guildId}/logs`,
          icon: IconListDetails,
        },
      ],
    });
  }

  if (access.canModerate) {
    sections.push({
      label: 'Moderation',
      items: [
        {
          id: 'moderation',
          label: 'Overview',
          href: `/mod/${guildId}`,
          icon: IconGavel,
          shortcut: 'G O',
        },
        {
          id: 'cases',
          label: 'Cases',
          href: `/mod/${guildId}/cases`,
          icon: IconGavel,
          shortcut: 'G C',
        },
        {
          id: 'evidence',
          label: 'Evidence',
          href: `/mod/${guildId}/evidence`,
          icon: IconFolder,
          shortcut: 'G E',
        },
        {
          id: 'users',
          label: 'Users',
          href: `/mod/${guildId}/users`,
          icon: IconUsers,
          shortcut: 'G U',
        },
        {
          id: 'analytics',
          label: 'Analytics',
          href: `/mod/${guildId}/analytics`,
          icon: IconChartBar,
          shortcut: 'G A',
        },
      ],
    });
  }

  return sections;
}
