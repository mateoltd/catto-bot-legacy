'use client';

import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { getModDashboardAccess } from '@/lib/services/mod.service';
import { AccountSwitcher } from '@/components/mod/account-switcher';
import { ModBreadcrumb } from '@/components/mod/mod-breadcrumb';
import { CommandPalette } from '@/components/mod/command-palette';
import { ShortcutHelp } from '@/components/mod/shortcut-help';
import { FloatingActionButton } from '@/components/mod/fab';
import { useGuildInfo } from '@/hooks/use-guild-info';
import { useModEvents, type ModEvent } from '@/hooks/use-mod-events';
import {
  IconLayoutDashboard,
  IconGavel,
  IconFolder,
  IconClipboardList,
  IconShieldCheck,
  IconFilter,
  IconMessageReport,
  IconMenu2,
  IconX,
  IconChartBar,
  IconUsers,
} from '@/lib/mod-icons';
import type { Icon } from '@tabler/icons-react';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: Icon;
  shortcut?: string;
  disabled?: boolean;
}

const MODERATION_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', href: '', icon: IconLayoutDashboard, shortcut: 'G O' },
  { id: 'cases', label: 'Cases', href: '/cases', icon: IconGavel, shortcut: 'G C' },
  { id: 'evidence', label: 'All Evidence', href: '/evidence', icon: IconFolder, shortcut: 'G E' },
  { id: 'users', label: 'Users', href: '/users', icon: IconUsers, shortcut: 'G U' },
  { id: 'analytics', label: 'Analytics', href: '/analytics', icon: IconChartBar, shortcut: 'G A' },
  { id: 'audit', label: 'Audit Log', href: '/audit', icon: IconClipboardList, disabled: true },
  { id: 'reports', label: 'Reports', href: '/reports', icon: IconMessageReport, disabled: true },
];

const CONFIG_NAV: NavItem[] = [
  { id: 'automod', label: 'Auto-Mod Rules', href: '/automod', icon: IconShieldCheck, disabled: true },
  { id: 'filters', label: 'Filters & Triggers', href: '/filters', icon: IconFilter, disabled: true },
  { id: 'settings', label: 'Settings', href: '/settings', icon: IconLayoutDashboard, disabled: true },
];

function SoonBadge() {
  return (
    <span
      className="ml-auto border px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
      style={{
        fontFamily: 'var(--font-mono)',
        background: 'var(--mod-soon-bg)',
        color: 'var(--mod-soon-text)',
        borderColor: 'var(--mod-soon-border)',
      }}
    >
      SOON
    </span>
  );
}

