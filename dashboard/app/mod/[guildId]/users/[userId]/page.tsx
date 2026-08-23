'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  getUserProfile,
  getUserXPStats,
  getUserVoiceXPStats,
  getUserRewards,
  getUserServerStatus,
  type UserXPStats,
  type UserVoiceXPStats,
  type UserRewardClaim,
  type UserServerStatus,
} from '@/lib/services/mod.service';
import { EVIDENCE_TYPE_META } from '@/lib/mod-types';
import {
  IconGavel,
  IconFolder,
  IconNote,
  IconFlag,
  IconUser,
  IconCalendar,
  IconLogout,
  IconCheck,
  IconHistory,
  IconMessage,
  IconMicrophone,
  IconTrophy,
  IconChartBar,
} from '@/lib/mod-icons';

// Border colors for recent cases (left quote-style border)
const ACTION_BORDER_COLORS: Record<string, string> = {
  BAN: 'border-l-red-400/60',
  UNBAN: 'border-l-emerald-400/60',
  KICK: 'border-l-rose-400/60',
  TIMEOUT: 'border-l-slate-400/60',
  WARN: 'border-l-amber-400/60',
  TEMPBAN: 'border-l-red-400/60',
  SOFTBAN: 'border-l-rose-400/60',
  MUTE_TEXT: 'border-l-violet-400/60',
  MUTE_VOICE: 'border-l-violet-400/60',
  MUTE_BOTH: 'border-l-violet-400/60',
};

// Severity tiers for grouping actions in the moderation summary
const ACTION_SEVERITY: Record<string, 'major' | 'moderate' | 'minor'> = {
  BAN: 'major',
  TEMPBAN: 'major',
  SOFTBAN: 'major',
  KICK: 'moderate',
  TIMEOUT: 'moderate',
  WARN: 'minor',
  MUTE_TEXT: 'minor',
  MUTE_VOICE: 'minor',
  MUTE_BOTH: 'minor',
};

