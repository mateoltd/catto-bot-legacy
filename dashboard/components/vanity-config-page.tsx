'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { useVanityConfig } from '@/hooks/use-vanity-config';
import VanityConfigForm from '@/components/vanity-config-form';

export default function VanityConfigPage({ guildId }: { guildId: string }) {
  const t = useTranslations('Vanity');
  const { config, loading, error, mutate } = useVanityConfig(guildId);

  if (loading) {
    return (
      <Card variant="glass">
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <div className="neon-spinner" />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !config) {
    return (
      <Card variant="glass">
        <CardContent className="py-12 text-center">
          <h2 className="text-lg font-semibold text-foreground">{t('loadFailed')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ?? t('loadFailedDescription')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <VanityConfigForm
      guildId={guildId}
      initialConfig={config}
      onSaved={(updated) => mutate({ config: updated }, { revalidate: false })}
    />
  );
}
