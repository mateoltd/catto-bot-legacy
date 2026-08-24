'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface OptionSelectorOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface OptionSelectorProps<T extends string> {
  value: T;
  options: readonly OptionSelectorOption<T>[];
  onValueChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  ariaLabel?: string;
  className?: string;
}

export function OptionSelector<T extends string>({
  value,
  options,
  onValueChange,
  columns = 2,
  ariaLabel,
  className,
}: OptionSelectorProps<T>) {
  const columnClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
  }[columns];

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid gap-px overflow-hidden border border-border bg-border', columnClass, className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'group relative min-h-16 px-4 py-3 text-left transition-colors duration-100',
              'hover:bg-accent focus-visible:z-10',
              selected
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-input text-foreground'
            )}
          >
            <span className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border',
                  selected ? 'border-background bg-background text-foreground' : 'border-muted-foreground'
                )}
                aria-hidden="true"
              >
                {selected && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-sm font-medium">{option.label}</span>
                {option.description && (
                  <span
                    className={cn(
                      'mt-1 block text-xs leading-4',
                      selected ? 'text-background/70' : 'text-muted-foreground'
                    )}
                  >
                    {option.description}
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
