'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Gift, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelectList } from '@/components/ui/multi-select-list';
import { OptionSelector } from '@/components/ui/option-selector';
import { Switch } from '@/components/ui/switch';
import type { Channel, Role } from '@/lib/types';
import type { RewardType, XpType } from '@/lib/services/rewards.service';
import { cn } from '@/lib/utils';

export interface RewardFormState {
  level: number;
  xpType: XpType;
  rewardType: RewardType;
  roleId: string;
  removeRoleIds: string[];
  channelIds: string[];
  permissions: string[];
  message: string;
  name: string;
  description: string;
  stackable: boolean;
  oneTime: boolean;
}

const SUPPORTED_REWARD_TYPES: {
  value: RewardType;
  label: string;
  description: string;
}[] = [
  { value: 'ROLE_ADD', label: 'Add role', description: 'Give one role' },
  { value: 'ROLE_REMOVE', label: 'Remove role', description: 'Take one role away' },
  { value: 'ROLE_STACK', label: 'Stack role', description: 'Keep earlier roles' },
  { value: 'ROLE_REPLACE', label: 'Replace roles', description: 'Swap old roles for one' },
  { value: 'PERMISSION_GRANT', label: 'Permissions', description: 'Grant Discord permissions' },
  { value: 'CHANNEL_ACCESS', label: 'Channel access', description: 'Open selected channels' },
  { value: 'ANNOUNCEMENT', label: 'Announcement', description: 'Post a custom message' },
];

const DISCORD_PERMISSIONS = [
  { value: 'VIEW_CHANNEL', label: 'View Channels' },
  { value: 'SEND_MESSAGES', label: 'Send Messages' },
  { value: 'EMBED_LINKS', label: 'Embed Links' },
  { value: 'ATTACH_FILES', label: 'Attach Files' },
  { value: 'ADD_REACTIONS', label: 'Add Reactions' },
  { value: 'USE_EXTERNAL_EMOJIS', label: 'Use External Emojis' },
  { value: 'READ_MESSAGE_HISTORY', label: 'Read Message History' },
  { value: 'CONNECT', label: 'Connect to Voice' },
  { value: 'SPEAK', label: 'Speak in Voice' },
  { value: 'STREAM', label: 'Video/Stream' },
  { value: 'PRIORITY_SPEAKER', label: 'Priority Speaker' },
  { value: 'CREATE_INSTANT_INVITE', label: 'Create Invites' },
  { value: 'CHANGE_NICKNAME', label: 'Change Nickname' },
];

const XP_TYPES = [
  { value: 'TEXT', label: 'Text', description: 'Message activity' },
  { value: 'VOICE', label: 'Voice', description: 'Time in voice' },
  { value: 'BOTH', label: 'Either', description: 'Text or voice level' },
] as const;

const LEVEL_PRESETS = [5, 10, 25, 50, 100];
const ROLE_TYPES: RewardType[] = ['ROLE_ADD', 'ROLE_REMOVE', 'ROLE_STACK', 'ROLE_REPLACE'];

