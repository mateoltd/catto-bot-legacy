'use client';

import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import type { RewardTemplate } from '@/lib/services/rewards.service';

interface RewardTemplatePickerProps {
  templates: RewardTemplate[];
  saving?: boolean;
  onApply: (templateKey: string) => void;
}

export function RewardTemplatePicker({ templates, saving = false, onApply }: RewardTemplatePickerProps) {
  const t = useTranslations('Rewards');
  const categoryLabels: Record<string, string> = {
    ROLES: t('categoryRoles'),
    ECONOMY: t('categoryEconomy'),
    ACCESS: t('categoryAccess'),
    MIXED: t('categoryMixed'),
  };
  return (
    <div className="divide-y divide-border/60 border border-border/60 bg-card/40">
      {templates.map((template) => (
        <article
          key={template.key}
          className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-foreground">{template.name}</h4>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{template.description}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {categoryLabels[template.category] ?? template.category} ·{' '}
              {t('rewardCount', { count: template.rewardCount })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => onApply(template.key)}
            className="shrink-0 self-start text-muted-foreground sm:self-auto"
            aria-label={t('useTemplateNamed', { name: template.name })}
          >
            {t('use')}
          </Button>
        </article>
      ))}
    </div>
  );
}
