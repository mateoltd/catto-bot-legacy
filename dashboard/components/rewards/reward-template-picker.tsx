'use client';

import { Button } from '@/components/ui/button';
import type { RewardTemplate } from '@/lib/services/rewards.service';

interface RewardTemplatePickerProps {
  templates: RewardTemplate[];
  saving?: boolean;
  onApply: (templateKey: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  ROLES: 'Roles',
  ECONOMY: 'Economy',
  ACCESS: 'Access',
  MIXED: 'Mixed rewards',
};

export function RewardTemplatePicker({ templates, saving = false, onApply }: RewardTemplatePickerProps) {
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
              {CATEGORY_LABELS[template.category] ?? template.category} · {template.rewardCount}{' '}
              {template.rewardCount === 1 ? 'reward' : 'rewards'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => onApply(template.key)}
            className="shrink-0 self-start text-muted-foreground sm:self-auto"
            aria-label={`Use ${template.name} template`}
          >
            Use
          </Button>
        </article>
      ))}
    </div>
  );
}
