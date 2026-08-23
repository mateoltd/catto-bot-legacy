'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { VideoTimestamp } from '@/lib/mod-types';
import { addVideoTimestamp, removeVideoTimestamp } from '@/lib/services/mod.service';
import { IconPlayerPlay, IconPlayerPause, IconNote, IconX, IconTrash } from '@/lib/mod-icons';

interface VideoPlayerProps {
  src: string;
  guildId: string;
  evidenceId: string;
  timestamps?: VideoTimestamp[];
  onTimestampChange?: () => void;
  className?: string;
}

export function VideoPlayer({
  src,
  guildId,
  evidenceId,
  timestamps = [],
  onTimestampChange,
  className = '',
}: VideoPlayerProps) {
  const [localTimestamps, setLocalTimestamps] = useState<VideoTimestamp[]>(timestamps);

  // Sync with prop changes
  useEffect(() => {
    setLocalTimestamps(timestamps);
  }, [timestamps]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingTimestamp, setAddingTimestamp] = useState(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState<VideoTimestamp | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => {
        console.error('Failed to play video:', err);
      });
    }
  }, [isPlaying]);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  }, []);

  const handleScrubberClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      seekTo(percent * duration);
    },
    [duration, seekTo]
  );

  const handleAddClick = useCallback(() => {
    videoRef.current?.pause();
    setShowAddForm(true);
  }, []);

  const handleAddSubmit = useCallback(async () => {
    if (!newNote.trim()) return;
    setAddingTimestamp(true);
    try {
      const updated = await addVideoTimestamp(guildId, evidenceId, currentTime, newNote.trim());
      if (updated) {
        const newTimestamps = ((updated.metadata as Record<string, unknown> | null)?.timestamps ?? []) as VideoTimestamp[];
        setLocalTimestamps(newTimestamps);
        onTimestampChange?.();
      }
      setNewNote('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to add timestamp:', err);
    } finally {
      setAddingTimestamp(false);
    }
  }, [currentTime, newNote, guildId, evidenceId, onTimestampChange]);

  const handleRemoveTimestamp = useCallback(async () => {
    if (!selectedTimestamp) return;
    try {
      const updated = await removeVideoTimestamp(guildId, evidenceId, selectedTimestamp.id);
      if (updated) {
        const newTimestamps = ((updated.metadata as Record<string, unknown> | null)?.timestamps ?? []) as VideoTimestamp[];
        setLocalTimestamps(newTimestamps);
        onTimestampChange?.();
      }
      setSelectedTimestamp(null);
    } catch (err) {
      console.error('Failed to remove timestamp:', err);
    }
  }, [guildId, evidenceId, selectedTimestamp, onTimestampChange]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Video */}
      <video ref={videoRef} src={src} className="w-full" onClick={togglePlay} />

      {/* Custom controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        {/* Scrubber with timestamp markers */}
        <div
          className="relative mb-2 h-2 cursor-pointer rounded bg-[var(--mono-700)]"
          onClick={handleScrubberClick}
        >
          {/* Progress */}
          <div
            className="absolute left-0 top-0 h-full rounded bg-[var(--mono-400)]"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          />
          {/* Timestamp markers */}
          {localTimestamps.map((ts) => (
            <button
              key={ts.id}
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 hover:scale-125"
              style={{ left: duration ? `${(ts.time / duration) * 100}%` : '0%' }}
              onClick={(e) => {
                e.stopPropagation();
                seekTo(ts.time);
                setSelectedTimestamp(ts);
              }}
              title={`${formatTime(ts.time)}: ${ts.note}`}
              aria-label={`${formatTime(ts.time)}: ${ts.note}`}
            />
          ))}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="rounded p-1 text-white hover:bg-white/20"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}
            </button>
            <span className="text-xs text-white">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <button
            onClick={handleAddClick}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white hover:bg-white/20"
          >
            <IconNote size={14} />
            Add Note
          </button>
        </div>
      </div>

      {/* Add timestamp form */}
      {showAddForm && (
        <div className="absolute bottom-16 left-4 right-4 border border-[var(--mod-border)] bg-[var(--mono-900)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[var(--mod-text-dim)]">
              Add note at {formatTime(currentTime)}
            </span>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
              aria-label="Close add form"
            >
              <IconX size={14} />
            </button>
          </div>
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter note..."
            className="mb-2 w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-2 py-1 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSubmit();
              if (e.key === 'Escape') setShowAddForm(false);
            }}
          />
          <button
            onClick={handleAddSubmit}
            disabled={addingTimestamp || !newNote.trim()}
            className="border border-[var(--mono-500)] px-3 py-1 text-xs text-[var(--mono-white)] hover:bg-[var(--mono-800)] disabled:opacity-30"
          >
            {addingTimestamp ? 'Adding...' : 'Add'}
          </button>
        </div>
      )}

      {/* Selected timestamp popup */}
      {selectedTimestamp && (
        <div className="absolute bottom-16 left-4 right-4 border border-[var(--mod-border)] bg-[var(--mono-900)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--mono-white)]">
              {formatTime(selectedTimestamp.time)}
            </span>
            <button
              onClick={() => setSelectedTimestamp(null)}
              className="text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
              aria-label="Close timestamp popup"
            >
              <IconX size={14} />
            </button>
          </div>
          <p className="mb-2 text-sm text-[var(--mod-text-muted)]">{selectedTimestamp.note}</p>
          <div className="flex items-center justify-between text-xs text-[var(--mod-text-dim)]">
            <span>By {selectedTimestamp.addedByTag}</span>
            <button
              onClick={handleRemoveTimestamp}
              className="flex items-center gap-1 text-red-400 hover:text-red-300"
            >
              <IconTrash size={12} />
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
