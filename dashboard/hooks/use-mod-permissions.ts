import useSWR from 'swr';
import { getModDashboardAccess } from '@/lib/services/mod.service';
import type { DashboardPermissions } from '@/lib/mod-types';

/**
 * Reads the dashboard-access SWR cache populated by the guild layout.
 * SWR deduplicates, so this never triggers an extra API call.
 */
export function useModPermissions(guildId: string) {
  const { data, isLoading } = useSWR<DashboardPermissions | null>(
    ['dashboard-access', guildId],
    () => getModDashboardAccess(guildId),
  );

  return {
    permissions: data,
    isLoading,
    hasAccess: data?.hasAccess ?? false,
    sections: data?.sections ?? { cases: false, evidence: false, evidenceAdd: false, evidenceCapture: false },
    isAdmin: data?.isAdmin ?? false,
  };
}
