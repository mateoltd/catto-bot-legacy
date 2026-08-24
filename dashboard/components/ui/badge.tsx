import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-muted-foreground bg-foreground text-background',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        destructive: 'border-destructive bg-destructive/10 text-red-400',
        outline: 'border-muted-foreground/50 bg-transparent text-foreground',
        success: 'border-green-500/40 bg-green-500/10 text-green-400',
        neon: 'border-muted-foreground/50 bg-muted text-foreground',
        muted: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
