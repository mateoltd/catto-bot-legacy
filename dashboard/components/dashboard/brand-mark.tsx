import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  compact?: boolean;
  href?: string;
}

export function BrandMark({ compact = false, href = '/guilds' }: BrandMarkProps) {
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Catto dashboard">
      <span
        className={cn(
          'font-mono font-semibold uppercase text-foreground',
          compact ? 'text-xs tracking-[0.18em]' : 'text-sm tracking-[0.22em]',
        )}
      >
        Catto
      </span>
    </Link>
  );
}
