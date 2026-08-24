'use client';

import { useState } from 'react';
import { useRewardsConfig } from '@/hooks/use-rewards-config';
import { useGuildData } from '@/hooks/use-guild-data';
import type {
  CreateReward,
  Reward,
  RewardType,
  XpType,
} from '@/lib/services/rewards.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MultiSelectList } from '@/components/ui/multi-select-list';
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar';
import {
  RewardBuilder,
  type RewardFormState,
} from '@/components/rewards/reward-builder';
import { RewardTemplatePicker } from '@/components/rewards/reward-template-picker';

interface RewardsConfigFormProps {
  guildId: string;
}

const SUPPORTED_REWARD_TYPES: { value: RewardType; label: string; description: string }[] = [
  { value: 'ROLE_ADD', label: 'Add Role', description: 'Give a role when level is reached' },
  { value: 'ROLE_REMOVE', label: 'Remove Role', description: 'Remove a role when level is reached' },
  { value: 'ROLE_STACK', label: 'Stack Role', description: 'Add role while keeping previous roles' },
  { value: 'ROLE_REPLACE', label: 'Replace Role', description: 'Add new role and remove specified old roles' },
  { value: 'PERMISSION_GRANT', label: 'Grant Permissions', description: 'Grant Discord permissions to the user' },
  { value: 'CHANNEL_ACCESS', label: 'Channel Access', description: 'Grant access to specific channels' },
  { value: 'ANNOUNCEMENT', label: 'Announcement', description: 'Send an announcement when reward is claimed' },
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

export default function RewardsConfigForm({ guildId }: RewardsConfigFormProps) {
  const {
    rewards,
    stats,
    templates,
    loading,
    saving,
    error,
    createReward,
    updateReward,
    deleteReward,
    applyTemplate,
  } = useRewardsConfig(guildId);
  const { roles, textChannels, loading: loadingRoles } = useGuildData(guildId);

  const [success, setSuccess] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const defaultFormState: RewardFormState = {
    level: 1,
    xpType: 'TEXT',
    rewardType: 'ROLE_ADD',
    roleId: '',
    removeRoleIds: [],
    channelIds: [],
    permissions: [],
    message: '',
    name: '',
    description: '',
    stackable: false,
    oneTime: true,
  };

  // New reward form state
  const [newReward, setNewReward] = useState<RewardFormState>(defaultFormState);

  // Edit reward form state
  const [editForm, setEditForm] = useState<RewardFormState>(defaultFormState);
  const [initialEditForm, setInitialEditForm] = useState<RewardFormState>(defaultFormState);

  const buildRewardData = (
    form: RewardFormState
  ): import('@/lib/services/rewards.service').RewardData => {
    switch (form.rewardType) {
      case 'ROLE_ADD':
        return { roleId: form.roleId, action: 'ADD' };
      case 'ROLE_REMOVE':
        return { roleId: form.roleId, action: 'REMOVE' };
      case 'ROLE_STACK':
        return { roleId: form.roleId, action: 'STACK' };
      case 'ROLE_REPLACE':
        return { roleId: form.roleId, action: 'REPLACE', removeRoles: form.removeRoleIds };
      case 'PERMISSION_GRANT':
        return { permissions: form.permissions };
      case 'CHANNEL_ACCESS':
        return { channelIds: form.channelIds, action: 'ADD' };
      case 'ANNOUNCEMENT':
        return { message: form.message, mentionUser: true };
      default:
        return { roleId: form.roleId, action: 'ADD' };
    }
  };

  const isFormValid = (form: RewardFormState): boolean => {
    if (!form.name) return false;
    switch (form.rewardType) {
      case 'ROLE_ADD':
      case 'ROLE_REMOVE':
      case 'ROLE_STACK':
        return !!form.roleId;
      case 'ROLE_REPLACE':
        return !!form.roleId && form.removeRoleIds.length > 0;
      case 'PERMISSION_GRANT':
        return form.permissions.length > 0;
      case 'CHANNEL_ACCESS':
        return form.channelIds.length > 0;
      case 'ANNOUNCEMENT':
        return !!form.message;
      default:
        return true;
    }
  };

  const handleCreateReward = async () => {
    if (!isFormValid(newReward)) return;

    const reward: CreateReward = {
      level: newReward.level,
      xpType: newReward.xpType,
      rewardType: newReward.rewardType,
      rewardData: buildRewardData(newReward),
      name: newReward.name,
      description: newReward.description || undefined,
      stackable: newReward.stackable,
      oneTime: newReward.oneTime,
    };

    const result = await createReward(reward);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setShowAddForm(false);
      setNewReward(defaultFormState);
    }
  };

  const handleStartEdit = (reward: Reward) => {
    setEditingReward(reward);
    const nextEditForm: RewardFormState = {
      level: reward.level,
      xpType: reward.xpType,
      rewardType: reward.rewardType,
      roleId: reward.rewardData.roleId || '',
      removeRoleIds: (reward.rewardData.removeRoles as string[]) || [],
      channelIds: reward.rewardData.channelIds || [],
      permissions: reward.rewardData.permissions || [],
      message: (reward.rewardData.message as string) || '',
      name: reward.name,
      description: reward.description || '',
      stackable: reward.stackable,
      oneTime: reward.oneTime,
    };
    setEditForm(nextEditForm);
    setInitialEditForm(nextEditForm);
  };

  const handleCancelEdit = () => {
    setEditingReward(null);
    setEditForm(defaultFormState);
    setInitialEditForm(defaultFormState);
  };

  const handleSaveEdit = async () => {
    if (!editingReward || !isFormValid(editForm)) return;

    const result = await updateReward(editingReward.id, {
      level: editForm.level,
      xpType: editForm.xpType,
      rewardType: editForm.rewardType,
      rewardData: buildRewardData(editForm),
      name: editForm.name,
      description: editForm.description || undefined,
      stackable: editForm.stackable,
      oneTime: editForm.oneTime,
    });

    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setEditingReward(null);
      setEditForm(defaultFormState);
      setInitialEditForm(defaultFormState);
    }
  };

  const handleToggleEnabled = async (rewardId: string, enabled: boolean) => {
    const result = await updateReward(rewardId, { enabled });
    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handleDeleteReward = async (rewardId: string) => {
    const result = await deleteReward(rewardId);
    if (result.success) {
      setConfirmDeleteId(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handleApplyTemplate = async (templateName: string) => {
    const result = await applyTemplate(templateName);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted/50 rounded w-1/3 mb-2" />
          <div className="h-4 bg-muted/30 rounded w-1/2" />
        </div>
        <Card variant="glass">
          <CardContent className="py-12">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted-foreground">Loading rewards configuration...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group rewards by level
  const rewardsByLevel = rewards.reduce(
    (acc, reward) => {
      const key = reward.level;
      if (!acc[key]) acc[key] = [];
      acc[key].push(reward);
      return acc;
    },
    {} as Record<number, typeof rewards>
  );

  const sortedLevels = Object.keys(rewardsByLevel)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Level Rewards</h2>
          <p className="text-muted-foreground mt-1">Configure rewards for reaching XP levels</p>
        </div>
        <Button variant="neon" onClick={() => setShowAddForm(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Add Reward
        </Button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="glass border-destructive/50 p-4 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-destructive">Error</h3>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="glass border-success/50 p-4 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-success flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-success">Success</h3>
            <p className="text-sm text-success/80 mt-1">Changes saved successfully!</p>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card variant="glass">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-primary">{stats.totalRewards}</div>
              <div className="text-sm text-muted-foreground">Total Rewards</div>
            </CardContent>
          </Card>
          <Card variant="glass">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-primary">{stats.enabledRewards}</div>
              <div className="text-sm text-muted-foreground">Enabled</div>
            </CardContent>
          </Card>
          <Card variant="glass">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-primary">{stats.totalClaims}</div>
              <div className="text-sm text-muted-foreground">Total Claims</div>
            </CardContent>
          </Card>
          <Card variant="glass">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-primary">
                {Object.keys(rewardsByLevel).length}
              </div>
              <div className="text-sm text-muted-foreground">Levels with Rewards</div>
            </CardContent>
          </Card>
        </div>
      )}

      {showAddForm && (
        <RewardBuilder
          value={newReward}
          onChange={setNewReward}
          onSubmit={handleCreateReward}
          onCancel={() => {
            setShowAddForm(false);
            setNewReward(defaultFormState);
          }}
          roles={roles}
          textChannels={textChannels}
          loadingRoles={loadingRoles}
          saving={saving}
        />
      )}

      {/* Edit Reward Form */}
      {editingReward && (
        <Card variant="glass" className="border-primary/50">
          <CardHeader>
            <CardTitle>Edit Reward</CardTitle>
            <CardDescription>Modify reward settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Level Required
                </label>
                <Input
                  type="number"
                  value={editForm.level}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, level: parseInt(e.target.value) || 1 }))
                  }
                  min="1"
                  max="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">XP Type</label>
                <Select
                  value={editForm.xpType}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, xpType: value as XpType }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text XP</SelectItem>
                    <SelectItem value="VOICE">Voice XP</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Reward Name
                </label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Member Role"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Reward Type
                </label>
                <Select
                  value={editForm.rewardType}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      rewardType: value as RewardType,
                      roleId: '',
                      removeRoleIds: [],
                      channelIds: [],
                      permissions: [],
                      message: '',
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_REWARD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {SUPPORTED_REWARD_TYPES.find((t) => t.value === editForm.rewardType)?.description}
                </p>
              </div>

              {/* Role-based reward fields */}
              {['ROLE_ADD', 'ROLE_REMOVE', 'ROLE_STACK', 'ROLE_REPLACE'].includes(
                editForm.rewardType
              ) && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {editForm.rewardType === 'ROLE_REMOVE' ? 'Role to Remove' : 'Role to Award'}
                  </label>
                  <Select
                    value={editForm.roleId || '_none'}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        roleId: value === '_none' ? '' : value,
                      }))
                    }
                    disabled={loadingRoles}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Select a role...</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* ROLE_REPLACE: roles to remove */}
              {editForm.rewardType === 'ROLE_REPLACE' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Roles to Remove
                  </label>
                  <MultiSelectList
                    items={roles.map((role) => ({ value: role.id, label: role.name }))}
                    value={editForm.removeRoleIds}
                    onValueChange={(removeRoleIds) => setEditForm((prev) => ({ ...prev, removeRoleIds }))}
                    searchPlaceholder="Filter roles…"
                  />
                </div>
              )}

              {/* PERMISSION_GRANT fields */}
              {editForm.rewardType === 'PERMISSION_GRANT' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Permissions to Grant
                  </label>
                  <MultiSelectList
                    items={DISCORD_PERMISSIONS.map((permission) => ({ value: permission.value, label: permission.label }))}
                    value={editForm.permissions}
                    onValueChange={(permissions) => setEditForm((prev) => ({ ...prev, permissions }))}
                    searchPlaceholder="Filter permissions…"
                  />
                </div>
              )}

              {/* CHANNEL_ACCESS fields */}
              {editForm.rewardType === 'CHANNEL_ACCESS' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Channels to Grant Access
                  </label>
                  <MultiSelectList
                    items={textChannels.map((channel) => ({ value: channel.id, label: channel.name, prefix: '#' }))}
                    value={editForm.channelIds}
                    onValueChange={(channelIds) => setEditForm((prev) => ({ ...prev, channelIds }))}
                    searchPlaceholder="Filter channels…"
                  />
                </div>
              )}

              {/* ANNOUNCEMENT fields */}
              {editForm.rewardType === 'ANNOUNCEMENT' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Announcement Message
                  </label>
                  <textarea
                    value={editForm.message}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Congratulations {user}! You've reached level {level}!"
                    rows={3}
                    className="w-full resize-none border border-border bg-input px-4 py-2 text-foreground outline-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Available variables: {'{user}'}, {'{level}'}, {'{reward}'}
                  </p>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description (Optional)
                </label>
                <Input
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Awarded for reaching level..."
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.stackable}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({ ...prev, stackable: checked }))
                  }
                />
                <label className="text-sm text-foreground">Stackable</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.oneTime}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({ ...prev, oneTime: checked }))
                  }
                />
                <label className="text-sm text-foreground">One-time only</label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <UnsavedChangesBar
        visible={!!editingReward && JSON.stringify(editForm) !== JSON.stringify(initialEditForm)}
        saving={saving}
        disabled={!isFormValid(editForm)}
        onSave={handleSaveEdit}
        message="This reward has unsaved changes"
      />

      {/* Rewards List */}
      {sortedLevels.length > 0 ? (
        <div className="space-y-4">
          {sortedLevels.map((level) => (
            <Card key={level} variant="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Level {level}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({rewardsByLevel[level].length} reward
                    {rewardsByLevel[level].length !== 1 ? 's' : ''})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rewardsByLevel[level].map((reward) => {
                    const role = roles.find((r) => r.id === reward.rewardData.roleId);
                    const rewardTypeInfo = SUPPORTED_REWARD_TYPES.find(
                      (t) => t.value === reward.rewardType
                    );
                    const isRoleReward = [
                      'ROLE_ADD',
                      'ROLE_REMOVE',
                      'ROLE_STACK',
                      'ROLE_REPLACE',
                    ].includes(reward.rewardType);
                    return (
                      <div
                        key={reward.id}
                        className={`flex items-center justify-between p-3 border transition-colors ${
                          reward.enabled
                            ? 'bg-muted/20 border-border/30'
                            : 'bg-muted/10 border-border/20 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isRoleReward ? (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: role?.color
                                  ? `#${role.color.toString(16).padStart(6, '0')}`
                                  : '#888',
                              }}
                            />
                          ) : (
                            <div className="w-3 h-3 rounded-full bg-primary/50" />
                          )}
                          <div>
                            <span className="text-sm font-medium text-foreground">
                              {reward.name}
                            </span>
                            {reward.description && (
                              <p className="text-xs text-muted-foreground">{reward.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                {reward.xpType}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary/50 text-secondary-foreground">
                                {rewardTypeInfo?.label || reward.rewardType}
                              </span>
                              {reward.stackable && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  Stackable
                                </span>
                              )}
                              {reward.oneTime && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  One-time
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={reward.enabled}
                            onCheckedChange={(checked) => handleToggleEnabled(reward.id, checked)}
                            disabled={saving}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(reward)}
                            disabled={saving}
                          >
                            <svg
                              className="w-4 h-4 text-muted-foreground"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </Button>
                          {confirmDeleteId === reward.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteReward(reward.id)}
                                disabled={saving}
                              >
                                Confirm
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(reward.id)}
                            >
                              <svg
                                className="w-4 h-4 text-destructive"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card variant="glass">
          <CardContent className="py-12 text-center">
            <svg
              className="w-12 h-12 text-muted-foreground mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
              />
            </svg>
            <h3 className="text-lg font-medium text-foreground mb-2">No Rewards Configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first reward or use a template to get started.
            </p>
            <Button variant="neon" onClick={() => setShowAddForm(true)}>
              Add Your First Reward
            </Button>
          </CardContent>
        </Card>
      )}

      {templates.length > 0 && (
        <details className="border-t border-border pt-2">
          <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground">
            <span>Reward templates</span>
            <span className="text-xs tabular-nums">{templates.length}</span>
          </summary>
          <div className="pb-2 pt-1">
            <p className="mb-3 text-xs text-muted-foreground">
              Optional starting points for common reward setups.
            </p>
            <RewardTemplatePicker
              templates={templates}
              saving={saving}
              onApply={handleApplyTemplate}
            />
          </div>
        </details>
      )}
    </div>
  );
}
