'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { XPConfig } from '@/lib/services/text-xp.service';
import { textXPService } from '@/lib/services/text-xp.service';
import { useGuildData } from '@/hooks/use-guild-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface XPConfigFormProps {
  guildId: string;
  initialConfig: XPConfig;
}

export default function XPConfigForm({ guildId, initialConfig }: XPConfigFormProps) {
  const router = useRouter();
  const [config, setConfig] = useState<XPConfig>(initialConfig);
  const { channels, roles, textChannels, loading: isLoadingData } = useGuildData(guildId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await textXPService.updateConfig(guildId, config);
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
        <h2 className="text-2xl font-bold text-foreground">Text XP Configuration</h2>
        <p className="text-muted-foreground mt-1">Configure how users earn XP from messages</p>
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
          {/* Enabled Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div>
              <label className="text-sm font-medium text-foreground">Enable Text XP System</label>
              <p className="text-sm text-muted-foreground">Allow users to gain XP from messages</p>
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
            {/* Cooldown */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cooldown (seconds)
              </label>
              <Input
                type="number"
                value={config.cooldownSec}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, cooldownSec: parseInt(e.target.value) || 0 }))
                }
                min="0"
                max="3600"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Time between XP awards</p>
            </div>

            {/* Min Message Length */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Minimum Message Length
              </label>
              <Input
                type="number"
                value={config.minMessageLength}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    minMessageLength: parseInt(e.target.value) || 0,
                  }))
                }
                min="0"
                max="2000"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Characters required to earn XP</p>
            </div>

            {/* XP Mode */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">XP Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, xpMode: 'RANDOM' }))}
                  className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    config.xpMode === 'RANDOM'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                  }`}
                >
                  <div className="font-medium">Random</div>
                  <div className="text-xs opacity-75">Random XP between min and max</div>
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, xpMode: 'FIXED' }))}
                  className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    config.xpMode === 'FIXED'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                  }`}
                >
                  <div className="font-medium">Fixed</div>
                  <div className="text-xs opacity-75">Same XP every time</div>
                </button>
              </div>
            </div>

            {/* XP Values */}
            {config.xpMode === 'RANDOM' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Minimum XP
                  </label>
                  <Input
                    type="number"
                    value={config.minXp}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, minXp: parseInt(e.target.value) || 0 }))
                    }
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Maximum XP
                  </label>
                  <Input
                    type="number"
                    value={config.maxXp}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, maxXp: parseInt(e.target.value) || 0 }))
                    }
                    min="0"
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Fixed XP Amount
                </label>
                <Input
                  type="number"
                  value={config.fixedXp}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, fixedXp: parseInt(e.target.value) || 0 }))
                  }
                  min="0"
                />
              </div>
            )}

            {/* Max XP per Minute */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                Max XP per Minute (Optional)
              </label>
              <Input
                type="number"
                value={config.maxXpPerMinute || ''}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxXpPerMinute: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                placeholder="No limit"
                min="0"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Leave empty for no rate limit</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel & Role Filters */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Channel & Role Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="neon-spinner mb-4" />
              <p className="text-sm text-muted-foreground">Loading channels and roles...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Allowed Channels
                </label>
                <div className="border border-border/50 rounded-lg bg-muted/20 p-3 max-h-48 overflow-y-auto space-y-1">
                  {channels.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 px-2">No channels available</p>
                  ) : (
                    <>
                      <label className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={config.allowedChannels.length === 0}
                          onChange={() => setConfig((prev) => ({ ...prev, allowedChannels: [] }))}
                          className="w-4 h-4 rounded border-border bg-muted text-primary focus:ring-primary focus:ring-offset-0 focus:ring-2"
                        />
                        <span className="text-sm font-medium text-foreground">
                          All Channels (Default)
                        </span>
                      </label>
                      <div className="border-t border-border/30 my-2" />
                      {channels.map((channel) => (
                        <label
                          key={channel.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={config.allowedChannels.includes(channel.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setConfig((prev) => ({
                                  ...prev,
                                  allowedChannels: [...prev.allowedChannels, channel.id],
                                }));
                              } else {
                                setConfig((prev) => ({
                                  ...prev,
                                  allowedChannels: prev.allowedChannels.filter(
                                    (id) => id !== channel.id
                                  ),
                                }));
                              }
                            }}
                            className="w-4 h-4 rounded border-border bg-muted text-primary focus:ring-primary focus:ring-offset-0 focus:ring-2"
                          />
                          <span className="text-sm text-muted-foreground"># {channel.name}</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Leave empty to allow all channels
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ignored Channels
                </label>
                <div className="border border-border/50 rounded-lg bg-muted/20 p-3 max-h-48 overflow-y-auto space-y-1">
                  {channels.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 px-2">No channels available</p>
                  ) : (
                    channels.map((channel) => (
                      <label
                        key={channel.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={config.ignoredChannels.includes(channel.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConfig((prev) => ({
                                ...prev,
                                ignoredChannels: [...prev.ignoredChannels, channel.id],
                              }));
                            } else {
                              setConfig((prev) => ({
                                ...prev,
                                ignoredChannels: prev.ignoredChannels.filter(
                                  (id) => id !== channel.id
                                ),
                              }));
                            }
                          }}
                          className="w-4 h-4 rounded border-border bg-muted text-primary focus:ring-primary focus:ring-offset-0 focus:ring-2"
                        />
                        <span className="text-sm text-muted-foreground"># {channel.name}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Users do not earn XP in these channels
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ignored Roles
                </label>
                <div className="border border-border/50 rounded-lg bg-muted/20 p-3 max-h-48 overflow-y-auto space-y-1">
                  {roles.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 px-2">No roles available</p>
                  ) : (
                    roles.map((role) => (
                      <label
                        key={role.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={config.ignoredRoles.includes(role.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConfig((prev) => ({
                                ...prev,
                                ignoredRoles: [...prev.ignoredRoles, role.id],
                              }));
                            } else {
                              setConfig((prev) => ({
                                ...prev,
                                ignoredRoles: prev.ignoredRoles.filter((id) => id !== role.id),
                              }));
                            }
                          }}
                          className="w-4 h-4 rounded border-border bg-muted text-primary focus:ring-primary focus:ring-offset-0 focus:ring-2"
                        />
                        <div className="flex items-center gap-2">
                          {role.color > 0 && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: `#${role.color.toString(16).padStart(6, '0')}`,
                              }}
                            />
                          )}
                          <span className="text-sm text-muted-foreground">{role.name}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Users with these roles do not earn XP
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Announcement Channel ID (Optional)
                </label>
                <Input
                  type="text"
                  value={config.announceChannelId || ''}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      announceChannelId: e.target.value || null,
                    }))
                  }
                  placeholder="Leave empty to announce in message channel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Message Template
                </label>
                <Input
                  type="text"
                  value={config.messageTemplate}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, messageTemplate: e.target.value }))
                  }
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Variables: {'{user}'}, {'{level}'}, {'{xpGain}'}, {'{totalXp}'}
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <label className="text-sm font-medium text-foreground">Use Embed</label>
                  <p className="text-sm text-muted-foreground">Show level-up in a fancy embed</p>
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
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          embedColor: parseInt(e.target.value.slice(1), 16),
                        }))
                      }
                      className="h-10 w-16 rounded-lg border border-border bg-muted cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={`#${config.embedColor.toString(16).padStart(6, '0').toUpperCase()}`}
                      onChange={(e) => {
                        const hex = e.target.value.replace('#', '');
                        if (/^[0-9A-Fa-f]{0,6}$/.test(hex)) {
                          setConfig((prev) => ({
                            ...prev,
                            embedColor: parseInt(hex || '0', 16),
                          }));
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
            <label className="block text-sm font-medium text-foreground mb-2">Curve Type</label>
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
                <div className="text-xs opacity-75">Custom XP thresholds</div>
              </button>
            </div>
          </div>

          {config.levelCurveType === 'FORMULA' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Base</label>
                <Input
                  type="number"
                  value={config.formulaBase}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      formulaBase: parseFloat(e.target.value) || 0,
                    }))
                  }
                  step="0.1"
                  min="0"
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
                  step="0.1"
                  min="0"
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
                  step="1"
                  min="0"
                />
              </div>
              <div className="md:col-span-3">
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 font-mono">
                  Formula: XP = {config.formulaBase} x (level ^ {config.formulaExponent}) +{' '}
                  {config.formulaOffset}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Table Thresholds (comma-separated XP values)
              </label>
              <textarea
                value={config.tableThresholds.join(', ')}
                onChange={(e) => {
                  const values = e.target.value
                    .split(',')
                    .map((v) => parseInt(v.trim()))
                    .filter((v) => !isNaN(v));
                  setConfig((prev) => ({ ...prev, tableThresholds: values }));
                }}
                rows={3}
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono text-sm resize-none"
                placeholder="100, 255, 475, 770, 1150..."
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Each value represents the total XP needed for that level (ascending order)
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
