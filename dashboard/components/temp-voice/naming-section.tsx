'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type NamingScheme = 'username' | 'displayname' | 'sequential' | 'custom';

interface NamingSectionProps {
  namingScheme: NamingScheme;
  customNamingPattern: string;
  onNamingSchemeChange: (scheme: NamingScheme) => void;
  onCustomPatternChange: (pattern: string) => void;
}

const NAMING_OPTIONS: { value: NamingScheme; label: string; description: string }[] = [
  { value: 'username', label: 'Username', description: "Use the creator's username" },
  { value: 'displayname', label: 'Display Name', description: "Use the creator's display name" },
  { value: 'sequential', label: 'Sequential', description: 'Channel 1, Channel 2, etc.' },
  { value: 'custom', label: 'Custom Pattern', description: 'Use a custom naming pattern' },
];

const TEMPLATE_VARIABLES = [
  { variable: '{username}', description: "Creator's username" },
  { variable: '{displayname}', description: "Creator's display name" },
  { variable: '{userid}', description: "Creator's user ID" },
  { variable: '{count}', description: 'Sequential channel number' },
];

export default function NamingSection({
  namingScheme,
  customNamingPattern,
  onNamingSchemeChange,
  onCustomPatternChange,
}: NamingSectionProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Channel Naming</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Naming Scheme</label>
          <div className="grid grid-cols-2 gap-3">
            {NAMING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onNamingSchemeChange(option.value)}
                className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                  namingScheme === option.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs opacity-75">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {namingScheme === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Custom Pattern</label>
            <Input
              value={customNamingPattern || ''}
              onChange={(e) => onCustomPatternChange(e.target.value)}
              placeholder="{username}'s Channel"
            />
            <div className="mt-2 p-3 rounded-lg bg-muted/20 border border-border/30">
              <p className="text-xs font-medium text-foreground mb-1.5">Available Variables:</p>
              <div className="grid grid-cols-2 gap-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <div key={v.variable} className="text-xs text-muted-foreground">
                    <code className="text-primary/80">{v.variable}</code> - {v.description}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
