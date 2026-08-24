import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  variant?: 'default' | 'pill' | 'ghost';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'border border-border bg-input focus:border-muted-foreground',
      pill: 'border border-border bg-input px-5 focus:border-muted-foreground',
      ghost:
        'border border-transparent bg-transparent hover:bg-muted/30 focus:border-border focus:bg-input',
    };

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full px-4 py-2 text-sm text-foreground transition-colors duration-100',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none',
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
