'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface PermissionsSectionProps {
  allowOwnerTransfer: boolean;
  allowOwnerManagement: boolean;
  onUpdate: (updates: Partial<{
    allowOwnerTransfer: boolean;
    allowOwnerManagement: boolean;
  }>) => void;
}

export default function PermissionsSection({
  allowOwnerTransfer,
  allowOwnerManagement,
  onUpdate,
}: PermissionsSectionProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Owner Permissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground">Allow Owner Transfer</label>
            <p className="text-sm text-muted-foreground">
              Let owners transfer ownership to others
            </p>
          </div>
          <Switch
            checked={allowOwnerTransfer}
            onCheckedChange={(checked) => onUpdate({ allowOwnerTransfer: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground">Allow Owner Management</label>
            <p className="text-sm text-muted-foreground">Let owners rename, limit users, etc.</p>
          </div>
          <Switch
            checked={allowOwnerManagement}
            onCheckedChange={(checked) => onUpdate({ allowOwnerManagement: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
