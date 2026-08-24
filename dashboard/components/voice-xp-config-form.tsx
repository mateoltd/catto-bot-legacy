'use client';

import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { useGuildData } from '@/hooks/use-guild-data';
import type { VoiceXPConfig } from '@/lib/services/voice-xp.service';
import { voiceXPService } from '@/lib/services/voice-xp.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ColorField } from '@/components/ui/color-field';
import { ChannelFilterList } from '@/components/ui/channel-filter-list';
import { MultiSelectList } from '@/components/ui/multi-select-list';
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar';
import { XPAwardSettings } from '@/components/xp/xp-award-settings';
import { LevelCurveSettings } from '@/components/xp/level-curve-settings';

interface VoiceXPConfigFormProps {
  guildId: string;
  initialConfig: VoiceXPConfig;
}

export default function VoiceXPConfigForm({ guildId, initialConfig }: VoiceXPConfigFormProps) {
  const { mutate } = useSWRConfig();
  const [config, setConfig] = useState<VoiceXPConfig>(initialConfig);
  const [savedConfig, setSavedConfig] = useState<VoiceXPConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const { voiceChannels, textChannels, roles, loading: isLoadingData } = useGuildData(guildId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await voiceXPService.updateConfig(guildId, config);
      await mutate(['voice-xp-config', guildId], updated, { revalidate: false });
      setSavedConfig(config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Voice XP Configuration</h2>
        <p className="text-muted-foreground mt-1">
          Configure how users earn XP from voice channels
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="glass border-destructive/50 p-4 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-destructive">Error</h3>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="glass border-success/50 p-4 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-success flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-success">Success</h3>
            <p className="text-sm text-success/80 mt-1">Configuration saved successfully!</p>
          </div>
        </div>
      )}

      {/* General Settings */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
            <div>
              <label className="text-sm font-medium text-foreground">Enable Voice XP System</label>
              <p className="text-sm text-muted-foreground">
                Allow users to gain XP from voice channels
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <XPAwardSettings
        kind="voice"
        value={config}
        onChange={(change) => setConfig((prev) => ({ ...prev, ...change }))}
      />

      {/* User State Filters */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>User State Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Configure which user states should earn XP
          </p>

          <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/30">
            <div>
              <label className="text-sm font-medium text-foreground">Award XP While Muted</label>
              <p className="text-xs text-muted-foreground">Allow XP gain when user is muted</p>
            </div>
            <Switch
              checked={config.awardMuted}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, awardMuted: checked }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/30">
            <div>
              <label className="text-sm font-medium text-foreground">Award XP While Deafened</label>
              <p className="text-xs text-muted-foreground">Allow XP gain when user is deafened</p>
            </div>
            <Switch
              checked={config.awardDeafened}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, awardDeafened: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/30">
            <div>
              <label className="text-sm font-medium text-foreground">
                Award XP While Streaming
              </label>
              <p className="text-xs text-muted-foreground">Give XP when user is screen sharing</p>
            </div>
            <Switch
              checked={config.awardStreaming}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, awardStreaming: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/30">
            <div>
              <label className="text-sm font-medium text-foreground">Award XP With Video On</label>
              <p className="text-xs text-muted-foreground">Give XP when user has video enabled</p>
            </div>
            <Switch
              checked={config.awardVideo}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, awardVideo: checked }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/30">
            <div>
              <label className="text-sm font-medium text-foreground">Ignore AFK Channel</label>
              <p className="text-xs text-muted-foreground">Do not award XP in the AFK channel</p>
            </div>
            <Switch
              checked={config.ignoreAfkChannel}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, ignoreAfkChannel: checked }))
              }
            />
          </div>

          <div className="bg-muted/20 border border-border/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Anti-Farm Dampening (Optional)
                </label>
                <p className="text-xs text-muted-foreground">
                  Reduce XP in likely farming contexts without hard-blocking gains
                </p>
              </div>
              <Switch
                checked={!!config.antiFarmDampeningEnabled}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, antiFarmDampeningEnabled: checked }))
                }
              />
            </div>

            {config.antiFarmDampeningEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Dampening Multiplier
                  </label>
                  <Input
                    type="number"
                    value={config.antiFarmDampeningMultiplier ?? 0.35}
                    onChange={(e) =>
                      setConfig((prev) => {
                        const parsed = parseFloat(e.target.value);
                        const isValid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1;
                        return {
                          ...prev,
                          antiFarmDampeningMultiplier: isValid
                            ? parsed
                            : (prev.antiFarmDampeningMultiplier ?? 0.35),
                        };
                      })
                    }
                    min="0"
                    max="1"
                    step="0.05"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Minimum Non-Bot Participants
                  </label>
                  <Input
                    type="number"
                    value={config.antiFarmMinimumParticipants ?? 2}
                    onChange={(e) =>
                      setConfig((prev) => {
                        const parsed = parseInt(e.target.value, 10);
                        const isValid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 99;
                        return {
                          ...prev,
                          antiFarmMinimumParticipants: isValid
                            ? parsed
                            : (prev.antiFarmMinimumParticipants ?? 2),
                        };
                      })
                    }
                    min="1"
                    max="99"
                    step="1"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Channel Filters */}
      {!isLoadingData && voiceChannels.length > 0 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Channel Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Channel Policy
              </label>
              <p className="mb-2 text-xs text-muted-foreground">
                Set an explicit policy only where a channel should differ from the default.
              </p>
              <ChannelFilterList
                items={voiceChannels.map((channel) => ({ value: channel.id, label: channel.name }))}
                allowed={config.allowedChannels}
                ignored={config.ignoredChannels}
                onAllowedChange={(allowedChannels) =>
                  setConfig((prev) => ({ ...prev, allowedChannels }))
                }
                onIgnoredChange={(ignoredChannels) =>
                  setConfig((prev) => ({ ...prev, ignoredChannels }))
                }
                searchPlaceholder="Filter voice channels…"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Filters */}
      {!isLoadingData && roles.length > 0 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Role Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="block text-sm font-medium text-foreground mb-2">Ignored Roles</label>
            <p className="text-xs text-muted-foreground mb-2">
              Users with these roles do not gain XP
            </p>
            <MultiSelectList
              items={roles.map((role) => ({
                value: role.id,
                label: role.name,
                prefix: '@',
                swatch: role.color > 0 ? `#${role.color.toString(16).padStart(6, '0')}` : undefined,
              }))}
              value={config.ignoredRoles}
              onValueChange={(ignoredRoles) => setConfig((prev) => ({ ...prev, ignoredRoles }))}
              searchPlaceholder="Filter roles…"
            />
          </CardContent>
        </Card>
      )}

      {/* Level-Up Announcements */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Level-Up Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
            <div>
              <label className="text-sm font-medium text-foreground">Announce Level-Ups</label>
              <p className="text-sm text-muted-foreground">Send a message when users level up</p>
            </div>
            <Switch
              checked={config.announceLevelUp}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, announceLevelUp: checked }))
              }
            />
          </div>

          {config.announceLevelUp && (
            <div className="space-y-4 pt-2">
              {/* Announce Channel */}
              {!isLoadingData && textChannels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Announcement Channel (Optional)
                  </label>
                  <select
                    value={config.announceChannelId || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        announceChannelId: e.target.value || null,
                      }))
                    }
                    className="w-full px-4 py-3 bg-input border border-border text-foreground outline-none"
                  >
                    <option value="">No announcement channel</option>
                    {textChannels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        # {channel.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Set a channel to enable voice level-up announcements
                  </p>
                </div>
              )}

              {/* Message Template */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Message Template
                </label>
                <textarea
                  value={config.messageTemplate}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, messageTemplate: e.target.value }))
                  }
                  className="w-full resize-none border border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none"
                  rows={3}
                  placeholder="GG {user}, you just advanced to level {level}!"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Available variables: {'{user}'}, {'{level}'}, {'{xp}'}, {'{nextLevelXp}'}
                </p>
              </div>

              {/* Embed Settings */}
              <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
                <div>
                  <label className="text-sm font-medium text-foreground">Use Embed</label>
                  <p className="text-sm text-muted-foreground">Send as an embedded message</p>
                </div>
                <Switch
                  checked={config.embedEnabled}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, embedEnabled: checked }))
                  }
                />
              </div>

              {config.embedEnabled && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Embed Color
                  </label>
                  <ColorField
                    value={`#${config.embedColor.toString(16).padStart(6, '0')}`}
                    onValueChange={(hex) => {
                      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                        setConfig((prev) => ({ ...prev, embedColor: parseInt(hex.slice(1), 16) }));
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <LevelCurveSettings
        variant="voice"
        value={config}
        earningRate={config.xpPerMinute}
        onChange={(change) => setConfig((prev) => ({ ...prev, ...change }))}
      />

      <UnsavedChangesBar visible={isDirty} saving={isSaving} />
    </form>
  );
}
