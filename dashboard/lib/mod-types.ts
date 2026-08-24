/** Evidence system TypeScript types for the mod dashboard */

export type EvidenceType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'URL' | 'DISCORD_URL' | 'MESSAGE_SNAPSHOT';
export type EvidenceStatus = 'PENDING' | 'PROCESSING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';
export type CaseStatus = 'OPEN' | 'CLOSED' | 'VOID';
export type ModAction = 'BAN' | 'UNBAN' | 'KICK' | 'TIMEOUT' | 'WARN' | 'SOFTBAN' | 'TEMPBAN' | 'MUTE_TEXT' | 'MUTE_VOICE' | 'MUTE_BOTH' | 'UNMUTE_TEXT' | 'UNMUTE_VOICE' | 'UNMUTE_BOTH';

export interface Evidence {
  id: string;
  guildId: string;
  caseId: string;
  caseNumber: number;
  uploadedById: string;
  uploadedByTag: string;
  type: EvidenceType;
  status: EvidenceStatus;
  storageKey: string | null;
  storageBucket: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  hmacSignature: string | null;
  url: string | null;
  snapshotId: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  snapshot?: MessageSnapshot | null;
  amendments?: EvidenceAmendment[];
}

export interface EvidenceAmendment {
  id: string;
  evidenceId: string;
  amendedById: string;
  amendedByTag: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

export interface MessageSnapshot {
  id: string;
  guildId: string;
  channelId: string;
  capturedById: string;
  capturedByTag: string;
  firstMessageId: string;
  lastMessageId: string | null;
  messageCount: number;
  snapshotData: MessageSnapshotEntry[];
  mediaStorageKeys: string[] | null;
  contentHash: string;
  hmacSignature: string;
  createdAt: string;
}

export interface MessageSnapshotEntry {
  messageId: string;
  authorId: string;
  authorTag: string;
  authorAvatarUrl: string;
  content: string;
  embeds: unknown[];
  attachments: SerializedAttachment[];
  stickers: SerializedSticker[];
  reactions: SerializedReaction[];
  messageUrl: string;
  createdAt: string;
  editedAt: string | null;
}

export interface SerializedAttachment {
  url: string;
  proxyUrl?: string;
  filename: string;
  size: number;
  contentType: string | null;
  storageKey?: string;
}

export interface SerializedSticker {
  id: string;
  name: string;
  format: string;
  url: string;
}

export interface SerializedReaction {
  emoji: string;
  count: number;
}

export interface ModCase {
  id: string;
  caseNumber: number;
  guildId: string;
  action: ModAction;
  targetId: string;
  targetTag: string;
  moderatorId: string;
  moderatorTag: string;
  reason: string | null;
  duration: number | null;
  status: CaseStatus;
  evidence: unknown;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  // NH-10: Case Assignment
  assignedToId: string | null;
  assignedToTag: string | null;
  assignedAt: string | null;
}

export interface EvidenceSummary {
  total: number;
  byType: Partial<Record<EvidenceType, number>>;
  byStatus: Partial<Record<EvidenceStatus, number>>;
  totalSizeBytes: number;
  latestAt: string | null;
  hasWeakEvidenceOnly: boolean;
}

export interface DashboardPermissions {
  userId: string;
  guildId: string;
  isAdmin: boolean;
  isOwner: boolean;
  canConfigure: boolean;
  hasAccess: boolean;
  sections: {
    cases: boolean;
    evidence: boolean;
    evidenceAdd: boolean;
    evidenceCapture: boolean;
  };
  permissions: Record<string, { allowed: boolean; reason?: string }>;
}

export interface PresignedUpload {
  evidenceId: string;
  uploadUrl: string;
  uploadFields: Record<string, string>;
}

export const PREDEFINED_TAGS = [
  'harassment', 'spam', 'nsfw', 'raid', 'threats',
  'impersonation', 'scam', 'hate-speech', 'doxxing', 'other',
] as const;

export interface CaseNote {
  id: string;
  caseId: string;
  guildId: string;
  authorId: string;
  authorTag: string;
  content: string;
  createdAt: string;
}

/** Evidence type display metadata */
export const EVIDENCE_TYPE_META: Record<EvidenceType, { label: string; icon: string; className: string }> = {
  IMAGE: { label: 'Image', icon: 'photo', className: 'type-image' },
  VIDEO: { label: 'Video', icon: 'video', className: 'type-video' },
  AUDIO: { label: 'Audio', icon: 'volume', className: 'type-audio' },
  DOCUMENT: { label: 'Document', icon: 'file', className: 'type-document' },
  URL: { label: 'URL', icon: 'link', className: 'type-url' },
  DISCORD_URL: { label: 'Discord Link', icon: 'brand-discord', className: 'type-url' },
  MESSAGE_SNAPSHOT: { label: 'Snapshot', icon: 'camera', className: 'type-snapshot' },
};

/** Evidence status display metadata */
export const EVIDENCE_STATUS_META: Record<EvidenceStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'badge-pending' },
  PROCESSING: { label: 'Processing', className: 'badge-processing' },
  VERIFIED: { label: 'Verified', className: 'badge-verified' },
  FLAGGED: { label: 'Flagged', className: 'badge-flagged' },
  REJECTED: { label: 'Rejected', className: 'badge-rejected' },
};

