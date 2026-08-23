'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { Command as CommandPrimitive } from 'cmdk';
import { fuzzyFilter } from '@/lib/fuzzy-match';
import {
  IconLayoutDashboard,
  IconGavel,
  IconFolder,
  IconChevronLeft,
  IconSearch,
  IconFilter,
  IconKeyboard,
  IconLink,
  IconRefresh,
  IconX,
  IconHistory,
} from '@/lib/mod-icons';

interface NavItem {
  label: string;
  href: string;
  shortcut?: string;
  icon: typeof IconLayoutDashboard;
}

interface ActionItem {
  label: string;
  action: () => void;
  icon: typeof IconLayoutDashboard;
}

interface CommandPaletteProps {
  onShowShortcuts?: () => void;
}

const RECENT_SEARCHES_KEY = (guildId: string) => `mod:recentSearches:${guildId}`;
const MAX_RECENT = 5;

function getRecentSearches(guildId: string): { label: string; href: string }[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY(guildId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(guildId: string, label: string, href: string) {
  try {
    const recent = getRecentSearches(guildId).filter((r) => r.href !== href);
    recent.unshift({ label, href });
    localStorage.setItem(RECENT_SEARCHES_KEY(guildId), JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // localStorage may be unavailable
  }
}

export function CommandPalette({ onShowShortcuts }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const params = useParams();
  const { mutate } = useSWRConfig();
  const guildId = params.guildId as string;

  const [recentItems, setRecentItems] = useState<{ label: string; href: string }[]>([]);

  // Load recent searches when palette opens
  useEffect(() => {
    if (open && guildId) {
      setRecentItems(getRecentSearches(guildId));
    }
  }, [open, guildId]);

  const navItems: NavItem[] = [
    { label: 'Overview', href: `/mod/${guildId}`, shortcut: 'G O', icon: IconLayoutDashboard },
    { label: 'Cases', href: `/mod/${guildId}/cases`, shortcut: 'G C', icon: IconGavel },
    { label: 'All Evidence', href: `/mod/${guildId}/evidence`, shortcut: 'G E', icon: IconFolder },
    { label: 'Back to Servers', href: '/mod', shortcut: 'G S', icon: IconChevronLeft },
  ];

  const caseFilterActions: ActionItem[] = [
    { label: 'Cases: Filter by Ban', action: () => router.push(`/mod/${guildId}/cases?action=BAN`), icon: IconGavel },
    { label: 'Cases: Filter by Kick', action: () => router.push(`/mod/${guildId}/cases?action=KICK`), icon: IconGavel },
    { label: 'Cases: Filter by Timeout', action: () => router.push(`/mod/${guildId}/cases?action=TIMEOUT`), icon: IconGavel },
    { label: 'Cases: Filter by Warning', action: () => router.push(`/mod/${guildId}/cases?action=WARN`), icon: IconGavel },
    { label: 'Cases: Show Open only', action: () => router.push(`/mod/${guildId}/cases?status=OPEN`), icon: IconFilter },
    { label: 'Cases: Show Closed only', action: () => router.push(`/mod/${guildId}/cases?status=CLOSED`), icon: IconFilter },
    { label: 'Cases: Show Void only', action: () => router.push(`/mod/${guildId}/cases?status=VOID`), icon: IconFilter },
    { label: 'Cases: Clear all filters', action: () => router.push(`/mod/${guildId}/cases`), icon: IconGavel },
  ];

  const evidenceFilterActions: ActionItem[] = [
    { label: 'Evidence: Filter by Image', action: () => router.push(`/mod/${guildId}/evidence?type=IMAGE`), icon: IconFolder },
    { label: 'Evidence: Filter by Video', action: () => router.push(`/mod/${guildId}/evidence?type=VIDEO`), icon: IconFolder },
    { label: 'Evidence: Filter by URL', action: () => router.push(`/mod/${guildId}/evidence?type=URL`), icon: IconFolder },
    { label: 'Evidence: Filter by Snapshot', action: () => router.push(`/mod/${guildId}/evidence?type=MESSAGE_SNAPSHOT`), icon: IconFolder },
    { label: 'Evidence: Clear all filters', action: () => router.push(`/mod/${guildId}/evidence`), icon: IconFolder },
  ];

  const quickActions: ActionItem[] = [
    {
      label: 'Copy current URL',
      action: () => {
        navigator.clipboard.writeText(window.location.href);
      },
      icon: IconLink,
    },
    {
      label: 'Refresh data',
      action: () => {
        mutate(() => true, undefined, { revalidate: true });
      },
      icon: IconRefresh,
    },
    {
      label: 'Clear all filters',
      action: () => {
        router.push(window.location.pathname);
      },
      icon: IconX,
    },
  ];

  const utilityActions: ActionItem[] = [
    { label: 'Show keyboard shortcuts', action: () => { setOpen(false); onShowShortcuts?.(); }, icon: IconKeyboard },
  ];

  // Parse search for special patterns
  const caseNumberMatch = useMemo(() => {
    const match = search.trim().match(/^#?(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }, [search]);

  // @username search (strip @ from query)
  const userSearchQuery = useMemo(() => {
    const trimmed = search.trim();
    return trimmed.startsWith('@') && trimmed.length > 1 ? trimmed.slice(1) : null;
  }, [search]);

  // Determine if we're in a special mode where we want to disable filtering
  const isSpecialMode = caseNumberMatch !== null || userSearchQuery !== null;

  // Toggle on Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Reset search when opening
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const handleNavSelect = useCallback(
    (label: string, href: string) => {
      setOpen(false);
      saveRecentSearch(guildId, label, href);
      router.push(href);
    },
    [router, guildId]
  );

  const handleActionSelect = useCallback(
    (label: string, action: () => void) => {
      setOpen(false);
      action();
    },
    []
  );

  const groupHeading = (text: string) => (
    <span
      className="px-2 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--mod-text-dim)]"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {text}
    </span>
  );

  const itemClass =
    'flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 data-[selected=true]:bg-[var(--mono-800)] data-[selected=true]:text-[var(--mono-white)]';

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg border border-[var(--mod-border)] bg-[var(--mono-900)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CommandPrimitive
          className="flex flex-col"
          filter={isSpecialMode ? () => 1 : fuzzyFilter}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          {/* Input */}
          <div className="flex items-center border-b border-[var(--mod-border)] px-4">
            <IconSearch size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
            <CommandPrimitive.Input
              placeholder="Type a command, #case, or @user..."
              value={search}
              onValueChange={setSearch}
              className="flex-1 bg-transparent px-3 py-3 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
              style={{ fontFamily: 'var(--font-mono)' }}
              autoFocus
            />
          </div>

          {/* List */}
          <CommandPrimitive.List className="max-h-[300px] overflow-y-auto p-2">
            {!search && (
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-[var(--mod-text-dim)]">
                No results found.
              </CommandPrimitive.Empty>
            )}

            {/* Go to case #N — top priority when detected */}
            {caseNumberMatch !== null && (
              <CommandPrimitive.Group heading={groupHeading('JUMP TO')} forceMount>
                <CommandPrimitive.Item
                  value={`__jump_case_${caseNumberMatch}`}
                  onSelect={() => handleNavSelect(`Case #${caseNumberMatch}`, `/mod/${guildId}/cases/${caseNumberMatch}`)}
                  className={itemClass}
                  forceMount
                >
                  <IconGavel size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
                  <span className="flex-1">Go to Case #{caseNumberMatch}</span>
                  <span className="text-[10px] tracking-wider text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>Enter</span>
                </CommandPrimitive.Item>
              </CommandPrimitive.Group>
            )}

            {/* User search @username */}
            {userSearchQuery && (
              <CommandPrimitive.Group heading={groupHeading('SEARCH USERS')} forceMount>
                <CommandPrimitive.Item
                  value={`__user_search_${userSearchQuery}`}
                  onSelect={() => handleNavSelect(`Search: @${userSearchQuery}`, `/mod/${guildId}/cases?search=${encodeURIComponent(userSearchQuery)}`)}
                  className={itemClass}
                  forceMount
                >
                  <IconSearch size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
                  <span className="flex-1">Search cases for user &apos;{userSearchQuery}&apos;</span>
                  <span className="text-[10px] tracking-wider text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>Enter</span>
                </CommandPrimitive.Item>
              </CommandPrimitive.Group>
            )}

            {/* General search — when text is entered but not a special pattern */}
            {search && !isSpecialMode && (
              <CommandPrimitive.Group heading={groupHeading('SEARCH')} forceMount>
                <CommandPrimitive.Item
                  value={`__general_search_${search}`}
                  onSelect={() => handleNavSelect(`Search: ${search}`, `/mod/${guildId}/cases?search=${encodeURIComponent(search)}`)}
                  className={itemClass}
                  forceMount
                >
                  <IconSearch size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
                  <span className="flex-1">Search cases for &apos;{search}&apos;</span>
                  <span className="text-[10px] tracking-wider text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>Enter</span>
                </CommandPrimitive.Item>
              </CommandPrimitive.Group>
            )}

            {/* Regular items — hidden when in special mode */}
            {!isSpecialMode && (
              <>
                {/* Recent searches — only when input is empty */}
                {!search && recentItems.length > 0 && (
                  <CommandPrimitive.Group heading={groupHeading('RECENT')}>
                    {recentItems.map((item, i) => (
                      <CommandPrimitive.Item
                        key={item.href}
                        value={`__recent_${i}`}
                        onSelect={() => handleNavSelect(item.label, item.href)}
                        className={itemClass}
                      >
                        <IconHistory size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
                        <span className="flex-1">{item.label}</span>
                      </CommandPrimitive.Item>
                    ))}
                  </CommandPrimitive.Group>
                )}

                <CommandPrimitive.Group heading={groupHeading('NAVIGATION')}>
                  {navItems.map((item) => (
                    <CommandPrimitive.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => handleNavSelect(item.label, item.href)}
                      className={itemClass}
                    >
                      <item.icon size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[10px] tracking-wider text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
                          {item.shortcut}
                        </span>
                      )}
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>

                <CommandPrimitive.Group heading={groupHeading('QUICK ACTIONS')}>
                  {quickActions.map((item) => (
                    <CommandPrimitive.Item key={item.label} value={item.label} onSelect={() => handleActionSelect(item.label, item.action)} className={itemClass}>
                      <item.icon size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
                      <span className="flex-1">{item.label}</span>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>

                <CommandPrimitive.Group heading={groupHeading('CASES')}>
                  {caseFilterActions.map((item) => (
                    <CommandPrimitive.Item key={item.label} value={item.label} onSelect={() => handleActionSelect(item.label, item.action)} className={itemClass}>
                      <item.icon size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
                      <span className="flex-1">{item.label}</span>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>

                <CommandPrimitive.Group heading={groupHeading('EVIDENCE')}>
                  {evidenceFilterActions.map((item) => (
                    <CommandPrimitive.Item key={item.label} value={item.label} onSelect={() => handleActionSelect(item.label, item.action)} className={itemClass}>
                      <item.icon size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
                      <span className="flex-1">{item.label}</span>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>

                <CommandPrimitive.Group heading={groupHeading('UTILITY')}>
                  {utilityActions.map((item) => (
                    <CommandPrimitive.Item key={item.label} value={item.label} onSelect={() => handleActionSelect(item.label, item.action)} className={itemClass}>
                      <item.icon size={16} className="shrink-0 text-[var(--mod-text-dim)]" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[10px] tracking-wider text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>?</span>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              </>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </div>
    </div>
  );
}
