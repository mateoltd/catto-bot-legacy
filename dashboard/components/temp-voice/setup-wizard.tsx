'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OptionSelector } from '@/components/ui/option-selector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TempVoiceSetupRequest } from '@/lib/services/temp-voice.service';
import type { Channel } from '@/lib/types';

interface SetupWizardProps {
  error: string | null;
  onSetup: (options: TempVoiceSetupRequest) => Promise<{ success: boolean; error?: string }>;
  onSetupExisting: (channelId: string) => Promise<{ success: boolean; error?: string }>;
  onRetry: () => void;
  voiceChannels: Channel[];
  loadingChannels: boolean;
}

export default function SetupWizard({
  error,
  onSetup,
  onSetupExisting,
  onRetry,
  voiceChannels,
  loadingChannels,
}: SetupWizardProps) {
  const [mode, setMode] = useState<'create' | 'existing'>('create');
  const [categoryName, setCategoryName] = useState('Temp Voice');
  const [joinChannelName, setJoinChannelName] = useState('Join to Create');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const handleSetup = async () => {
    setIsSettingUp(true);
    setSetupError(null);
    try {
      const result =
        mode === 'create'
          ? await onSetup({ categoryName, joinChannelName })
          : await onSetupExisting(selectedChannelId);

      if (!result.success) {
        setSetupError(result.error || 'Setup failed');
      }
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsSettingUp(false);
    }
  };

  const displayedError = setupError || error;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Temporary Voice Channels</h2>
        <p className="text-muted-foreground mt-1">
          Let users create their own temporary voice channels
        </p>
      </div>

      {displayedError && (
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
          <div className="flex-1">
            <h3 className="text-sm font-medium text-destructive">
              {setupError ? 'Setup Error' : 'Error Loading Config'}
            </h3>
            <p className="text-sm text-destructive/80 mt-1">{displayedError}</p>
            {displayedError.toLowerCase().includes('already exists') && (
              <p className="text-xs text-muted-foreground mt-2">
                Configuration already exists. Click retry to load your existing settings.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSetupError(null);
              onRetry();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      <Card variant="glass">
        <CardHeader>
          <CardTitle>Setup Temporary Voice</CardTitle>
          <CardDescription>
            Create a &quot;Join to Create&quot; voice channel. When users join it, a new temporary
            channel is created for them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode selector */}
          <OptionSelector
            value={mode}
            onValueChange={setMode}
            ariaLabel="Setup method"
            options={[
              { value: 'create', label: 'Create New', description: 'Create a category and join channel' },
              { value: 'existing', label: 'Use Existing', description: 'Pick a voice channel as the join trigger' },
            ]}
          />

          {mode === 'create' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Category Name
                </label>
                <Input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Temp Voice"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Category to organize temp voice channels
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Join Channel Name
                </label>
                <Input
                  value={joinChannelName}
                  onChange={(e) => setJoinChannelName(e.target.value)}
                  placeholder="Join to Create"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Channel users join to create their own
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Select Voice Channel
              </label>
              {loadingChannels ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading channels...
                </div>
              ) : voiceChannels.length > 0 ? (
                <Select
                  value={selectedChannelId}
                  onValueChange={setSelectedChannelId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a voice channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {voiceChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No voice channels found in this server.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                This channel will be used as the &quot;Join to Create&quot; trigger
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground mb-4">
              {mode === 'create'
                ? 'This will create a category, a "Join to Create" voice channel, and an admin-only log channel with a webhook for logging events.'
                : 'This will set up the temp voice system using the selected channel as the join trigger.'}
            </p>
            <Button
              variant="neon"
              onClick={handleSetup}
              disabled={isSettingUp || (mode === 'existing' && !selectedChannelId)}
            >
              {isSettingUp ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Setting up...
                </>
              ) : (
                'Setup Temp Voice'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
