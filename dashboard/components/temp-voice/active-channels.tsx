'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { TempVoiceChannel } from '@/lib/services/temp-voice.service';

interface ActiveChannelsProps {
  channels: TempVoiceChannel[];
}

export default function ActiveChannels({ channels }: ActiveChannelsProps) {
  if (channels.length === 0) {
    return null;
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Active Channels ({channels.length})</CardTitle>
        <CardDescription>Currently active temporary voice channels</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {channels.map((channel) => (
            <div
              key={channel.channelId}
              className="p-4 bg-muted/20 border border-border/30"
            >
              {/* Channel Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-foreground">
                    {channel.channelName || channel.channelId}
                  </span>
                  {channel.permissions?.isLocked && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                      Locked
                    </span>
                  )}
                  {channel.permissions?.isHidden && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Hidden
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {channel.memberCount || 0}
                  {channel.userLimit ? `/${channel.userLimit}` : ''} users
                </span>
              </div>

              {/* Channel Info */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <span>Owner: {channel.ownerUsername || channel.ownerId}</span>
                {channel.categoryName && <span>Category: {channel.categoryName}</span>}
                {channel.bitrate && <span>{Math.round(channel.bitrate / 1000)}kbps</span>}
                <span>Created: {new Date(channel.createdAt).toLocaleString()}</span>
              </div>

              {/* Members List */}
              {channel.members && channel.members.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Members:</p>
                  <div className="flex flex-wrap gap-2">
                    {channel.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30 text-xs"
                      >
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.username}
                            className="w-4 h-4 rounded-full"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-primary/20" />
                        )}
                        <span className="text-foreground">
                          {member.displayName || member.username}
                        </span>
                        {member.id === channel.ownerId && (
                          <span className="text-primary text-[10px]">(owner)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
