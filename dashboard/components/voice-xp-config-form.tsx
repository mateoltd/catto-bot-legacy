'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGuildData } from '@/hooks/use-guild-data';
import type { VoiceXPConfig } from '@/lib/services/voice-xp.service';
import { voiceXPService } from '@/lib/services/voice-xp.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface VoiceXPConfigFormProps {
  guildId: string;
  initialConfig: VoiceXPConfig;
}

export default function VoiceXPConfigForm({ guildId, initialConfig }: VoiceXPConfigFormProps) {
  const router = useRouter();
  const [config, setConfig] = useState<VoiceXPConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { voiceChannels, textChannels, roles, loading: isLoadingData } = useGuildData(guildId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await voiceXPService.updateConfig(guildId, config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
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
        <div className="glass border-destructive/50 rounded-lg p-4 flex items-start gap-3">
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
        <div className="glass border-success/50 rounded-lg p-4 flex items-start gap-3">
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
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
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

      {/* XP Award Settings */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>XP Award Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* XP Per Minute */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                XP Per Minute
              </label>
              <Input
                type="number"
                value={config.xpPerMinute}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, xpPerMinute: parseInt(e.target.value) || 0 }))
                }
                min="0"
                max="1000"
              />
              <p className="text-xs text-muted-foreground mt-1.5">XP awarded per minute in voice</p>
            </div>

            {/* Min Session Minutes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Minimum Session Duration (minutes)
              </label>
              <Input
                type="number"
                value={config.minSessionMinutes}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    minSessionMinutes: parseInt(e.target.value) || 0,
                  }))
                }
                min="0"
                max="60"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Minimum time before XP is awarded
              </p>
            </div>

            {/* XP Mode */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                XP Award Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, xpMode: 'PER_MINUTE' }))}
                  className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    config.xpMode === 'PER_MINUTE'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                  }`}
                >
                  <div className="font-medium">Per Minute</div>
                  <div className="text-xs opacity-75">Award XP every minute</div>
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, xpMode: 'PER_SESSION' }))}
                  className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    config.xpMode === 'PER_SESSION'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                  }`}
                >
                  <div className="font-medium">Per Session</div>
                  <div className="text-xs opacity-75">Award XP when session ends</div>
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User State Filters */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>User State Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Configure which user states should earn XP
          </p>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
            <div>
              <label className="text-sm font-medium text-foreground">Award XP While Muted</label>
              <p className="text-xs text-muted-foreground">Allow XP gain when user is muted</p>
            </div>
            <Switch
              checked={config.awardMuted}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, awardMuted: checked }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
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

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
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

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
            <div>
              <label className="text-sm font-medium text-foreground">Award XP With Video On</label>
              <p className="text-xs text-muted-foreground">Give XP when user has video enabled</p>
            </div>
            <Switch
              checked={config.awardVideo}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, awardVideo: checked }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
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

          <div className="rounded-lg bg-muted/20 border border-border/30 p-4 space-y-3">
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
          <CardContent className="space-y-6">
            {/* Allowed Channels */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Allowed Channels (Optional)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                If set, only these channels will award XP
              </p>
              <select
                multiple
                value={config.allowedChannels}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                  setConfig((prev) => ({ ...prev, allowedChannels: selected }));
                }}
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors h-32"
              >
                {voiceChannels.map((channel) => (
                  <option key={channel.id} value={channel.id} className="py-1">
                    # {channel.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">
                Hold Ctrl/Cmd to select multiple. Selected: {config.allowedChannels.length}
              </p>
            </div>

            {/* Ignored Channels */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ignored Channels
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                These channels will never award XP
              </p>
              <select
                multiple
                value={config.ignoredChannels}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                  setConfig((prev) => ({ ...prev, ignoredChannels: selected }));
                }}
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors h-32"
              >
                {voiceChannels.map((channel) => (
                  <option key={channel.id} value={channel.id} className="py-1">
                    # {channel.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">
                Hold Ctrl/Cmd to select multiple. Selected: {config.ignoredChannels.length}
              </p>
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
            <select
              multiple
              value={config.ignoredRoles}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                setConfig((prev) => ({ ...prev, ignoredRoles: selected }));
              }}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors h-32"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id} className="py-1">
                  @ {role.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1.5">
              Hold Ctrl/Cmd to select multiple. Selected: {config.ignoredRoles.length}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Level-Up Announcements */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Level-Up Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
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
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
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
                  className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                  rows={3}
                  placeholder="GG {user}, you just advanced to level {level}!"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Available variables: {'{user}'}, {'{level}'}, {'{xp}'}, {'{nextLevelXp}'}
                </p>
              </div>

              {/* Embed Settings */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
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
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={`#${config.embedColor.toString(16).padStart(6, '0')}`}
                      onChange={(e) => {
                        const hex = e.target.value.replace('#', '');
                        const decimal = parseInt(hex, 16);
                        setConfig((prev) => ({ ...prev, embedColor: decimal }));
                      }}
                      className="h-10 w-16 rounded-lg border border-border bg-muted cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={`#${config.embedColor.toString(16).padStart(6, '0')}`}
                      onChange={(e) => {
                        const hex = e.target.value.replace('#', '');
                        if (/^[0-9A-Fa-f]{0,6}$/.test(hex)) {
                          const decimal = parseInt(hex || '0', 16);
                          setConfig((prev) => ({ ...prev, embedColor: decimal }));
                        }
                      }}
                      className="flex-1 font-mono"
                      placeholder="#1A8CFF"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Level Curve Configuration */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Level Curve Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Level Curve Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, levelCurveType: 'FORMULA' }))}
                className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                  config.levelCurveType === 'FORMULA'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                }`}
              >
                <div className="font-medium">Formula</div>
                <div className="text-xs opacity-75">Use mathematical formula</div>
              </button>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, levelCurveType: 'TABLE' }))}
                className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                  config.levelCurveType === 'TABLE'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                }`}
              >
                <div className="font-medium">Table</div>
                <div className="text-xs opacity-75">Define XP thresholds</div>
              </button>
            </div>
          </div>

          {/* Formula Settings */}
          {config.levelCurveType === 'FORMULA' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Base</label>
                <Input
                  type="number"
                  value={config.formulaBase}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, formulaBase: parseFloat(e.target.value) || 0 }))
                  }
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Exponent</label>
                <Input
                  type="number"
                  value={config.formulaExponent}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      formulaExponent: parseFloat(e.target.value) || 0,
                    }))
                  }
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Offset</label>
                <Input
                  type="number"
                  value={config.formulaOffset}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      formulaOffset: parseFloat(e.target.value) || 0,
                    }))
                  }
                  min="0"
                  step="1"
                />
              </div>
              <div className="md:col-span-3">
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 font-mono">
                  Per-level XP: (base x level^exponent + offset x level + 100) x epoch-multiplier
                </div>
              </div>
            </div>
          )}

          {/* Table Settings */}
          {config.levelCurveType === 'TABLE' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                XP Thresholds (comma-separated)
              </label>
              <textarea
                value={config.tableThresholds.join(', ')}
                onChange={(e) => {
                  const values = e.target.value
                    .split(',')
                    .map((v) => parseInt(v.trim()))
                    .filter((v) => !isNaN(v) && v >= 0);
                  setConfig((prev) => ({ ...prev, tableThresholds: values }));
                }}
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono text-sm resize-none"
                rows={3}
                placeholder="100, 255, 475, 770, 1150, 1625, ..."
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Define XP required for each level. Values must be ascending. Current levels:{' '}
                {config.tableThresholds.length}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Card variant="glass">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Make sure to save your changes before leaving this page.
            </p>
            <Button type="submit" variant="neon" disabled={isSaving} className="min-w-32">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
