'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTempVoiceConfig } from '@/hooks/use-temp-voice-config';
import { useGuildData } from '@/hooks/use-guild-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar';

import SetupWizard from '@/components/temp-voice/setup-wizard';
import GeneralSettings from '@/components/temp-voice/general-settings';
import JoinChannelsSection from '@/components/temp-voice/join-channels-section';
import NamingSection from '@/components/temp-voice/naming-section';
import DefaultsSection from '@/components/temp-voice/defaults-section';
import DeletionSection from '@/components/temp-voice/deletion-section';
import PermissionsSection from '@/components/temp-voice/permissions-section';
import ModerationSection from '@/components/temp-voice/moderation-section';
import ActiveChannels from '@/components/temp-voice/active-channels';

interface TempVoiceConfigFormProps {
  guildId: string;
}

export default function TempVoiceConfigForm({ guildId }: TempVoiceConfigFormProps) {
  const t = useTranslations('TempVoice');
  const {
    config,
    channels,
    stats,
    loading,
    saving,
    error,
    isDirty,
    localConfig,
    setLocalConfig,
    updateConfig,
    createConfig,
    setup,
    addJoinChannel,
    removeJoinChannel,
    deleteConfig,
    refetch,
  } = useTempVoiceConfig(guildId);

  const { voiceChannels, loading: loadingChannels } = useGuildData(guildId);

  const [success, setSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // --- Handlers ---

  const flashSuccess = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    const result = await updateConfig({ enabled });
    if (result.success) flashSuccess();
  };

  const handleSaveConfig = async () => {
    const result = await updateConfig({
      namingScheme: localConfig.namingScheme,
      customNamingPattern: localConfig.customNamingPattern,
      userLimit: localConfig.userLimit,
      bitrate: localConfig.bitrate,
      maxChannelsPerUser: localConfig.maxChannelsPerUser,
      defaultLocked: localConfig.defaultLocked,
      defaultHidden: localConfig.defaultHidden,
      ownerLeaveStrategy: localConfig.ownerLeaveStrategy,
      deleteEmptyAfterMs: localConfig.deleteEmptyAfterMs,
      allowOwnerManagement: localConfig.allowOwnerManagement,
      enableNameModeration: localConfig.enableNameModeration,
      blockedKeywords: localConfig.blockedKeywords,
    });
    if (result.success) flashSuccess();
  };

  const handleAddJoinChannel = async (channelId: string) => {
    const result = await addJoinChannel(channelId);
    if (result.success) flashSuccess();
  };

  const handleRemoveJoinChannel = async (channelId: string) => {
    const result = await removeJoinChannel(channelId);
    if (result.success) flashSuccess();
  };

  const handleDelete = async () => {
    const result = await deleteConfig();
    if (result.success) {
      setConfirmDelete(false);
      flashSuccess();
    }
  };

  // --- Loading state ---

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted/50 rounded w-1/3 mb-2" />
          <div className="h-4 bg-muted/30 rounded w-1/2" />
        </div>
        <Card variant="glass">
          <CardContent className="py-12">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted-foreground">{t('loading')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Setup wizard (no config yet) ---

  const handleSetupExisting = async (channelId: string) => {
    return await createConfig({ enabled: true, joinChannelIds: [channelId] });
  };

  if (!config) {
    return (
      <SetupWizard
        error={error}
        onSetup={setup}
        onSetupExisting={handleSetupExisting}
        onRetry={refetch}
        voiceChannels={voiceChannels}
        loadingChannels={loadingChannels}
      />
    );
  }

  // --- Configured: show sections ---

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
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

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card variant="glass">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-primary">{stats.stats.activeChannels}</div>
              <div className="text-sm text-muted-foreground">{t('activeChannels')}</div>
            </CardContent>
          </Card>
          <Card variant="glass">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-primary">
                {stats.stats.totalChannelsCreated}
              </div>
              <div className="text-sm text-muted-foreground">{t('totalCreated')}</div>
            </CardContent>
          </Card>
          <Card variant="glass">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-primary">{stats.stats.totalMembers}</div>
              <div className="text-sm text-muted-foreground">{t('totalMembers')}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sections */}
      <GeneralSettings
        config={config}
        saving={saving}
        onToggleEnabled={handleToggleEnabled}
      />

      <JoinChannelsSection
        config={config}
        voiceChannels={voiceChannels}
        loadingChannels={loadingChannels}
        saving={saving}
        onAddJoinChannel={handleAddJoinChannel}
        onRemoveJoinChannel={handleRemoveJoinChannel}
      />

      <NamingSection
        namingScheme={localConfig.namingScheme}
        customNamingPattern={localConfig.customNamingPattern}
        onNamingSchemeChange={(scheme) =>
          setLocalConfig((prev) => ({ ...prev, namingScheme: scheme }))
        }
        onCustomPatternChange={(pattern) =>
          setLocalConfig((prev) => ({ ...prev, customNamingPattern: pattern }))
        }
      />

      <DefaultsSection
        userLimit={localConfig.userLimit}
        bitrate={localConfig.bitrate}
        maxChannelsPerUser={localConfig.maxChannelsPerUser}
        defaultLocked={localConfig.defaultLocked}
        defaultHidden={localConfig.defaultHidden}
        ownerLeaveStrategy={localConfig.ownerLeaveStrategy}
        onUpdate={(updates) => setLocalConfig((prev) => ({ ...prev, ...updates }))}
      />

      <DeletionSection
        deleteEmptyAfterMs={localConfig.deleteEmptyAfterMs}
        onUpdate={(updates) => setLocalConfig((prev) => ({ ...prev, ...updates }))}
      />

      <PermissionsSection
        allowOwnerManagement={localConfig.allowOwnerManagement}
        onUpdate={(updates) => setLocalConfig((prev) => ({ ...prev, ...updates }))}
      />

      <ModerationSection
        enableNameModeration={localConfig.enableNameModeration}
        blockedKeywords={localConfig.blockedKeywords}
        onUpdate={(updates) => setLocalConfig((prev) => ({ ...prev, ...updates }))}
      />

      <ActiveChannels channels={channels} />

      <UnsavedChangesBar
        visible={isDirty}
        saving={saving}
        onSave={handleSaveConfig}
      />

      {/* Danger Zone */}
      <Card variant="glass" className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">{t('dangerZone')}</CardTitle>
          <CardDescription>{t('irreversibleActions')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-destructive/5 border border-destructive/20">
            <div>
              <p className="text-sm font-medium text-foreground">{t('deleteConfiguration')}</p>
              <p className="text-sm text-muted-foreground">
                {t('deleteConfigurationDescription')}
              </p>
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={saving}
                >
                  {t('cancel')}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                  {saving ? t('deleting') : t('confirmDelete')}
                </Button>
              </div>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                {t('delete')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('deleteNote')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
