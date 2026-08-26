"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "next-intl";

interface DefaultsSectionProps {
  userLimit: number | null;
  bitrate: number | null;
  maxChannelsPerUser: number;
  defaultLocked: boolean;
  defaultHidden: boolean;
  ownershipGraceSeconds: number;
  onUpdate: (
    updates: Partial<{
      userLimit: number | null;
      bitrate: number | null;
      maxChannelsPerUser: number;
      defaultLocked: boolean;
      defaultHidden: boolean;
    }>,
  ) => void;
}

export default function DefaultsSection({
  userLimit,
  bitrate,
  maxChannelsPerUser,
  defaultLocked,
  defaultHidden,
  ownershipGraceSeconds,
  onUpdate,
}: DefaultsSectionProps) {
  const t = useTranslations("TempVoice");
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>{t("channelDefaults")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("userLimit")}
            </label>
            <Input
              type="number"
              value={userLimit || ""}
              onChange={(e) =>
                onUpdate({
                  userLimit: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              placeholder={t("noLimit")}
              min="0"
              max="99"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              {t("userLimitDescription")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("bitrate")}
            </label>
            <Input
              type="number"
              value={bitrate ? bitrate / 1000 : ""}
              onChange={(e) =>
                onUpdate({
                  bitrate: e.target.value
                    ? parseInt(e.target.value) * 1000
                    : null,
                })
              }
              placeholder={t("serverDefault")}
              min="8"
              max="384"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              {t("audioQuality")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("maxChannelsPerUser")}
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
              <span className="block font-mono text-sm font-medium text-foreground">
                {t("defaultLocked")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("defaultLockedDescription")}
              </span>
            </span>
            <Switch
              checked={defaultLocked}
              onCheckedChange={(checked) =>
                onUpdate({ defaultLocked: checked })
              }
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
            <span>
              <span className="block font-mono text-sm font-medium text-foreground">
                {t("defaultHidden")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("defaultHiddenDescription")}
              </span>
            </span>
            <Switch
              checked={defaultHidden}
              onCheckedChange={(checked) =>
                onUpdate({ defaultHidden: checked })
              }
            />
          </label>
        </div>

        <div className="border border-border bg-muted/20 px-4 py-3">
          <p className="font-mono text-sm font-medium text-foreground">
            {t("ownershipGraceTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("ownershipGraceDescription", { seconds: ownershipGraceSeconds })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
