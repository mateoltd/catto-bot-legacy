'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface ModerationSectionProps {
  enableNameModeration: boolean;
  blockedKeywords: string[];
  onUpdate: (updates: Partial<{
    enableNameModeration: boolean;
    blockedKeywords: string[];
  }>) => void;
}

export default function ModerationSection({
  enableNameModeration,
  blockedKeywords,
  onUpdate,
}: ModerationSectionProps) {
  const handleKeywordsChange = (value: string) => {
    const keywords = value
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    onUpdate({ blockedKeywords: keywords });
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Name Moderation</CardTitle>
        <CardDescription>
          Filter inappropriate channel names automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground">
              Enable Name Moderation
            </label>
            <p className="text-sm text-muted-foreground">
              Automatically check channel names against blocked keywords
            </p>
          </div>
          <Switch
            checked={enableNameModeration}
            onCheckedChange={(checked) => onUpdate({ enableNameModeration: checked })}
          />
        </div>

        {enableNameModeration && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Blocked Keywords
            </label>
            <Input
              value={blockedKeywords.join(', ')}
              onChange={(e) => handleKeywordsChange(e.target.value)}
              placeholder="word1, word2, word3"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Comma-separated list of keywords that will be blocked in channel names
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