function NavSection({ label, items, basePath, pathname, onNavClick }: {
  label: string;
  items: NavItem[];
  basePath: string;
  pathname: string;
  onNavClick?: () => void;
}) {
  return (
    <div className="mb-4">
      <p
        className="mb-1 px-3 text-[10px] uppercase tracking-[0.2em] text-[var(--mod-text-dim)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive =
            item.href === ''
              ? pathname === basePath
              : pathname.startsWith(href);

          if (item.disabled) {
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 text-sm opacity-30"
              >
                <item.icon size={16} className="text-[var(--mod-text-dim)]" />
                <span className="text-[var(--mod-text-muted)]">{item.label}</span>
                <SoonBadge />
              </div>
            );
          }

          return (
            <Link
              key={item.id}
              href={href}
              onClick={onNavClick}
              className={`flex items-center gap-2 px-3 py-2 text-sm transition-[background-color] duration-75 ${
                isActive
                  ? 'bg-[var(--mono-800)] text-[var(--mono-white)]'
                  : 'text-[var(--mod-text-muted)] hover:bg-[var(--mono-850)] hover:text-[var(--mod-text)]'
              }`}
            >
              <item.icon size={16} className={isActive ? 'text-[var(--mono-white)]' : 'text-[var(--mod-text-dim)]'} />
              <span>{item.label}</span>
              {item.shortcut && (
                <span
                  className="ml-auto text-[10px] tracking-wider text-[var(--mod-text-dim)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {item.shortcut}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export default function GuildModLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;
  const basePath = `/mod/${guildId}`;
  const guildInfo = useGuildInfo(guildId);
  const { data: access, isLoading: accessLoading } = useSWR(
    ['dashboard-access', guildId],
    () => getModDashboardAccess(guildId),
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const sidebarOpenRef = useRef(false);
  sidebarOpenRef.current = sidebarOpen;

  // Real-time event handling via SSE
  const { mutate: globalMutate } = useSWRConfig();
  const handleModEvent = useCallback(
    (event: ModEvent) => {
      // Revalidate relevant SWR keys based on event type
      if (event.type === 'evidence:created' || event.type === 'evidence:amended' || event.type === 'evidence:status-changed') {
        globalMutate((key: unknown) => {
          if (!Array.isArray(key)) return false;
          return key[0] === 'case-evidence' || key[0] === 'guild-evidence';
        }, undefined, { revalidate: true });
      }
      if (event.type === 'case:created' || event.type === 'case:updated' || event.type === 'case:closed') {
        globalMutate((key: unknown) => {
          if (!Array.isArray(key)) return false;
          return key[0] === 'cases' || key[0] === 'case-detail';
        }, undefined, { revalidate: true });
      }
    },
    [globalMutate],
  );

  useModEvents({
    guildId,
    enabled: true,
    onEvent: handleModEvent,
  });

  // Close sidebar on route change (covers browser back/forward + keyboard nav)
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  // All keyboard shortcuts: Escape (sidebar), G-prefix nav, ? help
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape closes sidebar regardless of input focus
      if (e.key === 'Escape') {
        if (sidebarOpenRef.current) {
          closeSidebar();
          return;
        }
      }

      if (isInputFocused()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // ? shows shortcut help
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // G-prefix: first press sets flag, second press navigates
      if (e.key === 'g' || e.key === 'G') {
        if (!gPressedRef.current) {
          gPressedRef.current = true;
          // Reset after 1s if no second key
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => {
            gPressedRef.current = false;
          }, 1000);
          return;
        }
      }

      if (gPressedRef.current) {
        gPressedRef.current = false;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);

        switch (e.key) {
          case 'o':
          case 'O':
            e.preventDefault();
            router.push(`/mod/${guildId}`);
            break;
          case 'c':
          case 'C':
            e.preventDefault();
            router.push(`/mod/${guildId}/cases`);
            break;
          case 'e':
          case 'E':
            e.preventDefault();
            router.push(`/mod/${guildId}/evidence`);
            break;
          case 'u':
          case 'U':
            e.preventDefault();
            router.push(`/mod/${guildId}/users`);
            break;
          case 'a':
          case 'A':
            e.preventDefault();
            router.push(`/mod/${guildId}/analytics`);
            break;
          case 's':
          case 'S':
            e.preventDefault();
            router.push('/mod');
            break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [guildId, router, closeSidebar]);

  const handleShowShortcuts = useCallback(() => setShowShortcuts(true), []);

  // ─── Access gate ───
  if (accessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--mod-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin border-2 border-[var(--mod-text-dim)] border-t-[var(--mono-white)]" />
          <p
            className="text-xs uppercase tracking-widest text-[var(--mod-text-dim)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Checking access...
          </p>
        </div>
      </div>
    );
  }

  if (!access?.hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--mod-bg)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-3xl text-[var(--mod-text-dim)]">
            <IconShieldCheck size={48} />
          </div>
          <h1
            className="text-sm uppercase tracking-widest text-[var(--mono-white)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Access Denied
          </h1>
          <p className="max-w-xs text-sm text-[var(--mod-text-muted)]">
            You don't have permission to view this server's moderation dashboard.
          </p>
          <Link
            href="/mod"
            className="border border-[var(--mod-border)] bg-[var(--mod-surface)] px-4 py-2 text-xs uppercase tracking-widest text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mono-850)] hover:text-[var(--mono-white)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            &larr; Back to servers
          </Link>
        </div>
      </div>
    );
  }

  const guildIconUrl = guildInfo?.icon
    ? `https://cdn.discordapp.com/icons/${guildId}/${guildInfo.icon}.png?size=64`
    : null;

  const sidebarContent = (
    <>
      {/* Guild header */}
      <div className="border-b border-[var(--mod-border)] p-4">
        <Link
          href="/mod"
          className="mb-3 flex items-center gap-1 text-xs uppercase tracking-widest text-[var(--mod-text-dim)] transition-[background-color] duration-75 hover:text-[var(--mod-text-muted)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          &larr; ALL SERVERS
        </Link>
        <div className="flex items-center gap-2">
          {guildIconUrl ? (
            <img src={guildIconUrl} alt="" className="h-8 w-8 shrink-0" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--mono-700)] text-xs font-medium text-[var(--mono-white)]">
              {guildInfo?.name?.charAt(0) ?? '?'}
            </div>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--mono-white)]">
            {guildInfo?.name ?? 'Loading...'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-auto p-2">
        <NavSection label="MODERATION" items={MODERATION_NAV} basePath={basePath} pathname={pathname} onNavClick={closeSidebar} />
        <NavSection label="CONFIGURATION" items={CONFIG_NAV} basePath={basePath} pathname={pathname} onNavClick={closeSidebar} />
      </nav>

      <AccountSwitcher />
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 flex-col border-r border-[var(--mod-border)] bg-[var(--mod-surface)] md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={closeSidebar}
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-[var(--mod-border)] bg-[var(--mod-surface)] md:hidden">
            {/* Close button */}
            <div className="flex justify-end p-2">
              <button
                onClick={closeSidebar}
                className="p-1 text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
              >
                <IconX size={18} />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--mod-border)] bg-[var(--mod-surface)] px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 text-[var(--mod-text-muted)] hover:text-[var(--mono-white)]"
          >
            <IconMenu2 size={20} />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--mono-white)]">
            {guildInfo?.name ?? 'Loading...'}
          </span>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
          <ModBreadcrumb />
          {children}
        </div>
      </main>

      {/* Command palette */}
      <CommandPalette onShowShortcuts={handleShowShortcuts} />

      {/* Floating action button (mobile) */}
      <FloatingActionButton />

      {/* Shortcut help modal */}
      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
