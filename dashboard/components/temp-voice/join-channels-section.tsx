'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TempVoiceConfig } from '@/lib/services/temp-voice.service';
import type { Channel } from '@/lib/types';

interface JoinChannelsSectionProps {
  config: TempVoiceConfig;
  voiceChannels: Channel[];
  loadingChannels: boolean;
  saving: boolean;
  onAddJoinChannel: (channelId: string) => void;
  onRemoveJoinChannel: (channelId: string) => void;
}

export default function JoinChannelsSection({
  config,
  voiceChannels,
  loadingChannels,
  saving,
  onAddJoinChannel,
  onRemoveJoinChannel,
}: JoinChannelsSectionProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Join Channels</CardTitle>
        <CardDescription>
          Voice channels that create temp channels when users join
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {config.joinChannelIds.length > 0 ? (
          <div className="space-y-2">
            {config.joinChannelIds.map((channelId) => {
              const channel = voiceChannels.find((c) => c.id === channelId);
              return (
                <div
                  key={channelId}
                  className="flex items-center justify-between p-3 bg-muted/20 border border-border/30"
                >
                  <span className="text-sm text-foreground">{channel?.name || channelId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveJoinChannel(channelId)}
                    disabled={saving}
                    aria-label={`Remove ${channel?.name || channelId}`}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">No join channels configured</p>
        )}

        {!loadingChannels && voiceChannels.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Add Join Channel
            </label>
            <Select
              value=""
              onValueChange={onAddJoinChannel}
              disabled={saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a voice channel..." />
              </SelectTrigger>
              <SelectContent>
                {voiceChannels
                  .filter((c) => !config.joinChannelIds.includes(c.id))
                  .map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
