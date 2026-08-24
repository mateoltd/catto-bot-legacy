'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TempVoiceConfig } from '@/lib/services/temp-voice.service';
import type { Channel } from '@/lib/types';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('TempVoice');
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>{t('joinChannels')}</CardTitle>
        <CardDescription>
          {t('joinChannelsDescription')}
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
                    aria-label={t('removeJoinChannelNamed', { name: channel?.name || channelId })}
                  >
                    {t('remove')}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">{t('noJoinChannels')}</p>
        )}

        {!loadingChannels && voiceChannels.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('addJoinChannel')}
            </label>
            <Select
              value=""
              onValueChange={onAddJoinChannel}
              disabled={saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('selectVoiceChannel')} />
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
