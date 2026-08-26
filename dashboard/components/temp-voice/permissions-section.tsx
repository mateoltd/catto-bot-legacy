"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "next-intl";

interface PermissionsSectionProps {
  controlPanelEnabled: boolean;
  allowOwnerManagement: boolean;
  onUpdate: (
    updates: Partial<{
      controlPanelEnabled: boolean;
      allowOwnerManagement: boolean;
    }>,
  ) => void;
}

export default function PermissionsSection({
  controlPanelEnabled,
  allowOwnerManagement,
  onUpdate,
}: PermissionsSectionProps) {
  const t = useTranslations("TempVoice");
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>{t("ownerPermissions")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground">
              {t("controlPanelEnabled")}
            </label>
            <p className="text-sm text-muted-foreground">
              {t("controlPanelEnabledDescription")}
            </p>
          </div>
          <Switch
            checked={controlPanelEnabled}
            onCheckedChange={(checked) =>
              onUpdate({ controlPanelEnabled: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground">
              {t("allowOwnerManagement")}
            </label>
            <p className="text-sm text-muted-foreground">
              {t("allowOwnerManagementDescription")}
            </p>
          </div>
          <Switch
            checked={allowOwnerManagement}
            onCheckedChange={(checked) =>
              onUpdate({ allowOwnerManagement: checked })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
