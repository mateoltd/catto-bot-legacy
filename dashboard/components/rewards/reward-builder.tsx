'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Gift, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

type TargetErrorKey =
  | 'chooseRoleError'
  | 'chooseReplacementError'
  | 'choosePermissionError'
  | 'chooseChannelError'
  | 'writeAnnouncementError';

function targetError(value: RewardFormState): TargetErrorKey | null {
  if (ROLE_TYPES.includes(value.rewardType) && !value.roleId) return 'chooseRoleError';
  if (value.rewardType === 'ROLE_REPLACE' && value.removeRoleIds.length === 0) {
    return 'chooseReplacementError';
  }
  if (value.rewardType === 'PERMISSION_GRANT' && value.permissions.length === 0) {
    return 'choosePermissionError';
  }
  if (value.rewardType === 'CHANNEL_ACCESS' && value.channelIds.length === 0) {
    return 'chooseChannelError';
  }
  if (value.rewardType === 'ANNOUNCEMENT' && !value.message.trim()) {
    return 'writeAnnouncementError';
  }
  return null;
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
  const t = useTranslations('Rewards');
  const rewardTypes: { value: RewardType; label: string; description: string }[] = [
    { value: 'ROLE_ADD', label: t('typeRoleAdd'), description: t('typeRoleAddShort') },
    { value: 'ROLE_REMOVE', label: t('typeRoleRemove'), description: t('typeRoleRemoveShort') },
    { value: 'ROLE_STACK', label: t('typeRoleStack'), description: t('typeRoleStackShort') },
    { value: 'ROLE_REPLACE', label: t('typeRoleReplace'), description: t('typeRoleReplaceShort') },
    { value: 'PERMISSION_GRANT', label: t('typePermissions'), description: t('typePermissionsShort') },
    { value: 'CHANNEL_ACCESS', label: t('typeChannelAccess'), description: t('typeChannelAccessShort') },
    { value: 'ANNOUNCEMENT', label: t('typeAnnouncement'), description: t('typeAnnouncementShort') },
  ];
  const permissions = [
    { value: 'VIEW_CHANNEL', label: t('permissionViewChannels') },
    { value: 'SEND_MESSAGES', label: t('permissionSendMessages') },
    { value: 'EMBED_LINKS', label: t('permissionEmbedLinks') },
    { value: 'ATTACH_FILES', label: t('permissionAttachFiles') },
    { value: 'ADD_REACTIONS', label: t('permissionAddReactions') },
    { value: 'USE_EXTERNAL_EMOJIS', label: t('permissionExternalEmojis') },
    { value: 'READ_MESSAGE_HISTORY', label: t('permissionHistory') },
    { value: 'CONNECT', label: t('permissionConnect') },
    { value: 'SPEAK', label: t('permissionSpeak') },
    { value: 'STREAM', label: t('permissionStream') },
    { value: 'PRIORITY_SPEAKER', label: t('permissionPrioritySpeaker') },
    { value: 'CREATE_INSTANT_INVITE', label: t('permissionInvites') },
    { value: 'CHANGE_NICKNAME', label: t('permissionNickname') },
  ];
  const xpTypes = [
    { value: 'TEXT', label: t('xpTextBuilder'), description: t('xpTextDescription') },
    { value: 'VOICE', label: t('xpVoiceBuilder'), description: t('xpVoiceDescription') },
    { value: 'BOTH', label: t('xpEither'), description: t('xpEitherDescription') },
  ] as const;
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const errorKey = targetError(value);
  const error = errorKey ? t(errorKey) : null;
  const selectedType = rewardTypes.find((item) => item.value === value.rewardType);
  const selectedRole = roles.find((role) => role.id === value.roleId);
  const targetSummary = (() => {
    if (selectedRole) return selectedRole.name;
    if (value.rewardType === 'PERMISSION_GRANT') return t('permissionCount', { count: value.permissions.length });
    if (value.rewardType === 'CHANNEL_ACCESS') return t('channelCount', { count: value.channelIds.length });
    if (value.rewardType === 'ANNOUNCEMENT') return t('customMessage');
    return t('notConfigured');
  })();
  const suggestedName = () => {
    const role = roles.find((item) => item.id === value.roleId)?.name;
    if (role) return t('suggestedRoleName', { role, level: value.level });
    return t('suggestedName', { level: value.level, type: selectedType?.label ?? t('reward') });
  };

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
    if (!value.name.trim()) update({ name: suggestedName() });
    setShowErrors(false);
    setStep(2);
  };

  return (
    <section className="border border-border bg-card" aria-label={t('newRewardBuilder')}>
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4" aria-hidden="true" />
            <h3 className="font-mono text-base font-semibold text-foreground">{t('buildReward')}</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('buildRewardDescription')}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label={t('closeBuilder')}>
          <X />
        </Button>
      </header>

      <nav className="grid grid-cols-3 border-b border-border" aria-label={t('builderSteps')}>
        {[t('stepTrigger'), t('stepReward'), t('stepDetails')].map((label, index) => (
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
              <p className="font-mono text-sm font-medium text-foreground">{t('unlockQuestion')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('unlockHelp')}</p>
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
                  {t('levelUpper')}
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={value.level}
                    onChange={(event) => update({ level: Math.min(1000, Math.max(1, Number(event.target.value) || 1)) })}
                    className="h-8 border-0 bg-transparent px-1 text-right font-mono text-foreground focus-visible:ring-0"
                    aria-label={t('exactRewardLevel')}
                  />
                </label>
              </div>
            </div>
            <div>
              <p className="mb-3 font-mono text-sm font-medium text-foreground">{t('progressionQuestion')}</p>
              <OptionSelector value={value.xpType} options={xpTypes} onValueChange={(xpType) => update({ xpType })} columns={3} ariaLabel={t('xpType')} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="mb-3 font-mono text-sm font-medium text-foreground">{t('rewardQuestion')}</p>
              <OptionSelector value={value.rewardType} options={rewardTypes} onValueChange={setRewardType} columns={3} ariaLabel={t('rewardType')} />
            </div>

            {ROLE_TYPES.includes(value.rewardType) && (
              <div>
                <p className="mb-3 font-mono text-sm font-medium text-foreground">
                  {value.rewardType === 'ROLE_REMOVE' ? t('roleToRemove') : t('roleToAward')}
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
                  emptyLabel={loadingRoles ? t('loadingRoles') : t('noRoles')}
                  searchPlaceholder={t('findRole')}
                />
              </div>
            )}

            {value.rewardType === 'ROLE_REPLACE' && (
              <div>
                <p className="mb-3 font-mono text-sm font-medium text-foreground">{t('rolesReplaced')}</p>
                <MultiSelectList items={roles.filter((role) => role.id !== value.roleId).map((role) => ({ value: role.id, label: role.name }))} value={value.removeRoleIds} onValueChange={(removeRoleIds) => update({ removeRoleIds })} searchPlaceholder={t('findOldRoles')} />
              </div>
            )}

            {value.rewardType === 'PERMISSION_GRANT' && (
              <div>
                <p className="mb-3 font-mono text-sm font-medium text-foreground">{t('permissionsToGrant')}</p>
                <MultiSelectList items={permissions} value={value.permissions} onValueChange={(permissions) => update({ permissions })} searchPlaceholder={t('findPermission')} />
              </div>
            )}

            {value.rewardType === 'CHANNEL_ACCESS' && (
              <div>
                <p className="mb-3 font-mono text-sm font-medium text-foreground">{t('channelsToOpen')}</p>
                <MultiSelectList items={textChannels.map((channel) => ({ value: channel.id, label: channel.name, prefix: '#' }))} value={value.channelIds} onValueChange={(channelIds) => update({ channelIds })} searchPlaceholder={t('findChannel')} />
              </div>
            )}

            {value.rewardType === 'ANNOUNCEMENT' && (
              <div>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <p className="font-mono text-sm font-medium text-foreground">{t('announcementMessage')}</p>
                  <span className="text-xs text-muted-foreground">{'{user} · {level} · {reward}'}</span>
                </div>
                <textarea value={value.message} onChange={(event) => update({ message: event.target.value })} placeholder={t('announcementPlaceholder')} rows={3} className="w-full resize-none border border-border bg-input px-4 py-3 text-sm text-foreground outline-none" />
              </div>
            )}

            {showErrors && error && <p role="alert" className="border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-5">
              <div>
                <label htmlFor="reward-builder-name" className="mb-2 block font-mono text-sm font-medium text-foreground">{t('rewardName')}</label>
                <Input id="reward-builder-name" autoFocus value={value.name} onChange={(event) => update({ name: event.target.value })} placeholder={suggestedName()} aria-invalid={!value.name.trim()} />
                {!value.name.trim() && showErrors && <p role="alert" className="mt-2 text-xs text-destructive">{t('rewardNameError')}</p>}
              </div>
              <div>
                <label htmlFor="reward-builder-description" className="mb-2 block font-mono text-sm font-medium text-foreground">{t('descriptionLabel')} <span className="font-sans font-normal text-muted-foreground">{t('optional')}</span></label>
                <Input id="reward-builder-description" value={value.description} onChange={(event) => update({ description: event.target.value })} placeholder={t('descriptionPlaceholder')} />
              </div>
              <div className="divide-y divide-border border border-border bg-input">
                <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                  <span><span className="block text-sm font-medium text-foreground">{t('oneClaim')}</span><span className="block text-xs text-muted-foreground">{t('oneClaimDescription')}</span></span>
                  <Switch checked={value.oneTime} onCheckedChange={(oneTime) => update({ oneTime })} />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                  <span><span className="block text-sm font-medium text-foreground">{t('keepAlongside')}</span><span className="block text-xs text-muted-foreground">{t('keepAlongsideDescription')}</span></span>
                  <Switch checked={value.stackable} onCheckedChange={(stackable) => update({ stackable })} />
                </label>
              </div>
            </div>

            <aside className="h-fit border border-border bg-input">
              <div className="border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t('readyToCreate')}</div>
              <dl className="divide-y divide-border text-sm">
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">{t('unlocks')}</dt><dd className="font-mono text-foreground">{t('level', { level: value.level })}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">{t('progress')}</dt><dd className="font-mono text-foreground">{xpTypes.find((item) => item.value === value.xpType)?.label}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">{t('reward')}</dt><dd className="text-right text-foreground">{selectedType?.label}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">{t('target')}</dt><dd className="max-w-36 truncate text-right text-foreground">{targetSummary}</dd></div>
              </dl>
            </aside>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
        <Button variant="ghost" onClick={step === 0 ? onCancel : () => { setShowErrors(false); setStep(step - 1); }}>
          {step > 0 && <ArrowLeft />}{step === 0 ? t('cancel') : t('back')}
        </Button>
        {step < 2 ? (
          <Button onClick={() => step === 0 ? setStep(1) : goToDetails()}>
            {t('continue')} <ArrowRight />
          </Button>
        ) : (
          <Button onClick={() => { if (!value.name.trim()) { setShowErrors(true); return; } onSubmit(); }} disabled={saving}>
            {saving ? t('creating') : t('createReward')}
          </Button>
        )}
      </footer>
    </section>
  );
}