interface RewardBuilderProps {
  value: RewardFormState;
  onChange: (value: RewardFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  roles: Role[];
  textChannels: Channel[];
  loadingRoles?: boolean;
  saving?: boolean;
}

function targetError(value: RewardFormState): string | null {
  if (ROLE_TYPES.includes(value.rewardType) && !value.roleId) return 'Choose a role to continue.';
  if (value.rewardType === 'ROLE_REPLACE' && value.removeRoleIds.length === 0) {
    return 'Choose at least one role to replace.';
  }
  if (value.rewardType === 'PERMISSION_GRANT' && value.permissions.length === 0) {
    return 'Choose at least one permission.';
  }
  if (value.rewardType === 'CHANNEL_ACCESS' && value.channelIds.length === 0) {
    return 'Choose at least one channel.';
  }
  if (value.rewardType === 'ANNOUNCEMENT' && !value.message.trim()) {
    return 'Write the announcement message.';
  }
  return null;
}

function suggestedName(value: RewardFormState, roles: Role[]) {
  const role = roles.find((item) => item.id === value.roleId)?.name;
  const type = SUPPORTED_REWARD_TYPES.find((item) => item.value === value.rewardType)?.label;
  if (role) return `${role} — Level ${value.level}`;
  return `Level ${value.level} ${type ?? 'reward'}`;
}

export function RewardBuilder({
  value,
  onChange,
  onSubmit,
  onCancel,
  roles,
  textChannels,
  loadingRoles = false,
  saving = false,
}: RewardBuilderProps) {
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const error = targetError(value);
  const selectedType = SUPPORTED_REWARD_TYPES.find((item) => item.value === value.rewardType);
  const selectedRole = roles.find((role) => role.id === value.roleId);
  const targetSummary = useMemo(() => {
    if (selectedRole) return selectedRole.name;
    if (value.rewardType === 'PERMISSION_GRANT') return `${value.permissions.length} permissions`;
    if (value.rewardType === 'CHANNEL_ACCESS') return `${value.channelIds.length} channels`;
    if (value.rewardType === 'ANNOUNCEMENT') return 'Custom message';
    return 'Not configured';
  }, [selectedRole, value.channelIds.length, value.permissions.length, value.rewardType]);

  const update = (patch: Partial<RewardFormState>) => onChange({ ...value, ...patch });
  const setRewardType = (rewardType: RewardType) => {
    update({ rewardType, roleId: '', removeRoleIds: [], channelIds: [], permissions: [], message: '' });
    setShowErrors(false);
  };
  const goToDetails = () => {
    if (error) {
      setShowErrors(true);
      return;
    }
    if (!value.name.trim()) update({ name: suggestedName(value, roles) });
    setShowErrors(false);
    setStep(2);
  };

  return (
    <section className="border border-border bg-card" aria-label="New reward builder">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4" aria-hidden="true" />
            <h3 className="font-mono text-base font-semibold text-foreground">Build a reward</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Three quick choices. You can fine-tune the result before creating it.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close reward builder">
          <X />
        </Button>
      </header>

      <nav className="grid grid-cols-3 border-b border-border" aria-label="Reward builder steps">
        {['Trigger', 'Reward', 'Details'].map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => index < step && setStep(index)}
            disabled={index > step}
            aria-current={step === index ? 'step' : undefined}
            className={cn(
              'flex h-12 items-center justify-center gap-2 border-r border-border font-mono text-xs uppercase tracking-wider last:border-r-0',
              step === index ? 'bg-foreground text-background' : index < step ? 'bg-accent text-foreground' : 'text-muted-foreground'
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center border border-current text-[10px]">
              {index < step ? <Check className="h-3 w-3" /> : `0${index + 1}`}
            </span>
            {label}
          </button>
        ))}
      </nav>

      <div className="p-5">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <p className="font-mono text-sm font-medium text-foreground">When should it unlock?</p>
              <p className="mt-1 text-xs text-muted-foreground">Pick a common milestone or enter an exact level.</p>
              <div className="mt-3 flex flex-wrap gap-px bg-border p-px">
                {LEVEL_PRESETS.map((level) => (
                  <button
                    type="button"
                    key={level}
                    onClick={() => update({ level })}
                    className={cn(
                      'h-10 min-w-14 bg-input px-4 font-mono text-sm transition-colors hover:bg-accent',
                      value.level === level && 'bg-foreground text-background hover:bg-foreground/90'
                    )}
                  >
                    {level}
                  </button>
                ))}
                <label className="flex h-10 min-w-36 flex-1 items-center gap-2 bg-input px-3 text-xs text-muted-foreground">
                  LEVEL
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={value.level}
                    onChange={(event) => update({ level: Math.min(1000, Math.max(1, Number(event.target.value) || 1)) })}
                    className="h-8 border-0 bg-transparent px-1 text-right font-mono text-foreground focus-visible:ring-0"
                    aria-label="Exact reward level"
                  />
                </label>
              </div>
            </div>
            <div>
              <p className="mb-3 font-mono text-sm font-medium text-foreground">Which progression counts?</p>
              <OptionSelector value={value.xpType} options={XP_TYPES} onValueChange={(xpType) => update({ xpType })} columns={3} ariaLabel="XP type" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="mb-3 font-mono text-sm font-medium text-foreground">What do members receive?</p>
              <OptionSelector value={value.rewardType} options={SUPPORTED_REWARD_TYPES} onValueChange={setRewardType} columns={3} ariaLabel="Reward type" />
            </div>

            {ROLE_TYPES.includes(value.rewardType) && (
              <div>
                <p className="mb-3 font-mono text-sm font-medium text-foreground">
                  {value.rewardType === 'ROLE_REMOVE' ? 'Role to remove' : 'Role to award'}
                </p>
                <MultiSelectList
                  items={roles.map((role) => ({
                    value: role.id,
                    label: role.name,
                    swatch: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#888888',
                  }))}
                  value={value.roleId ? [value.roleId] : []}
                  onValueChange={(roleIds) => {
                    const roleId = roleIds.at(-1) ?? '';
                    update({
                      roleId,
                      removeRoleIds: value.removeRoleIds.filter((id) => id !== roleId),
                    });
                  }}
                  emptyLabel={loadingRoles ? 'Loading roles…' : 'No roles available'}
                  searchPlaceholder="Find a role…"
                />
              </div>
            )}

            {value.rewardType === 'ROLE_REPLACE' && (
              <div>
                <p className="mb-3 font-mono text-sm font-medium text-foreground">Roles this replaces</p>
                <MultiSelectList items={roles.filter((role) => role.id !== value.roleId).map((role) => ({ value: role.id, label: role.name }))} value={value.removeRoleIds} onValueChange={(removeRoleIds) => update({ removeRoleIds })} searchPlaceholder="Find old roles…" />
              </div>
            )}

            {value.rewardType === 'PERMISSION_GRANT' && (
              <div>
                <p className="mb-3 font-mono text-sm font-medium text-foreground">Permissions to grant</p>
                <MultiSelectList items={DISCORD_PERMISSIONS} value={value.permissions} onValueChange={(permissions) => update({ permissions })} searchPlaceholder="Find a permission…" />
              </div>
            )}

            {value.rewardType === 'CHANNEL_ACCESS' && (
              <div>
                <p className="mb-3 font-mono text-sm font-medium text-foreground">Channels to open</p>
                <MultiSelectList items={textChannels.map((channel) => ({ value: channel.id, label: channel.name, prefix: '#' }))} value={value.channelIds} onValueChange={(channelIds) => update({ channelIds })} searchPlaceholder="Find a channel…" />
              </div>
            )}

            {value.rewardType === 'ANNOUNCEMENT' && (
              <div>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <p className="font-mono text-sm font-medium text-foreground">Announcement message</p>
                  <span className="text-xs text-muted-foreground">{'{user} · {level} · {reward}'}</span>
                </div>
                <textarea value={value.message} onChange={(event) => update({ message: event.target.value })} placeholder="Congratulations {user}! You reached level {level}." rows={3} className="w-full resize-none border border-border bg-input px-4 py-3 text-sm text-foreground outline-none" />
              </div>
            )}

            {showErrors && error && <p role="alert" className="border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-5">
              <div>
                <label htmlFor="reward-builder-name" className="mb-2 block font-mono text-sm font-medium text-foreground">Reward name</label>
                <Input id="reward-builder-name" autoFocus value={value.name} onChange={(event) => update({ name: event.target.value })} placeholder={suggestedName(value, roles)} aria-invalid={!value.name.trim()} />
                {!value.name.trim() && showErrors && <p role="alert" className="mt-2 text-xs text-destructive">Give this reward a short name.</p>}
              </div>
              <div>
                <label htmlFor="reward-builder-description" className="mb-2 block font-mono text-sm font-medium text-foreground">Description <span className="font-sans font-normal text-muted-foreground">(optional)</span></label>
                <Input id="reward-builder-description" value={value.description} onChange={(event) => update({ description: event.target.value })} placeholder="Why members should want this reward" />
              </div>
              <div className="divide-y divide-border border border-border bg-input">
                <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                  <span><span className="block text-sm font-medium text-foreground">One claim per member</span><span className="block text-xs text-muted-foreground">Prevents this reward from running more than once.</span></span>
                  <Switch checked={value.oneTime} onCheckedChange={(oneTime) => update({ oneTime })} />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                  <span><span className="block text-sm font-medium text-foreground">Keep alongside other rewards</span><span className="block text-xs text-muted-foreground">Marks this reward as stackable.</span></span>
                  <Switch checked={value.stackable} onCheckedChange={(stackable) => update({ stackable })} />
                </label>
              </div>
            </div>

            <aside className="h-fit border border-border bg-input">
              <div className="border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ready to create</div>
              <dl className="divide-y divide-border text-sm">
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">Unlocks</dt><dd className="font-mono text-foreground">Level {value.level}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">Progress</dt><dd className="font-mono text-foreground">{value.xpType}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">Reward</dt><dd className="text-right text-foreground">{selectedType?.label}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">Target</dt><dd className="max-w-36 truncate text-right text-foreground">{targetSummary}</dd></div>
              </dl>
            </aside>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
        <Button variant="ghost" onClick={step === 0 ? onCancel : () => { setShowErrors(false); setStep(step - 1); }}>
          {step > 0 && <ArrowLeft />}{step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < 2 ? (
          <Button onClick={() => step === 0 ? setStep(1) : goToDetails()}>
            Continue <ArrowRight />
          </Button>
        ) : (
          <Button onClick={() => { if (!value.name.trim()) { setShowErrors(true); return; } onSubmit(); }} disabled={saving}>
            {saving ? 'Creating…' : 'Create reward'}
          </Button>
        )}
      </footer>
    </section>
  );
}
