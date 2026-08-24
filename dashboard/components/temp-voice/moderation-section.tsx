'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

interface ModerationSectionProps {
  enableNameModeration: boolean;
  blockedKeywords: string[];
  onUpdate: (updates: Partial<{
    enableNameModeration: boolean;
    blockedKeywords: string[];
  }>) => void;
}

export default function ModerationSection({
  enableNameModeration,
  blockedKeywords,
  onUpdate,
}: ModerationSectionProps) {
  const t = useTranslations('TempVoice');
  const handleKeywordsChange = (value: string) => {
    const keywords = value
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    onUpdate({ blockedKeywords: keywords });
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>{t('nameModeration')}</CardTitle>
        <CardDescription>
          {t('nameModerationDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground">
              {t('enableNameModeration')}
            </label>
            <p className="text-sm text-muted-foreground">
              {t('enableNameModerationDescription')}
            </p>
          </div>
          <Switch
            checked={enableNameModeration}
            onCheckedChange={(checked) => onUpdate({ enableNameModeration: checked })}
          />
        </div>

        {enableNameModeration && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('blockedKeywords')}
            </label>
            <Input
              value={blockedKeywords.join(', ')}
              onChange={(e) => handleKeywordsChange(e.target.value)}
              placeholder={t('blockedKeywordsPlaceholder')}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              {t('blockedKeywordsDescription')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
