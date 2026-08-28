'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VanityCleanupStatus, VanityConfig } from '@/lib/services/vanity.service';
import { vanityService } from '@/lib/services/vanity.service';
import { useGuildData } from '@/hooks/use-guild-data';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar';

const ACTIVE_CLEANUP_STATES = new Set(['waiting', 'active', 'delayed', 'prioritized']);

interface VanityConfigFormProps {
  guildId: string;
  initialConfig: VanityConfig;
  onSaved: (config: VanityConfig) => Promise<unknown> | unknown;
}

export default function VanityConfigForm({
  guildId,
  initialConfig,
  onSaved,
}: VanityConfigFormProps) {
  const t = useTranslations('Vanity');
  const { roles, textChannels, loading: guildDataLoading } = useGuildData(guildId);
  const [config, setConfig] = useState(initialConfig);
  const [savedConfig, setSavedConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanup, setCleanup] = useState<VanityCleanupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  const cleanupActive = Boolean(cleanup && ACTIVE_CLEANUP_STATES.has(cleanup.state));

  const editableRoles = useMemo(
    () => roles.filter((role) => role.editable && !role.managed),
    [roles],
  );
  const sendableChannels = useMemo(
    () => textChannels.filter((channel) => channel.canSend !== false),
    [textChannels],
  );

  useEffect(() => {
    let cancelled = false;
    void vanityService
      .getLatestCleanup(guildId)
      .then(({ cleanup: latest }) => {
        if (!cancelled) setCleanup(latest);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  useEffect(() => {
    if (!cleanupActive || !cleanup) return;
    const timer = window.setInterval(() => {
      void vanityService
        .getCleanup(guildId, cleanup.id)
        .then(({ cleanup: updated }) => setCleanup(updated))
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [cleanup, cleanupActive, guildId]);

  const preview = config.thankYouMessage
    .replaceAll('{user}', '@member')
    .replaceAll('{role}', '@role')
    .replaceAll('{keyword}', config.keyword || '/your-server');

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await vanityService.updateConfig(guildId, config);
      setConfig(result.config);
      setSavedConfig(result.config);
      await onSaved(result.config);
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 3000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('unknownError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await vanityService.startCleanup(guildId);
      const disabledConfig = { ...config, enabled: false };
      setConfig(disabledConfig);
      setSavedConfig(disabledConfig);
      await onSaved(disabledConfig);
      const status = await vanityService.getCleanup(guildId, result.jobId);
      setCleanup(status.cleanup);
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : t('unknownError'));
    } finally {
      setCleaning(false);
    }
  };

  const cleanupPercent = cleanup?.total
    ? Math.min(100, Math.round((cleanup.processed / cleanup.total) * 100))
    : 0;
  const cleanupStateKey =
    cleanup?.state === 'waiting' || cleanup?.state === 'prioritized'
      ? 'cleanupState.waiting'
      : cleanup?.state === 'active'
        ? 'cleanupState.active'
        : cleanup?.state === 'delayed'
          ? 'cleanupState.delayed'
          : cleanup?.state === 'completed'
            ? 'cleanupState.completed'
            : cleanup?.state === 'failed'
              ? 'cleanupState.failed'
              : 'cleanupState.unknown';

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('title')}</h2>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 border border-destructive/50 bg-card p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">{t('errorTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-start gap-3 border border-border bg-card p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p className="text-sm text-foreground">{t('saved')}</p>
        </div>
      )}

      <Card variant="glass">
        <CardHeader>
          <CardTitle>{t('systemTitle')}</CardTitle>
          <CardDescription>{t('systemDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-6 border border-border bg-muted/30 p-4">
            <div>
              <label htmlFor="vanity-enabled" className="text-sm font-medium text-foreground">
                {t('enable')}
              </label>
              <p className="mt-1 text-sm text-muted-foreground">{t('enableDescription')}</p>
            </div>
            <Switch
              id="vanity-enabled"
              checked={config.enabled}
              disabled={cleanupActive}
              onCheckedChange={(enabled) => setConfig((current) => ({ ...current, enabled }))}
            />
          </div>

          <div>
            <label
              htmlFor="vanity-keyword"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              {t('keyword')}
            </label>
            <Input
              id="vanity-keyword"
              value={config.keyword}
              maxLength={128}
              placeholder="/galaxia"
              disabled={cleanupActive}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  keyword: event.target.value,
                }))
              }
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{t('keywordDescription')}</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{t('role')}</label>
            <Select
              value={config.roleId ?? '_none'}
              disabled={guildDataLoading || cleanupActive}
              onValueChange={(roleId) =>
                setConfig((current) => ({
                  ...current,
                  roleId: roleId === '_none' ? null : roleId,
                }))
              }
            >
              <SelectTrigger className="w-full" aria-label={t('role')}>
                <SelectValue placeholder={t('selectRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t('selectRole')}</SelectItem>
                {editableRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">{t('roleDescription')}</p>
            {savedConfig.roleId && config.roleId !== savedConfig.roleId && (
              <p className="mt-2 text-xs text-foreground">{t('roleChangeWarning')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>{t('messageTitle')}</CardTitle>
          <CardDescription>{t('messageDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-6 border border-border bg-muted/30 p-4">
            <div>
              <label htmlFor="thank-you-enabled" className="text-sm font-medium text-foreground">
                {t('messageEnable')}
              </label>
              <p className="mt-1 text-sm text-muted-foreground">{t('messageEnableDescription')}</p>
            </div>
            <Switch
              id="thank-you-enabled"
              checked={config.thankYouEnabled}
              disabled={cleanupActive}
              onCheckedChange={(thankYouEnabled) =>
                setConfig((current) => ({ ...current, thankYouEnabled }))
              }
            />
          </div>

          {config.thankYouEnabled && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t('channel')}
                </label>
                <Select
                  value={config.thankYouChannelId ?? '_none'}
                  disabled={guildDataLoading || cleanupActive}
                  onValueChange={(thankYouChannelId) =>
                    setConfig((current) => ({
                      ...current,
                      thankYouChannelId: thankYouChannelId === '_none' ? null : thankYouChannelId,
                    }))
                  }
                >
                  <SelectTrigger className="w-full" aria-label={t('channel')}>
                    <SelectValue placeholder={t('selectChannel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t('selectChannel')}</SelectItem>
                    {sendableChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        # {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="thank-you-message"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  {t('template')}
                </label>
                <Textarea
                  id="thank-you-message"
                  rows={4}
                  maxLength={1500}
                  value={config.thankYouMessage}
                  disabled={cleanupActive}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      thankYouMessage: event.target.value,
                    }))
                  }
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{t('templateDescription')}</p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">{t('preview')}</p>
                <p className="whitespace-pre-wrap bg-muted/30 p-4 text-sm text-foreground">
                  {preview}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>{t('cleanupTitle')}</CardTitle>
          <CardDescription>{t('cleanupDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cleanup && (
            <div className="space-y-3 border border-border bg-muted/30 p-4" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{t(cleanupStateKey)}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {t('cleanupCounts', {
                    processed: cleanup.processed,
                    total: cleanup.total,
                    removed: cleanup.removed,
                    failed: cleanup.failed,
                  })}
                </p>
              </div>
              {cleanupActive && (
                <Progress value={cleanupPercent} aria-label={t('cleanupProgress')} />
              )}
              {cleanup.failureReason && (
                <p className="text-sm text-destructive">{cleanup.failureReason}</p>
              )}
            </div>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={!savedConfig.roleId || cleanupActive || cleaning}
              >
                {cleaning && <Loader2 className="animate-spin" />}
                {t('cleanupAction')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('cleanupConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('cleanupConfirmDescription')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  type="button"
                  className="border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/85"
                  onClick={handleCleanup}
                >
                  {t('cleanupConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <UnsavedChangesBar visible={isDirty} saving={saving} disabled={cleanupActive} />
    </form>
  );
}
