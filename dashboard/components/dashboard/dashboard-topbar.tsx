import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { BrandMark } from '@/components/dashboard/brand-mark';
import { cn } from '@/lib/utils';

interface DashboardTopbarProps {
  showServersLink?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  contentClassName?: string;
}

export function DashboardTopbar({
  showServersLink = false,
  leading,
  trailing,
  contentClassName,
}: DashboardTopbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div
        className={cn(
          'flex h-12 w-full items-center justify-between px-4 sm:px-6',
          contentClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {leading}
          <BrandMark compact />
          {showServersLink && (
            <>
              <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
              <Link
                href="/guilds"
                aria-label="Servers"
                className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <IconArrowLeft size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Servers</span>
                <span className="sr-only sm:hidden">Servers</span>
              </Link>
            </>
          )}
        </div>
        {trailing}
      </div>
    </header>
  );
}