export default function UserProfilePage() {
  const { guildId, userId } = useParams() as { guildId: string; userId: string };

  const { data: profile, isLoading: profileLoading } = useSWR(
    ['user-profile', guildId, userId],
    () => getUserProfile(guildId, userId)
  );

  const { data: xpStats } = useSWR(
    ['user-xp', guildId, userId],
    () => getUserXPStats(guildId, userId)
  );

  const { data: voiceXPStats } = useSWR(
    ['user-voice-xp', guildId, userId],
    () => getUserVoiceXPStats(guildId, userId)
  );

  const { data: rewards } = useSWR(
    ['user-rewards', guildId, userId],
    () => getUserRewards(guildId, userId)
  );

  const { data: serverStatus } = useSWR(
    ['user-server-status', guildId, userId],
    () => getUserServerStatus(guildId, userId),
    { revalidateOnMount: true, dedupingInterval: 0 }
  );

  if (profileLoading) {
    return (
      <div className="py-12 text-center text-[var(--mod-text-dim)]">
        Loading user profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-12 text-center text-red-400">
        Failed to load user profile.
      </div>
    );
  }

  const activeFlags = profile.flags.filter((f) => f.active);

  // Compute moderation summary
  const modSummary = getModerationSummary(profile.cases.byAction);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          {(serverStatus?.avatarUrl || profile.avatarUrl) ? (
            <img
              src={serverStatus?.avatarUrl ?? profile.avatarUrl!}
              alt=""
              className="h-16 w-16 border border-[var(--mod-border)] bg-[var(--mod-surface)]"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center border border-[var(--mod-border)] bg-[var(--mod-surface)]">
              <IconUser size={32} className="text-[var(--mod-text-dim)]" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--mono-white)]">
                {serverStatus?.username || profile.username || profile.targetTag || 'User Profile'}
              </h1>
              <ServerStatusBadge status={serverStatus} />
            </div>
            <p className="font-mono text-sm text-[var(--mod-text-dim)]">{userId}</p>
            {serverStatus?.roles && serverStatus.roles.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {serverStatus.roles.slice(0, 5).map((role) => (
                  <span
                    key={role}
                    className="border border-[var(--mod-border)] px-1.5 py-0.5 text-[10px] text-[var(--mod-text-dim)]"
                  >
                    {role}
                  </span>
                ))}
                {serverStatus.roles.length > 5 && (
                  <span className="text-[10px] text-[var(--mod-text-dim)]">
                    +{serverStatus.roles.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Moderation Summary */}
          <ModerationSummaryBadge summary={modSummary} totalCases={profile.cases.total} />
          {/* Active Flags */}
          {activeFlags.length > 0 && (
            <div className="flex gap-2">
              {activeFlags.map((flag) => (
                <span
                  key={flag.id}
                  className="flex items-center gap-1 border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-400"
                >
                  <IconFlag size={12} />
                  {flag.flag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div className="mb-6 flex flex-wrap gap-4 text-xs text-[var(--mod-text-dim)]">
        {profile.firstSeen && (
          <div className="flex items-center gap-1">
            <IconCalendar size={12} />
            First seen: {new Date(profile.firstSeen).toLocaleDateString()}
          </div>
        )}
        {profile.lastAction && (
          <div className="flex items-center gap-1">
            <IconGavel size={12} />
            Last action: {new Date(profile.lastAction).toLocaleDateString()}
          </div>
        )}
        {serverStatus?.memberSince && (
          <div className="flex items-center gap-1">
            <IconUser size={12} />
            Member since: {new Date(serverStatus.memberSince).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cases + Evidence (Combined with breakdown graph) - stacked on mobile, 60/40 on desktop */}
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4 lg:col-span-2">
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Cases breakdown graph - 60% on desktop */}
            <div className="lg:w-3/5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--mono-white)]">
                  <IconChartBar size={16} />
                  Action Breakdown ({profile.cases.total} total)
                </h2>
                <Link
                  href={`/mod/${guildId}/cases?targetId=${userId}`}
                  className="text-xs text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
                >
                  View all cases →
                </Link>
              </div>
              <CaseBreakdownChart byAction={profile.cases.byAction} total={profile.cases.total} />
            </div>

            {/* Evidence summary - 40% on desktop, below on mobile */}
            <div className="border-t border-[var(--mod-border)] pt-4 lg:w-2/5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--mono-white)]">
                <IconFolder size={16} />
                Evidence ({profile.evidence.total})
              </h3>
              {profile.evidence.total > 0 ? (
                <div className="space-y-2">
                  {Object.entries(profile.evidence.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--mod-text-muted)]">
                        {EVIDENCE_TYPE_META[type as keyof typeof EVIDENCE_TYPE_META]?.label ?? type}
                      </span>
                      <span className="text-[var(--mono-white)]">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--mod-text-dim)]">No evidence</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Cases */}
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--mono-white)]">
              <IconGavel size={16} />
              Recent Cases
            </h2>
            <Link
              href={`/mod/${guildId}/cases?targetId=${userId}`}
              className="text-xs text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {profile.cases.recent.slice(0, 5).map((c) => {
              const borderColor = ACTION_BORDER_COLORS[c.action] ?? 'border-l-[var(--mod-border)]';
              return (
                <Link
                  key={c.id}
                  href={`/mod/${guildId}/cases/${c.caseNumber}`}
                  className={`block border-l-2 ${borderColor} py-1 pl-3 text-xs transition-opacity hover:opacity-80`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--mono-white)]">
                      #{c.caseNumber} {c.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[var(--mod-text-dim)]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {c.reason && (
                    <p className="mt-0.5 truncate text-[var(--mod-text-dim)]">{c.reason}</p>
                  )}
                </Link>
              );
            })}
            {profile.cases.recent.length === 0 && (
              <p className="text-xs text-[var(--mod-text-dim)]">No cases found.</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--mono-white)]">
            <IconNote size={16} />
            Mod Notes ({profile.notes.total})
          </h2>

          {profile.notes.recent.length > 0 ? (
            <div className="space-y-3">
              {profile.notes.recent.map((note) => (
                <div key={note.id} className="border-l-2 border-[var(--mod-border)] pl-3">
                  <p className="text-xs text-[var(--mod-text-muted)]">{note.note}</p>
                  <div className="mt-1 flex gap-2 text-[10px] text-[var(--mod-text-dim)]">
                    <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                    {note.tags.length > 0 && (
                      <span className="text-[var(--mono-400)]">{note.tags.join(', ')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--mod-text-dim)]">No notes for this user.</p>
          )}
        </div>

        {/* XP Stats - at bottom with placeholder if no data */}
        <XPStatsCard xpStats={xpStats} voiceXPStats={voiceXPStats} />

        {/* Rewards - at bottom with placeholder if no data */}
        <RewardsCard rewards={rewards ?? []} />

        {/* Flags (if any exist) */}
        {profile.flags.length > 0 && (
          <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--mono-white)]">
              <IconFlag size={16} />
              Flags ({profile.flags.length})
            </h2>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {profile.flags.map((flag) => (
                <div
                  key={flag.id}
                  className={`flex items-center justify-between border-l-2 py-2 pl-3 text-xs ${
                    flag.active ? 'border-red-400/50' : 'border-[var(--mod-border)]'
                  }`}
                >
                  <div>
                    <span className={flag.active ? 'text-red-300/80' : 'text-[var(--mod-text-dim)]'}>
                      {flag.flag}
                    </span>
                    {flag.reason && (
                      <p className="mt-0.5 text-[var(--mod-text-dim)]">{flag.reason}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={flag.active ? 'text-red-300/80' : 'text-green-300/80'}>
                      {flag.active ? 'Active' : 'Inactive'}
                    </span>
                    {flag.expiresAt && (
                      <p className="text-[10px] text-[var(--mod-text-dim)]">
                        Expires: {new Date(flag.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Compute a factual moderation summary (no scoring/profiling)
function getModerationSummary(byAction: Partial<Record<string, number>>): { major: number; moderate: number; minor: number } {
  const summary = { major: 0, moderate: 0, minor: 0 };

  for (const [action, count] of Object.entries(byAction)) {
    if (count === undefined) continue;
    const tier = ACTION_SEVERITY[action];
    if (tier) summary[tier] += count;
  }

  return summary;
}

function ModerationSummaryBadge({
  summary,
  totalCases,
}: {
  summary: { major: number; moderate: number; minor: number };
  totalCases: number;
}) {
  if (totalCases === 0) return null;

  const parts: string[] = [];
  if (summary.major > 0) parts.push(`${summary.major} major`);
  if (summary.moderate > 0) parts.push(`${summary.moderate} moderate`);
  if (summary.minor > 0) parts.push(`${summary.minor} minor`);

  return (
    <div className="flex items-center gap-1.5 border border-[var(--mono-600)] px-2 py-1 text-[var(--mod-text-dim)]">
      <IconGavel size={12} />
      <span className="text-xs">{parts.join(', ')}</span>
    </div>
  );
}

function ServerStatusBadge({ status }: { status: UserServerStatus | null | undefined }) {
  if (!status) return null;

  switch (status.status) {
    case 'left':
      return (
        <span className="flex items-center gap-1 border border-[var(--mono-600)] px-2 py-0.5 text-[10px] text-[var(--mod-text-dim)]">
          <IconLogout size={12} />
          Left Server
        </span>
      );
    case 'in_server':
      return (
        <span className="flex items-center gap-1 border border-green-500/40 px-2 py-0.5 text-[10px] text-green-300/70">
          <IconCheck size={12} />
          In Server
        </span>
      );
    default:
      return null;
  }
}

function XPStatsCard({
  xpStats,
  voiceXPStats,
  isLoading,
}: {
  xpStats: UserXPStats | null | undefined;
  voiceXPStats: UserVoiceXPStats | null | undefined;
  isLoading?: boolean;
}) {
  const hasData = xpStats || voiceXPStats;

  return (
    <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--mono-white)]">
        <IconHistory size={16} />
        XP & Activity
      </h2>

      {!hasData ? (
        <div className="py-4 text-center">
          <p className="text-xs text-[var(--mod-text-dim)]">
            {isLoading ? 'Loading XP data...' : 'No XP data available for this user.'}
          </p>
          <p className="mt-1 text-[10px] text-[var(--mod-text-dim)] opacity-60">
            XP will appear here once the user participates in the server.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Text XP */}
          {xpStats ? (
            <div>
              <div className="mb-2 flex items-center gap-1 text-xs text-[var(--mod-text-dim)]">
                <IconMessage size={12} />
                Text XP
              </div>
              <div className="mb-1 text-lg font-bold text-[var(--mono-white)]">
                Level {xpStats.level}
              </div>
              <div className="mb-2 text-xs text-[var(--mod-text-dim)]">
                {xpStats.xp.toLocaleString()} XP • Rank #{xpStats.rank ?? '—'}
              </div>
              <div className="h-1.5 w-full rounded-sm bg-zinc-800">
                <div
                  className="h-full rounded-sm bg-zinc-500 transition-all"
                  style={{ width: `${Math.round(xpStats.progress * 100)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-[var(--mod-text-dim)]">
                {xpStats.xpIntoLevel.toLocaleString()} / {xpStats.nextLevelXp.toLocaleString()} to next level
              </div>
              <div className="mt-2 text-xs text-[var(--mod-text-muted)]">
                {xpStats.messageCount.toLocaleString()} messages
              </div>
            </div>
          ) : (
            <div className="opacity-40">
              <div className="mb-2 flex items-center gap-1 text-xs text-[var(--mod-text-dim)]">
                <IconMessage size={12} />
                Text XP
              </div>
              <p className="text-xs text-[var(--mod-text-dim)]">No data</p>
            </div>
          )}

          {/* Voice XP */}
          {voiceXPStats ? (
            <div>
              <div className="mb-2 flex items-center gap-1 text-xs text-[var(--mod-text-dim)]">
                <IconMicrophone size={12} />
                Voice XP
              </div>
              <div className="mb-1 text-lg font-bold text-[var(--mono-white)]">
                Level {voiceXPStats.level}
              </div>
              <div className="mb-2 text-xs text-[var(--mod-text-dim)]">
                {voiceXPStats.xp.toLocaleString()} XP • Rank #{voiceXPStats.rank ?? '—'}
              </div>
              <div className="mt-2 text-xs text-[var(--mod-text-muted)]">
                {Math.round(voiceXPStats.totalMinutes / 60).toLocaleString()} hours in voice
              </div>
            </div>
          ) : (
            <div className="opacity-40">
              <div className="mb-2 flex items-center gap-1 text-xs text-[var(--mod-text-dim)]">
                <IconMicrophone size={12} />
                Voice XP
              </div>
              <p className="text-xs text-[var(--mod-text-dim)]">No data</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RewardsCard({ rewards }: { rewards: UserRewardClaim[] }) {
  return (
    <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--mono-white)]">
        <IconTrophy size={16} />
        Rewards ({rewards.length})
      </h2>

      {rewards.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs text-[var(--mod-text-dim)]">No rewards claimed yet.</p>
          <p className="mt-1 text-[10px] text-[var(--mod-text-dim)] opacity-60">
            Rewards will appear here as the user levels up.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rewards.slice(0, 5).map((claim) => (
            <div
              key={claim.id}
              className="flex items-center justify-between border-l-2 border-[var(--mod-border)] py-1 pl-3 text-xs"
            >
              <div>
                <span className="text-[var(--mono-white)]">{claim.reward.name}</span>
                <span className="ml-2 text-[var(--mod-text-dim)]">
                  at Lvl {claim.levelAtClaim}
                </span>
              </div>
              <span
                className={`text-[10px] ${
                  claim.status === 'CLAIMED' ? 'text-green-300/70' : 'text-[var(--mod-text-dim)]'
                }`}
              >
                {claim.status}
              </span>
            </div>
          ))}
          {rewards.length > 5 && (
            <p className="text-xs text-[var(--mod-text-dim)]">
              +{rewards.length - 5} more rewards
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CaseBreakdownChart({
  byAction,
  total,
}: {
  byAction: Partial<Record<string, number>>;
  total: number;
}) {
  // Group mutes together and prepare entries
  const grouped: Record<string, number> = {};
  let muteTotal = 0;

  for (const [action, count] of Object.entries(byAction)) {
    if (count === undefined) continue;

    if (action.startsWith('MUTE_')) {
      muteTotal += count;
    } else if (action.startsWith('UNMUTE_')) {
      // Skip unmutes from the chart
      continue;
    } else {
      grouped[action] = count;
    }
  }

  if (muteTotal > 0) {
    grouped['MUTES'] = muteTotal;
  }

  const entries = Object.entries(grouped).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return <p className="text-xs text-[var(--mod-text-dim)]">No cases recorded.</p>;
  }

  const maxCount = Math.max(...entries.map(([, count]) => count));

  // Grayscale colors from lighter to darker
  const GRAYSCALE = ['#a1a1aa', '#8b8b94', '#71717a', '#606068', '#52525b'];

  return (
    <div className="space-y-1.5">
      {entries.map(([action, count], index) => (
        <div key={action} className="flex items-center gap-2">
          <span className="w-14 truncate text-[11px] text-[var(--mod-text-dim)]">
            {action.replace(/_/g, ' ')}
          </span>
          <div className="flex-1">
            <div className="h-2 rounded-sm bg-zinc-800">
              <div
                className="h-full rounded-sm transition-all"
                style={{
                  width: `${(count / maxCount) * 100}%`,
                  backgroundColor: GRAYSCALE[Math.min(index, GRAYSCALE.length - 1)],
                }}
              />
            </div>
          </div>
          <span className="w-6 text-right text-[11px] text-[var(--mono-white)]">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}
