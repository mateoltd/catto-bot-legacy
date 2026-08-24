'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from 'next-intl';
import type { TempVoiceConfig } from '@/lib/services/temp-voice.service';

interface GeneralSettingsProps {
  config: TempVoiceConfig;
  saving: boolean;
  onToggleEnabled: (enabled: boolean) => void;
}

export default function GeneralSettings({ config, saving, onToggleEnabled }: GeneralSettingsProps) {
  const t = useTranslations('TempVoice');
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>{t('generalSettings')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground">
              {t('enableSystem')}
            </label>
            <p className="text-sm text-muted-foreground">
              {t('enableSystemDescription')}
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={onToggleEnabled}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  );
}
