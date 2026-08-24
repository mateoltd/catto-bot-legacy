'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OptionSelector } from '@/components/ui/option-selector';
import { Switch } from '@/components/ui/switch';

type OwnerLeaveStrategy = 'TRANSFER' | 'KEEP' | 'DELETE';

interface DefaultsSectionProps {
  userLimit: number | null;
  bitrate: number | null;
  maxChannelsPerUser: number;
  defaultLocked: boolean;
  defaultHidden: boolean;
  ownerLeaveStrategy: OwnerLeaveStrategy;
  onUpdate: (updates: Partial<{
    userLimit: number | null;
    bitrate: number | null;
    maxChannelsPerUser: number;
    defaultLocked: boolean;
    defaultHidden: boolean;
    ownerLeaveStrategy: OwnerLeaveStrategy;
  }>) => void;
}

const OWNER_LEAVE_OPTIONS: { value: OwnerLeaveStrategy; label: string; description: string }[] = [
  {
    value: 'TRANSFER',
    label: 'Transfer Ownership',
    description: 'Transfer to another member in the channel',
  },
  {
    value: 'KEEP',
    label: 'Keep Channel',
    description: 'Keep the channel open with no owner',
  },
  {
    value: 'DELETE',
    label: 'Delete Channel',
    description: 'Delete the channel when the owner leaves',
  },
];

export default function DefaultsSection({
  userLimit,
  bitrate,
  maxChannelsPerUser,
  defaultLocked,
  defaultHidden,
  ownerLeaveStrategy,
  onUpdate,
}: DefaultsSectionProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Channel Defaults</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">User Limit</label>
            <Input
              type="number"
              value={userLimit || ''}
              onChange={(e) =>
                onUpdate({ userLimit: e.target.value ? parseInt(e.target.value) : null })
              }
              placeholder="No limit"
              min="0"
              max="99"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Max users (0 = unlimited)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Bitrate (kbps)
            </label>
            <Input
              type="number"
              value={bitrate ? bitrate / 1000 : ''}
              onChange={(e) =>
                onUpdate({ bitrate: e.target.value ? parseInt(e.target.value) * 1000 : null })
              }
              placeholder="Server default"
              min="8"
              max="384"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Audio quality</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Max Channels Per User
            </label>
            <Input
              type="number"
              value={maxChannelsPerUser}
              onChange={(e) =>
                onUpdate({ maxChannelsPerUser: parseInt(e.target.value) || 1 })
              }
              min="1"
              max="10"
            />
          </div>
        </div>

        {/* Default locked / hidden toggles */}
        <div className="divide-y divide-border border border-border bg-input">
          <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
            <span>
              <span className="block font-mono text-sm font-medium text-foreground">Default Locked</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">New channels start locked</span>
            </span>
            <Switch checked={defaultLocked} onCheckedChange={(checked) => onUpdate({ defaultLocked: checked })} />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
            <span>
              <span className="block font-mono text-sm font-medium text-foreground">Default Hidden</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">New channels start hidden</span>
            </span>
            <Switch checked={defaultHidden} onCheckedChange={(checked) => onUpdate({ defaultHidden: checked })} />
          </label>
        </div>

        {/* Owner leave strategy */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            When Owner Leaves
          </label>
          <OptionSelector
            value={ownerLeaveStrategy}
            onValueChange={(value) => onUpdate({ ownerLeaveStrategy: value })}
            options={OWNER_LEAVE_OPTIONS}
            columns={3}
            ariaLabel="Owner leave strategy"
          />
        </div>
      </CardContent>
    </Card>
  );
}
