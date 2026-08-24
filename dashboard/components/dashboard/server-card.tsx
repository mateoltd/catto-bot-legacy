import Link from 'next/link';
import Image from 'next/image';
import { IconArrowRight } from '@tabler/icons-react';

export interface ServerSummary {
  id: string;
  name: string;
  icon: string | null;
}

interface ServerCardProps {
  server: ServerSummary;
  href: string;
  status: string;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function ServerCard({
  server,
  href,
  status,
  compact = false,
  disabled = false,
  onClick,
}: ServerCardProps) {
  const iconUrl = server.icon
    ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=96`
    : null;
  const className = `flex items-center gap-3 border border-border bg-card ${
    compact ? 'px-4 py-3' : 'min-h-24 p-4'
  } ${
    disabled
      ? 'cursor-not-allowed opacity-45'
      : 'hover:border-muted-foreground/50 hover:bg-accent'
  }`;
  const content = (
    <>
      {iconUrl ? (
        <Image src={iconUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-muted font-mono text-sm font-semibold text-foreground">
          {server.name.charAt(0).toLocaleUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{server.name}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {status}
        </p>
      </div>
      {!disabled && <IconArrowRight size={16} className="shrink-0 text-muted-foreground" />}
    </>
  );

  return disabled ? (
    <div className={className} aria-disabled="true">
      {content}
    </div>
  ) : (
    <Link href={href} onClick={onClick} className={className}>
      {content}
    </Link>
  );
}
