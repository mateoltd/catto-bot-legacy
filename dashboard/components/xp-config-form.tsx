'use client';

import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';
import type { XPConfig } from '@/lib/services/text-xp.service';
import { textXPService } from '@/lib/services/text-xp.service';
import { useGuildData } from '@/hooks/use-guild-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ColorField } from '@/components/ui/color-field';
import { ChannelFilterList } from '@/components/ui/channel-filter-list';
import { MultiSelectList } from '@/components/ui/multi-select-list';
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar';
import { XPAwardSettings } from '@/components/xp/xp-award-settings';
import { LevelCurveSettings } from '@/components/xp/level-curve-settings';

interface XPConfigFormProps {
  guildId: string;
  initialConfig: XPConfig;
}

export default function XPConfigForm({ guildId, initialConfig }: XPConfigFormProps) {
  const t = useTranslations('TextXp');
  const { mutate } = useSWRConfig();
  const [config, setConfig] = useState<XPConfig>(initialConfig);
  const [savedConfig, setSavedConfig] = useState<XPConfig>(initialConfig);
  const { channels, roles, loading: isLoadingData } = useGuildData(guildId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await textXPService.updateConfig(guildId, config);
      await mutate(['text-xp-config', guildId], updated, { revalidate: false });
      setSavedConfig(config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unknownError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('title')}</h2>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
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
            <h3 className="text-sm font-medium text-destructive">{t('errorTitle')}</h3>
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
            <h3 className="text-sm font-medium text-success">{t('successTitle')}</h3>
            <p className="text-sm text-success/80 mt-1">{t('saved')}</p>
          </div>
        </div>
      )}

      {/* General Settings */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>{t('generalSettings')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enabled Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
            <div>
              <label className="text-sm font-medium text-foreground">{t('enable')}</label>
              <p className="text-sm text-muted-foreground">{t('enableDescription')}</p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <XPAwardSettings
        kind="text"
        value={config}
        onChange={(change) => setConfig((prev) => ({ ...prev, ...change }))}
      />

      {/* Channel & Role Filters */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>{t('filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="neon-spinner mb-4" />
              <p className="text-sm text-muted-foreground">{t('loadingChannelsRoles')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t('channelPolicy')}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t('channelPolicyDescription')}
                </p>
                <ChannelFilterList
                  items={channels.map((channel) => ({ value: channel.id, label: channel.name }))}
                  allowed={config.allowedChannels}
                  ignored={config.ignoredChannels}
                  onAllowedChange={(allowedChannels) =>
                    setConfig((prev) => ({ ...prev, allowedChannels }))
                  }
                  onIgnoredChange={(ignoredChannels) =>
                    setConfig((prev) => ({ ...prev, ignoredChannels }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('ignoredRoles')}
                </label>
                <MultiSelectList
                  items={roles.map((role) => ({
                    value: role.id,
                    label: role.name,
                    swatch: role.color > 0 ? `#${role.color.toString(16).padStart(6, '0')}` : undefined,
                  }))}
                  value={config.ignoredRoles}
                  onValueChange={(ignoredRoles) => setConfig((prev) => ({ ...prev, ignoredRoles }))}
                  emptyLabel={t('noRoles')}
                  searchPlaceholder={t('filterRoles')}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {t('ignoredRolesDescription')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Level-Up Announcements */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>{t('announcements')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
            <div>
              <label className="text-sm font-medium text-foreground">{t('announce')}</label>
              <p className="text-sm text-muted-foreground">{t('announceDescription')}</p>
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
                  {t('announcementChannel')}
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
                  placeholder={t('announcementChannelPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('messageTemplate')}
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
                  {t('templateVariables', {
                    variables: '{user}, {level}, {xpGain}, {totalXp}',
                  })}
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
                <div>
                  <label className="text-sm font-medium text-foreground">{t('useEmbed')}</label>
                  <p className="text-sm text-muted-foreground">{t('useEmbedDescription')}</p>
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
                    {t('embedColor')}
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
        variant="text"
        value={config}
        earningRate={
          config.xpMode === 'FIXED' ? config.fixedXp : (config.minXp + config.maxXp) / 2
        }
        onChange={(change) => setConfig((prev) => ({ ...prev, ...change }))}
      />

      <UnsavedChangesBar visible={isDirty} saving={isSaving} />
    </form>
  );
}
