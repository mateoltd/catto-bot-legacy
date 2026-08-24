'use client';

import VoiceXPConfigForm from '@/components/voice-xp-config-form';
import { useTranslations } from 'next-intl';
import { useVoiceXPConfig } from '@/hooks/use-voice-xp-config';
import { Card, CardContent } from '@/components/ui/card';

interface VoiceXPConfigPageProps {
  guildId: string;
}

export default function VoiceXPConfigPage({ guildId }: VoiceXPConfigPageProps) {
  const t = useTranslations('VoiceXp');
  const { config, loading, error } = useVoiceXPConfig(guildId);

  if (loading) {
    return (
      <Card variant="glass" className="p-8">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="neon-spinner mb-4" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !config) {
    return (
      <Card variant="glass" className="p-8">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="text-destructive mb-4">
            <svg
              className="w-16 h-16 mx-auto"
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
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {t('loadFailed')}
          </h2>
          <p className="text-muted-foreground text-center">
            {error || t('loadFailedDescription')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <VoiceXPConfigForm guildId={guildId} initialConfig={config} />;
}
