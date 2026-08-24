'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OptionSelector } from '@/components/ui/option-selector';
import { useTranslations } from 'next-intl';

type NamingScheme = 'username' | 'displayname' | 'sequential' | 'custom';

interface NamingSectionProps {
  namingScheme: NamingScheme;
  customNamingPattern: string;
  onNamingSchemeChange: (scheme: NamingScheme) => void;
  onCustomPatternChange: (pattern: string) => void;
}

export default function NamingSection({
  namingScheme,
  customNamingPattern,
  onNamingSchemeChange,
  onCustomPatternChange,
}: NamingSectionProps) {
  const t = useTranslations('TempVoice');
  const namingOptions: { value: NamingScheme; label: string; description: string }[] = [
    { value: 'username', label: t('namingUsername'), description: t('namingUsernameDescription') },
    { value: 'displayname', label: t('namingDisplayName'), description: t('namingDisplayNameDescription') },
    { value: 'sequential', label: t('namingSequential'), description: t('namingSequentialDescription') },
    { value: 'custom', label: t('namingCustom'), description: t('namingCustomDescription') },
  ];
  const templateVariables = [
    { variable: '{username}', description: t('variableUsername') },
    { variable: '{displayname}', description: t('variableDisplayName') },
    { variable: '{userid}', description: t('variableUserId') },
    { variable: '{count}', description: t('variableCount') },
  ];
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>{t('channelNaming')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">{t('namingScheme')}</label>
          <OptionSelector
            value={namingScheme}
            onValueChange={onNamingSchemeChange}
            ariaLabel={t('namingScheme')}
            options={namingOptions}
          />
        </div>

        {namingScheme === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t('customPattern')}</label>
            <Input
              value={customNamingPattern || ''}
              onChange={(e) => onCustomPatternChange(e.target.value)}
              placeholder={t('customPatternPlaceholder')}
            />
            <div className="mt-2 p-3 bg-muted/20 border border-border/30">
              <p className="text-xs font-medium text-foreground mb-1.5">{t('availableVariables')}</p>
              <div className="grid grid-cols-2 gap-1">
                {templateVariables.map((v) => (
                  <div key={v.variable} className="text-xs text-muted-foreground">
                    <code className="text-primary/80">{v.variable}</code> - {v.description}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
