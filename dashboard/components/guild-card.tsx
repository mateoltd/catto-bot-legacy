'use client';

import Link from 'next/link';
import type { Guild } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export function GuildCard({ guild }: { guild: Guild }) {
  const guildIconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
    : null;

  // Check if user has MANAGE_GUILD permission (bit 5)
  const hasManageGuild = (BigInt(guild.permissions) & BigInt(0x20)) !== BigInt(0);
  const canManage = guild.owner || hasManageGuild;

  return (
    <Link
      href={canManage ? `/guilds/${guild.id}` : '#'}
      className={`
        group block rounded-xl border bg-card/50 backdrop-blur-sm p-6
        transition-all duration-200
        ${
          canManage
            ? 'border-border/30 hover:border-primary/40 hover:bg-card/70 hover:shadow-neon-blue-sm cursor-pointer hover:scale-[1.02]'
            : 'border-border/20 opacity-50 cursor-not-allowed'
        }
      `}
      onClick={(e) => {
        if (!canManage) {
          e.preventDefault();
        }
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Guild Icon */}
        <div className="relative">
          {guildIconUrl ? (
            <img
              src={guildIconUrl}
              alt={guild.name}
              className={`
                w-16 h-16 rounded-full ring-2 ring-border/50
                transition-all duration-200
                ${canManage ? 'group-hover:ring-primary/50 group-hover:shadow-[0_0_20px_hsl(210_100%_55%/0.2)]' : ''}
              `}
            />
          ) : (
            <div
              className={`
                w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center
                text-primary text-xl font-bold ring-2 ring-border/50
                transition-all duration-200
                ${canManage ? 'group-hover:ring-primary/50 group-hover:bg-primary/30' : ''}
              `}
            >
              {guild.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Status indicator */}
          {canManage && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success ring-2 ring-card shadow-[0_0_8px_hsl(145_70%_42%/0.5)]" />
          )}
        </div>

        {/* Guild Info */}
        <div className="text-center w-full">
          <h3 className="font-semibold text-foreground line-clamp-1 mb-2">{guild.name}</h3>

          <div className="flex justify-center gap-2">
            {guild.owner && <Badge variant="neon">Owner</Badge>}
            {!canManage && <Badge variant="muted">No Permission</Badge>}
          </div>
        </div>
      </div>
    </Link>
  );
}
