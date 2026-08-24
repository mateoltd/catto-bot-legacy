import type {
  Evidence,
  EvidenceSummary,
  EvidenceAmendment,
  ModCase,
  DashboardPermissions,
  PresignedUpload,
  CaseNote,
  UserModProfile,
  EvidenceAccessLogEntry,
  EvidenceAnalytics,
  CaseAnalytics,
} from '@/lib/mod-types';
import { dashboardApi } from '@/lib/api';

function api() {
  return dashboardApi;
}

// ─── Dashboard Access ───

export async function getModDashboardAccess(guildId: string): Promise<DashboardPermissions | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/moderation/dashboard-access`);
    return res.data;
  } catch {
    return null;
  }
}

// ─── Cases ───

export async function getCases(
  guildId: string,
  params?: {
    page?: number;
    limit?: number;
    action?: string;
    targetId?: string;
    status?: string;
    sort?: string;
    order?: string;
    search?: string;
  }
): Promise<{ total: number; page: number; totalPages: number; cases: ModCase[] }> {
  const res = await api().get(`/guilds/${guildId}/moderation/cases`, { params });
  return res.data;
}

export async function getCaseDetail(guildId: string, caseNumber: number): Promise<ModCase | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/moderation/cases/${caseNumber}`);
    return res.data;
  } catch {
    return null;
  }
}

// ─── Evidence ───

export async function getGuildEvidence(
  guildId: string,
  params?: { page?: number; limit?: number; type?: string; case?: number; tags?: string }
): Promise<{ evidence: Evidence[]; total: number; page: number; totalPages: number }> {
  const res = await api().get(`/guilds/${guildId}/moderation/evidence`, { params });
  return res.data;
}

export async function getEvidenceForCase(
  guildId: string,
  caseNumber: number
): Promise<{ evidence: Evidence[]; summary: EvidenceSummary }> {
  const res = await api().get(`/guilds/${guildId}/moderation/evidence`, {
    params: { caseNumber },
  });
  return res.data;
}

export async function getEvidenceDetail(
  guildId: string,
  evidenceId: string
): Promise<Evidence | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/moderation/evidence/${evidenceId}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function getEvidenceViewUrl(
  guildId: string,
  evidenceId: string
): Promise<string | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/moderation/evidence/${evidenceId}`, {
      params: { action: 'view-url' },
    });
    return res.data.url;
  } catch {
    return null;
  }
}

export async function getEvidenceHistory(
  guildId: string,
  evidenceId: string
): Promise<EvidenceAmendment[]> {
  const res = await api().get(`/guilds/${guildId}/moderation/evidence/${evidenceId}`, {
    params: { action: 'history' },
  });
  return res.data.history;
}

export async function getEvidenceDownloadUrl(
  guildId: string,
  evidenceId: string
): Promise<string | null> {
  try {
    // Use watermarked-download endpoint - it checks guild config and applies
    // watermark if enabled, otherwise falls back to regular download
    const res = await api().get(`/guilds/${guildId}/moderation/evidence/${evidenceId}`, {
      params: { action: 'watermarked-download' },
    });
    return res.data.url;
  } catch {
    return null;
  }
}

// ─── Upload Flow ───

export async function initiateUpload(
  guildId: string,
  params: {
    caseNumber: number;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    description?: string;
    tags?: string[];
  }
): Promise<PresignedUpload> {
  const res = await api().post(`/guilds/${guildId}/moderation/evidence`, {
    action: 'initiate',
    ...params,
  });
  return res.data;
}

export async function confirmUpload(
  guildId: string,
  evidenceId: string,
  contentHash: string
): Promise<Evidence> {
  const res = await api().post(`/guilds/${guildId}/moderation/evidence`, {
    action: 'confirm',
    evidenceId,
    contentHash,
  });
  return res.data;
}

export async function addUrlEvidence(
  guildId: string,
  params: {
    caseNumber: number;
    url: string;
    type?: 'URL' | 'DISCORD_URL';
    description?: string;
    tags?: string[];
  }
): Promise<Evidence> {
  const res = await api().post(`/guilds/${guildId}/moderation/evidence`, {
    action: 'url',
    ...params,
  });
  return res.data;
}

// ─── OG Preview ───

export async function previewOG(
  guildId: string,
  url: string
): Promise<{ title?: string; description?: string; image?: string; siteName?: string } | null> {
  try {
    const res = await api().post(`/guilds/${guildId}/moderation/evidence`, {
      action: 'preview-og',
      url,
    });
    return res.data.og ?? null;
  } catch {
    return null;
  }
}

// ─── Amendments ───

export async function amendEvidence(
  guildId: string,
  evidenceId: string,
  params: {
    action: string;
    newValue?: string;
    reason?: string;
  }
): Promise<EvidenceAmendment> {
  const res = await api().post(`/guilds/${guildId}/moderation/evidence/${evidenceId}`, params);
  return res.data;
}

// ─── Case Notes ───

export async function getCaseNotes(
  guildId: string,
  caseNumber: number,
  params?: { page?: number; limit?: number }
): Promise<{ notes: CaseNote[]; total: number }> {
  const res = await api().get(`/guilds/${guildId}/moderation/cases/${caseNumber}/notes`, {
    params,
  });
  return res.data;
}

export async function addCaseNote(
  guildId: string,
  caseNumber: number,
  content: string
): Promise<CaseNote> {
  const res = await api().post(`/guilds/${guildId}/moderation/cases/${caseNumber}/notes`, {
    content,
  });
  return res.data;
}

// ─── Export ───

export async function exportCase(
  guildId: string,
  caseNumber: number
): Promise<{ downloadUrl: string }> {
  const res = await api().post(`/guilds/${guildId}/moderation/cases/${caseNumber}/export`);
  return res.data;
}

// ─── Client-Side SHA-256 ───

export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── NH-5: Evidence Search ───

export async function searchEvidence(
  guildId: string,
  search: string,
  params?: { page?: number; limit?: number }
): Promise<{ evidence: Evidence[]; total: number; page: number; totalPages: number }> {
  const res = await api().get(`/guilds/${guildId}/moderation/evidence`, {
    params: { search, ...params },
  });
  return res.data;
}

// ─── NH-6: User Profile ───

export async function getUserProfile(
  guildId: string,
  userId: string
): Promise<UserModProfile | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/moderation/users/${userId}`, {
      params: { full: 'true' },
    });
    return res.data;
  } catch (err) {
    console.error('[mod.service] getUserProfile failed:', err);
    return null;
  }
}

