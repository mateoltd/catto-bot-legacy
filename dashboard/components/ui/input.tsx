import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  variant?: 'default' | 'pill' | 'ghost';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'default', ...props }, ref) => {
    const variants = {
      default:
        'rounded-lg border border-border/50 bg-input focus:border-primary/50 focus:shadow-[0_0_10px_hsl(210_100%_55%/0.15)]',
      pill: 'rounded-full border border-border/50 bg-input px-5 focus:border-primary/50 focus:shadow-[0_0_10px_hsl(210_100%_55%/0.15)]',
      ghost:
        'rounded-lg border border-transparent bg-transparent hover:bg-muted/30 focus:bg-input focus:border-border/50',
    };

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full px-4 py-2 text-sm text-foreground transition-all duration-200',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          variants[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
