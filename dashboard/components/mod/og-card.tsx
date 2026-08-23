'use client';

interface OGData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface OGCardProps {
  og: OGData;
  url: string;
}

export function OGCard({ og, url }: OGCardProps) {
  if (!og.title && !og.description && !og.image) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full max-w-md gap-3 border border-[var(--mod-border)] bg-[var(--mod-surface)] p-3 transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)]"
    >
      {og.image && (
        <img
          src={og.image}
          alt=""
          className="h-20 w-20 shrink-0 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <div className="min-w-0 flex-1">
        {og.title && (
          <p className="truncate text-sm font-medium text-[var(--mono-white)]">{og.title}</p>
        )}
        {og.description && (
          <p className="mt-0.5 text-xs text-[var(--mod-text-muted)] line-clamp-2">{og.description}</p>
        )}
        {og.siteName && (
          <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--mod-text-dim)]">{og.siteName}</p>
        )}
      </div>
    </a>
  );
}
