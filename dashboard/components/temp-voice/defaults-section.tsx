'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onUpdate({ defaultLocked: !defaultLocked })}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left ${
              defaultLocked
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  defaultLocked
                    ? 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                    : 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z'
                }
              />
            </svg>
            <div>
              <div className="font-medium text-sm">Default Locked</div>
              <div className="text-xs opacity-75">New channels start locked</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ defaultHidden: !defaultHidden })}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left ${
              defaultHidden
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  defaultHidden
                    ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
                    : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                }
              />
            </svg>
            <div>
              <div className="font-medium text-sm">Default Hidden</div>
              <div className="text-xs opacity-75">New channels start hidden</div>
            </div>
          </button>
        </div>

        {/* Owner leave strategy */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            When Owner Leaves
          </label>
          <div className="grid grid-cols-3 gap-3">
            {OWNER_LEAVE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdate({ ownerLeaveStrategy: option.value })}
                className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                  ownerLeaveStrategy === option.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                }`}
              >
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs opacity-75">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