export interface ModeratedUser {
  userId: string;
  targetTag: string;
  totalCases: number;
  activeFlagsCount: number;
  notesCount: number;
  firstCaseDate: string | null;
  lastCaseDate: string | null;
  caseBreakdown: Record<string, number>;
  // Cache-only status for list view performance
  serverStatus: 'in_server' | 'unknown';
  // Avatar URL from Discord cache (null if user not in bot's cache)
  avatarUrl: string | null;
}

export interface ModeratedUsersResponse {
  users: ModeratedUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalCases: number;
    uniqueUsers: number;
    activeFlags: number;
  };
}

export async function getModeratedUsers(
  guildId: string,
  params?: { page?: number; limit?: number; search?: string; sort?: string }
): Promise<ModeratedUsersResponse> {
  const res = await api().get(`/guilds/${guildId}/moderation/users`, { params });
  return res.data;
}

// ─── NH-9: Access Log ───

export async function getEvidenceAccessLog(
  guildId: string,
  evidenceId: string,
  params?: { page?: number; limit?: number }
): Promise<{ logs: EvidenceAccessLogEntry[]; total: number; page: number; totalPages: number }> {
  const res = await api().get(`/guilds/${guildId}/moderation/evidence/${evidenceId}`, {
    params: { action: 'access-log', ...params },
  });
  return res.data;
}

// ─── NH-8: Watermarked Download ───

export async function getWatermarkedDownloadUrl(
  guildId: string,
  evidenceId: string
): Promise<{ url: string; watermarked: boolean } | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/moderation/evidence/${evidenceId}`, {
      params: { action: 'watermarked-download' },
    });
    return res.data;
  } catch {
    return null;
  }
}

// ─── NH-11: Analytics ───

export async function getEvidenceAnalytics(
  guildId: string,
  period: '7d' | '30d' | '90d' = '30d'
): Promise<EvidenceAnalytics | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/moderation/analytics`, {
      params: { period },
    });
    return res.data;
  } catch {
    return null;
  }
}

export async function getCaseAnalytics(
  guildId: string,
  period: '7d' | '30d' | '90d' = '30d'
): Promise<CaseAnalytics | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/moderation/analytics`, {
      params: { period, type: 'cases' },
    });
    return res.data;
  } catch {
    return null;
  }
}

// ─── NH-4: Video Timestamps ───

export async function addVideoTimestamp(
  guildId: string,
  evidenceId: string,
  time: number,
  note: string
): Promise<Evidence | null> {
  try {
    const res = await api().post(`/guilds/${guildId}/moderation/evidence/${evidenceId}`, {
      action: 'add-timestamp',
      time,
      note,
    });
    return res.data;
  } catch {
    return null;
  }
}

export async function removeVideoTimestamp(
  guildId: string,
  evidenceId: string,
  timestampId: string
): Promise<Evidence | null> {
  try {
    const res = await api().post(`/guilds/${guildId}/moderation/evidence/${evidenceId}`, {
      action: 'remove-timestamp',
      timestampId,
    });
    return res.data;
  } catch {
    return null;
  }
}

// ─── XP Stats ───

export type { UserXPStats } from '@/lib/mod-types';
import type { UserXPStats } from '@/lib/mod-types';

export async function getUserXPStats(
  guildId: string,
  userId: string
): Promise<UserXPStats | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/xp/users/${userId}`);
    return res.data.stats ?? null;
  } catch {
    return null;
  }
}

export type { UserVoiceXPStats } from '@/lib/mod-types';
import type { UserVoiceXPStats } from '@/lib/mod-types';

export async function getUserVoiceXPStats(
  guildId: string,
  userId: string
): Promise<UserVoiceXPStats | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/voice-xp/users/${userId}`);
    return res.data ?? null;
  } catch {
    return null;
  }
}

// ─── Rewards ───

export type { UserRewardClaim } from '@/lib/mod-types';
import type { UserRewardClaim } from '@/lib/mod-types';

export async function getUserRewards(
  guildId: string,
  userId: string
): Promise<UserRewardClaim[]> {
  try {
    const res = await api().get(`/guilds/${guildId}/rewards/users/${userId}`);
    return res.data.claims ?? [];
  } catch {
    return [];
  }
}

// ─── Server Status ───

export type { UserServerStatus } from '@/lib/mod-types';
import type { UserServerStatus } from '@/lib/mod-types';

export async function getUserServerStatus(
  guildId: string,
  userId: string
): Promise<UserServerStatus | null> {
  try {
    const res = await api().get(`/guilds/${guildId}/moderation/users/${userId}`, {
      params: { action: 'server-status' },
    });
    return res.data;
  } catch (err) {
    console.error('[mod.service] getUserServerStatus failed:', err);
    return null;
  }
}
