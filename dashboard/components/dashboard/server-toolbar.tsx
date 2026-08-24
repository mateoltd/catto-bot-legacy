import { IconLayoutGrid, IconList, IconSearch } from '@tabler/icons-react';

export type ServerViewMode = 'grid' | 'list';

interface ServerToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  viewMode: ServerViewMode;
  onViewModeChange: (viewMode: ServerViewMode) => void;
}

export function ServerToolbar({
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
}: ServerToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative flex-1" htmlFor="server-search">
        <span className="sr-only">Search servers</span>
        <IconSearch
          size={17}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="server-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by server name"
          className="h-11 w-full border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-muted-foreground"
        />
      </label>
      <button
        type="button"
        onClick={() => onViewModeChange(viewMode === 'grid' ? 'list' : 'grid')}
        className="flex h-11 w-11 items-center justify-center border border-border bg-card text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
        aria-label={viewMode === 'grid' ? 'Use list view' : 'Use grid view'}
      >
        {viewMode === 'grid' ? <IconList size={18} /> : <IconLayoutGrid size={18} />}
      </button>
    </div>
  );
}
