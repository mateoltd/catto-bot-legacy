'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface DeletionSectionProps {
  autoDeleteEmpty: boolean;
  deleteEmptyAfterMs: number;
  autoDeleteOwnerLeave: boolean;
  deleteOwnerLeaveAfterMs: number;
  onUpdate: (updates: Partial<{
    autoDeleteEmpty: boolean;
    deleteEmptyAfterMs: number;
    autoDeleteOwnerLeave: boolean;
    deleteOwnerLeaveAfterMs: number;
  }>) => void;
}

export default function DeletionSection({
  autoDeleteEmpty,
  deleteEmptyAfterMs,
  autoDeleteOwnerLeave,
  deleteOwnerLeaveAfterMs,
  onUpdate,
}: DeletionSectionProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Auto-Delete Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground">Delete When Empty</label>
            <p className="text-sm text-muted-foreground">Remove channel when all users leave</p>
          </div>
          <Switch
            checked={autoDeleteEmpty}
            onCheckedChange={(checked) => onUpdate({ autoDeleteEmpty: checked })}
          />
        </div>

        {autoDeleteEmpty && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Delay Before Delete (seconds)
            </label>
            <Input
              type="number"
              value={deleteEmptyAfterMs / 1000}
              onChange={(e) =>
                onUpdate({ deleteEmptyAfterMs: (parseInt(e.target.value) || 0) * 1000 })
              }
              min="0"
              max="3600"
            />
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground">Delete When Owner Leaves</label>
            <p className="text-sm text-muted-foreground">
              Remove channel when the creator leaves
            </p>
          </div>
          <Switch
            checked={autoDeleteOwnerLeave}
            onCheckedChange={(checked) => onUpdate({ autoDeleteOwnerLeave: checked })}
          />
        </div>

        {autoDeleteOwnerLeave && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Delay Before Owner-Leave Delete (seconds)
            </label>
            <Input
              type="number"
              value={deleteOwnerLeaveAfterMs / 1000}
              onChange={(e) =>
                onUpdate({ deleteOwnerLeaveAfterMs: (parseInt(e.target.value) || 0) * 1000 })
              }
              min="0"
              max="3600"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