// ─── NH-6: User Profile Types ───

export interface UserModProfile {
  userId: string;
  guildId: string;
  targetTag: string | null;
  cases: {
    total: number;
    byAction: Partial<Record<ModAction, number>>;
    byStatus: Partial<Record<CaseStatus, number>>;
    recent: Array<{
      id: string;
      caseNumber: number;
      action: ModAction;
      reason: string | null;
      moderatorTag: string;
      status: CaseStatus;
      createdAt: string;
    }>;
  };
  evidence: {
    total: number;
    byType: Partial<Record<EvidenceType, number>>;
  };
  notes: {
    total: number;
    recent: Array<{
      id: string;
      note: string;
      createdById: string;
      tags: string[];
      createdAt: string;
    }>;
  };
  flags: Array<{
    id: string;
    flag: string;
    reason: string | null;
    createdAt: string;
    expiresAt: string | null;
    active: boolean;
  }>;
  firstSeen: string | null;
  lastAction: string | null;
  avatarUrl: string | null;
  username: string | null;
}

// ─── NH-9: Access Log Types ───

export type AccessAction = 'VIEW' | 'DOWNLOAD' | 'EXPORT';

export interface EvidenceAccessLogEntry {
  id: string;
  evidenceId: string;
  guildId: string;
  userId: string;
  userTag: string;
  action: AccessAction;
  ipHash: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── NH-11: Analytics Types ───

export interface EvidenceAnalytics {
  volumeOverTime: Array<{ date: string; count: number }>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  storageUsage: { totalBytes: number; count: number };
  topUploaders: Array<{ userId: string; userTag: string; count: number }>;
  flaggedRate: number;
  period: string;
  cachedAt: number;
}

export interface CaseAnalytics {
  volumeOverTime: Array<{ date: string; count: number }>;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  assignmentRate: number;
}

// ─── NH-4: Video Timestamp Types ───

export interface VideoTimestamp {
  id: string;
  time: number; // seconds
  note: string;
  addedBy: string;
  addedByTag: string;
  createdAt: string;
}

// ─── XP Stats Types ───

export interface UserXPStats {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  nextLevelXp: number;
  currentLevelXp: number;
  progress: number;
  xpIntoLevel: number;
  messageCount: number;
  lastAwardAt: string | null;
  rank: number | null;
}

export interface UserVoiceXPStats {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  totalMinutes: number;
  rank: number | null;
}

// ─── Rewards Types ───

export interface UserRewardClaim {
  id: string;
  rewardId: string;
  levelAtClaim: number;
  xpAtClaim: number;
  status: string;
  claimedAt: string;
  expiresAt: string | null;
  reward: {
    id: string;
    name: string;
    description: string | null;
    type: string;
  };
}

// ─── Server Status Types ───

export type ServerStatusType = 'in_server' | 'left' | 'unknown';

export interface UserServerStatus {
  status: ServerStatusType;
  isInServer: boolean;
  memberSince: string | null;
  roles: string[];
  avatarUrl: string | null;
  username: string | null;
}
