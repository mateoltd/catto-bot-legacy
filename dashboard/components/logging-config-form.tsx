'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLoggingConfig } from '@/hooks/use-logging-config';
import { useGuildData } from '@/hooks/use-guild-data';
import { loggingService, type LogType } from '@/lib/services/logging.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { MultiSelectList } from '@/components/ui/multi-select-list';
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar';

interface LoggingConfigFormProps {
  guildId: string;
}

// Icon mapping for log types (backend doesn't provide icons)
const LOG_TYPE_ICONS: Record<string, string> = {
  messages:
    'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  voice:
    'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  voiceState:
    'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  joins: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  leaves: 'M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6',
  members: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  roles:
    'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  channels: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14',
  server:
    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  emojis: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  stickers:
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  events: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  stage: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4',
  tickets:
    'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
  transcripts:
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  webhooks:
    'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  polls:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
};

export default function LoggingConfigForm({ guildId }: LoggingConfigFormProps) {
  const { config, loading, saving, error, updateConfig, setIgnoredChannels, refetch, setConfig } =
    useLoggingConfig(guildId);
  const { channels, loading: loadingChannels } = useGuildData(guildId);
  const [ignoredChannelsDraft, setLocalIgnoredChannels] = useState<string[] | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    data: logTypesData,
    isLoading: logTypesLoading,
    mutate: mutateLogTypes,
  } = useSWR(
    ['logging-types', guildId],
    () => loggingService.getTypes(guildId),
    { revalidateOnFocus: false },
  );
  const logTypes = logTypesData?.types ?? [];

  // Setup wizard state
  const [selectedLogTypes, setSelectedLogTypes] = useState<LogType[]>([
    'messages',
    'joins',
    'leaves',
    'members',
  ]);
  const [categoryName, setCategoryName] = useState('Admin Logs');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Log type toggle state
  const [togglingLogTypes, setTogglingLogTypes] = useState<Set<LogType>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const localIgnoredChannels = ignoredChannelsDraft ?? config?.ignoredChannels ?? [];
  const hasChanges = config
    ? JSON.stringify([...localIgnoredChannels].sort()) !==
      JSON.stringify([...(config.ignoredChannels || [])].sort())
    : false;

  const handleToggleEnabled = async (enabled: boolean) => {
    const result = await updateConfig({ enabled });
    if (result.success) {
      setSuccess(true);
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  };

  const handleSaveIgnoredChannels = async () => {
    const result = await setIgnoredChannels(localIgnoredChannels);
    if (result.success) {
      setLocalIgnoredChannels(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handleToggleLogType = async (logType: LogType, enabled: boolean) => {
    setTogglingLogTypes((prev) => new Set([...prev, logType]));
    try {
      const result = await loggingService.toggleLogType(guildId, logType, enabled);
      if (result.success) {
        await mutateLogTypes(
          (current) =>
            current && {
              ...current,
              types: current.types.map((type) =>
                type.key === logType ? { ...type, enabled: result.enabled } : type,
              ),
            },
          { revalidate: false },
        );
        // Also update config if needed
        if (config) {
          setConfig({
            ...config,
            channels: {
              ...config.channels,
              [logType]: result.enabled,
            },
          });
        }
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to toggle log type:', err);
    } finally {
      setTogglingLogTypes((prev) => {
        const next = new Set(prev);
        next.delete(logType);
        return next;
      });
    }
  };

  const handleDeleteLogging = async () => {
    setIsDeleting(true);
    try {
      await loggingService.delete(guildId);
      setConfirmDelete(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      refetch();
      mutateLogTypes();
    } catch (err) {
      console.error('Failed to delete logging:', err);
    } finally {
      setIsDeleting(false);
    }
  };

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
              <span className="text-muted-foreground">Loading logging configuration...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not setup state - show setup wizard
  if (config && !config.setup) {
    const handleSetup = async () => {
      if (selectedLogTypes.length === 0) {
        setSetupError('Please select at least one log type');
        return;
      }

      setIsSettingUp(true);
      setSetupError(null);

      try {
        await loggingService.setup(guildId, {
          enabledTypes: selectedLogTypes,
          categoryName: categoryName || undefined,
        });
        setSuccess(true);
        refetch();
        mutateLogTypes();
      } catch (err) {
        setSetupError(err instanceof Error ? err.message : 'Failed to setup logging');
      } finally {
        setIsSettingUp(false);
      }
    };

    const selectAllCore = () => {
      const coreTypes = logTypes.filter((t) => t.category === 'core').map((t) => t.key as LogType);
      setSelectedLogTypes(coreTypes);
    };

    const selectAll = () => {
      setSelectedLogTypes(logTypes.map((t) => t.key as LogType));
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Event Logging</h2>
          <p className="text-muted-foreground mt-1">
            Track and log server events to dedicated channels
          </p>
        </div>

        {setupError && (
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
              <h3 className="text-sm font-medium text-destructive">Setup Error</h3>
              <p className="text-sm text-destructive/80 mt-1">{setupError}</p>
            </div>
          </div>
        )}

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Setup Logging System</CardTitle>
            <CardDescription>
              Select which events you want to log. This will create a private category with
              dedicated channels for each log type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Category Name
              </label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Admin Logs"
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                The name for the log channels category
              </p>
            </div>

            {/* Quick Select */}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAllCore}>
                Select Core
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedLogTypes([])}
              >
                Clear
              </Button>
            </div>

            {/* Core Log Types */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Core Logs</h4>
              <MultiSelectList
                items={logTypes
                  .filter((type) => type.category === 'core')
                  .map((type) => ({ value: type.key, label: type.name, description: type.description }))}
                value={selectedLogTypes}
                onValueChange={(value) => setSelectedLogTypes(value as LogType[])}
                searchPlaceholder="Filter core logs…"
              />
            </div>

            {/* Advanced Log Types */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Advanced Logs</h4>
              <MultiSelectList
                items={logTypes
                  .filter((type) => type.category === 'advanced')
                  .map((type) => ({ value: type.key, label: type.name, description: type.description }))}
                value={selectedLogTypes}
                onValueChange={(value) => setSelectedLogTypes(value as LogType[])}
                searchPlaceholder="Filter advanced logs…"
              />
            </div>

            {/* Setup Button */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedLogTypes.length} log type{selectedLogTypes.length !== 1 ? 's' : ''}{' '}
                  selected
                </p>
                <Button
                  variant="neon"
                  onClick={handleSetup}
                  disabled={isSettingUp || selectedLogTypes.length === 0}
                >
                  {isSettingUp ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Setup Logging
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                This will create a private category and channels in your server. Make sure the bot
                has &quot;Manage Channels&quot; and &quot;Manage Webhooks&quot; permissions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Event Logging</h2>
          <p className="text-muted-foreground mt-1">
            Track and log server events to dedicated channels
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
          {/* Enabled Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
            <div>
              <label className="text-sm font-medium text-foreground">Enable Logging System</label>
              <p className="text-sm text-muted-foreground">Master toggle for all logging events</p>
            </div>
            <Switch
              checked={config?.enabled ?? false}
              onCheckedChange={handleToggleEnabled}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ignored Channels */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Ignored Channels</CardTitle>
          <CardDescription>Events from these channels will not be logged</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingChannels ? (
            <div className="flex items-center justify-center border border-border py-8">
              <div className="neon-spinner" />
            </div>
          ) : (
            <MultiSelectList
              items={channels.map((channel) => ({ value: channel.id, label: channel.name, prefix: '#' }))}
              value={localIgnoredChannels}
              onValueChange={setLocalIgnoredChannels}
              emptyLabel="No channels available"
              searchPlaceholder="Filter channels…"
            />
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {localIgnoredChannels.length === 0
              ? 'No channels are being ignored'
              : `${localIgnoredChannels.length} channel${localIgnoredChannels.length === 1 ? '' : 's'} will be ignored`}
          </p>
        </CardContent>
      </Card>

      {/* Log Types Status */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Log Types</CardTitle>
          <CardDescription>
            Toggle log types on or off. Enabling a log type will create a channel if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logTypesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-border border border-border bg-input">
              {logTypes.map((logType) => {
                const isEnabled = logType.enabled;
                const isToggling = togglingLogTypes.has(logType.key as LogType);
                return (
                  <div
                    key={logType.key}
                    className={`flex items-center gap-3 border-l-2 p-3 transition-colors ${
                      isEnabled ? 'border-l-foreground bg-accent' : 'border-l-transparent'
                    }`}
                  >
                    <div
                      className={isEnabled ? 'text-foreground' : 'text-muted-foreground'}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={LOG_TYPE_ICONS[logType.key] || ''}
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {logType.name}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {logType.description}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {isToggling ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) =>
                            handleToggleLogType(logType.key as LogType, checked)
                          }
                          disabled={saving || isToggling}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <UnsavedChangesBar
        visible={hasChanges}
        saving={saving}
        onSave={handleSaveIgnoredChannels}
      />

      {/* Danger Zone - Delete Logging */}
      <Card variant="glass" className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for the logging system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-destructive/5 border border-destructive/20">
            <div>
              <p className="text-sm font-medium text-foreground">Delete Logging System</p>
              <p className="text-sm text-muted-foreground">
                Remove all log channels and the category from your server
              </p>
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteLogging}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Deleting...
                    </>
                  ) : (
                    'Confirm Delete'
                  )}
                </Button>
              </div>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
