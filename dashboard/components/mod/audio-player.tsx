'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { IconPlayerPlay, IconPlayerPause } from '@/lib/mod-icons';
import { useTranslations } from 'next-intl';

interface AudioPlayerProps {
  src: string;
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const t = useTranslations('Moderation');
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<import('wavesurfer.js').default | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1); // Default to 1x

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    let ws: import('wavesurfer.js').default | null = null;

    import('wavesurfer.js').then((WaveSurfer) => {
      if (destroyed || !containerRef.current) return;

      // Canvas 2D fillStyle does not resolve CSS custom properties —
      // they silently fail to #000000. Resolve from computed styles.
      const styles = getComputedStyle(containerRef.current!);
      const waveColor = styles.getPropertyValue('--mod-text-muted').trim() || '#888888';
      const progressColor = styles.getPropertyValue('--mod-text').trim() || '#e5e5e5';

      ws = WaveSurfer.default.create({
        container: containerRef.current,
        waveColor,
        progressColor,
        cursorColor: '#ffffff',
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        height: 64,
        url: src,
      });

      wsRef.current = ws;

      ws.on('ready', () => {
        setReady(true);
        setDuration(ws!.getDuration());
      });

      ws.on('timeupdate', (time: number) => {
        setCurrentTime(time);
      });

      ws.on('play', () => setPlaying(true));
      ws.on('pause', () => setPlaying(false));
      ws.on('finish', () => setPlaying(false));
    });

    return () => {
      destroyed = true;
      ws?.destroy();
      wsRef.current = null;
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((prev) => {
      const next = (prev + 1) % SPEED_OPTIONS.length;
      const speed = SPEED_OPTIONS[next];
      wsRef.current?.setPlaybackRate(speed);
      return next;
    });
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Waveform container */}
      <div className="relative">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-full animate-pulse bg-[var(--mono-800)]" />
          </div>
        )}
        <div ref={containerRef} className={ready ? '' : 'opacity-0'} />
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!ready}
          aria-label={playing ? t('pauseAudio') : t('playAudio')}
          className="flex h-8 w-8 items-center justify-center border border-[var(--mod-border)] text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] disabled:opacity-30"
        >
          {playing ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
        </button>

        <span className="text-xs text-[var(--mod-text-dim)] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <button
          onClick={cycleSpeed}
          disabled={!ready}
          aria-label={t('playbackSpeed', { speed: SPEED_OPTIONS[speedIndex] })}
          className="ml-auto border border-[var(--mod-border)] px-2 py-0.5 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] disabled:opacity-30"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {SPEED_OPTIONS[speedIndex]}x
        </button>
      </div>
    </div>
  );
}
