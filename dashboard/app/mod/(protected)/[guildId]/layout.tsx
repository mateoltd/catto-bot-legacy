"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { getModDashboardAccess } from "@/lib/services/mod.service";
import { AccountSwitcher } from "@/components/mod/account-switcher";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { GuildSidebar } from "@/components/dashboard/guild-sidebar";
import { ModBreadcrumb } from "@/components/mod/mod-breadcrumb";
import { CommandPalette } from "@/components/mod/command-palette";
import { ShortcutHelp } from "@/components/mod/shortcut-help";
import { FloatingActionButton } from "@/components/mod/fab";
import { useGuildInfo } from "@/hooks/use-guild-info";
import { useModEvents, type ModEvent } from "@/hooks/use-mod-events";
import { IconMenu2, IconShieldCheck, IconX } from "@/lib/mod-icons";

function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export default function GuildModLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;
  const guildInfo = useGuildInfo(guildId);
  const { data: access, isLoading: accessLoading } = useSWR(
    ["dashboard-access", guildId],
    () => getModDashboardAccess(guildId),
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const sidebarOpenRef = useRef(false);

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  const { mutate: globalMutate } = useSWRConfig();
  const handleModEvent = useCallback(
    (event: ModEvent) => {
      if (
        event.type === "evidence:created" ||
        event.type === "evidence:amended" ||
        event.type === "evidence:status-changed"
      ) {
        globalMutate(
          (key: unknown) => {
            if (!Array.isArray(key)) return false;
            return (
              key[0] === "case-evidence" ||
              key[0] === "guild-evidence" ||
              key[0] === "cases" ||
              key[0] === "case-detail"
            );
          },
          undefined,
          { revalidate: true },
        );
      }
      if (
        event.type === "case:created" ||
        event.type === "case:updated" ||
        event.type === "case:closed"
      ) {
        globalMutate(
          (key: unknown) => {
            if (!Array.isArray(key)) return false;
            return key[0] === "cases" || key[0] === "case-detail";
          },
          undefined,
          { revalidate: true },
        );
      }
    },
    [globalMutate],
  );

  useModEvents({
    guildId,
    enabled: true,
    onEvent: handleModEvent,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (sidebarOpenRef.current) {
          closeSidebar();
          return;
        }
      }

      if (isInputFocused()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      if (e.key === "g" || e.key === "G") {
        if (!gPressedRef.current) {
          gPressedRef.current = true;
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
          case "o":
          case "O":
            e.preventDefault();
            router.push(`/mod/${guildId}`);
            break;
          case "c":
          case "C":
            e.preventDefault();
            router.push(`/mod/${guildId}/cases`);
            break;
          case "e":
          case "E":
            e.preventDefault();
            router.push(`/mod/${guildId}/evidence`);
            break;
          case "u":
          case "U":
            e.preventDefault();
            router.push(`/mod/${guildId}/users`);
            break;
          case "a":
          case "A":
            e.preventDefault();
            router.push(`/mod/${guildId}/analytics`);
            break;
          case "s":
          case "S":
            e.preventDefault();
            router.push("/guilds");
            break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [guildId, router, closeSidebar]);

  const handleShowShortcuts = useCallback(() => setShowShortcuts(true), []);
  const topbar = (
    <DashboardTopbar
      showServersLink
      leading={
        access?.hasAccess ? (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-1 text-muted-foreground hover:text-foreground md:hidden"
            aria-label="Open server navigation"
          >
            <IconMenu2 size={20} />
          </button>
        ) : undefined
      }
    />
  );

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-[var(--mod-bg)]">
        {topbar}
        <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin border-2 border-[var(--mod-text-dim)] border-t-[var(--mono-white)]" />
            <p
              className="text-xs uppercase tracking-widest text-[var(--mod-text-dim)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Checking access...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!access?.hasAccess) {
    return (
      <div className="min-h-screen bg-[var(--mod-bg)]">
        {topbar}
        <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-3xl text-[var(--mod-text-dim)]">
              <IconShieldCheck size={48} />
            </div>
            <h1
              className="text-sm uppercase tracking-widest text-[var(--mono-white)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Access Denied
            </h1>
            <p className="max-w-xs text-sm text-[var(--mod-text-muted)]">
              You don&apos;t have permission to view this server&apos;s
              moderation dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <GuildSidebar
      guild={{
        id: guildId,
        name: guildInfo?.name ?? "Loading…",
        icon: guildInfo?.icon ?? null,
      }}
      access={{ canConfigure: access.canConfigure, canModerate: true }}
      account={<AccountSwitcher />}
      onNavigate={closeSidebar}
    />
  );

  return (
    <div className="min-h-screen bg-[var(--mod-bg)]">
      {topbar}
      <div className="flex min-h-[calc(100vh-3rem)]">
        <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] w-56 flex-col border-r border-[var(--mod-border)] bg-[var(--mod-surface)] md:flex">
          {sidebarContent}
        </aside>

        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={closeSidebar}
            />
            <aside className="fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-[var(--mod-border)] bg-[var(--mod-surface)] md:hidden">
              <div className="flex justify-end p-2">
                <button
                  type="button"
                  onClick={closeSidebar}
                  className="p-1 text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
                  aria-label="Close server navigation"
                >
                  <IconX size={18} />
                </button>
              </div>
              {sidebarContent}
            </aside>
          </>
        )}

        <main className="min-w-0 flex-1 overflow-auto">
          <div className="w-full px-4 py-5 md:px-6 md:py-8">
            <ModBreadcrumb />
            {children}
          </div>
        </main>
      </div>

      <CommandPalette onShowShortcuts={handleShowShortcuts} />
      <FloatingActionButton />
      {showShortcuts && (
        <ShortcutHelp onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
