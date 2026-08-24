'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

interface DeletionSectionProps {
  deleteEmptyAfterMs: number;
  onUpdate: (updates: Partial<{
    deleteEmptyAfterMs: number;
  }>) => void;
}

export default function DeletionSection({ deleteEmptyAfterMs, onUpdate }: DeletionSectionProps) {
  const t = useTranslations('TempVoice');
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>{t('autoDeleteSettings')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('deleteWhenEmptyDescription')}
        </p>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('deleteDelay')}
          </label>
          <Input
            type="number"
            value={deleteEmptyAfterMs / 1000}
            onChange={(e) =>
              onUpdate({ deleteEmptyAfterMs: (parseInt(e.target.value) || 0) * 1000 })
            }
            min="0"
            max="300"
          />
        </div>
      </CardContent>
    </Card>
  );
}
