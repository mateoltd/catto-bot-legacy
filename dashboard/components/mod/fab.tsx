'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  IconPlus,
  IconFile,
  IconLink,
  IconCamera,
  IconClipboard,
} from '@/lib/mod-icons';

interface SpeedDialItem {
  label: string;
  icon: typeof IconFile;
  action: () => void;
}

export function FloatingActionButton() {
  const [expanded, setExpanded] = useState(false);
  const isMobile = useIsMobile();
  const fabRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handlePasteImage = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `pasted-image.${imageType.split('/')[1] || 'png'}`, { type: imageType });
          // Dispatch a custom event that the wizard can listen to
          window.dispatchEvent(new CustomEvent('fab:paste-image', { detail: { file } }));
          setExpanded(false);
          return;
        }
      }
    } catch {
      // Clipboard API may not be available or permission denied
    }
  }, []);

  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      window.dispatchEvent(new CustomEvent('fab:paste-image', { detail: { file } }));
      setExpanded(false);
    }
    e.target.value = '';
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: PointerEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [expanded]);

  if (!isMobile) return null;

  const items: SpeedDialItem[] = [
    {
      label: 'Upload File',
      icon: IconFile,
      action: () => {
        setExpanded(false);
        window.dispatchEvent(new CustomEvent('fab:upload-file'));
      },
    },
    {
      label: 'Add URL',
      icon: IconLink,
      action: () => {
        setExpanded(false);
        window.dispatchEvent(new CustomEvent('fab:add-url'));
      },
    },
    {
      label: 'Quick Photo',
      icon: IconCamera,
      action: () => {
        cameraRef.current?.click();
      },
    },
    {
      label: 'Paste Image',
      icon: IconClipboard,
      action: handlePasteImage,
    },
  ];

  return (
    <div ref={fabRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* Speed-dial items */}
      {expanded && (
        <div className="mb-2 flex flex-col items-end gap-2">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex items-center gap-2 border border-[var(--mod-border)] bg-[var(--mono-900)] px-3 py-2 shadow-lg transition-[background-color,opacity,transform] duration-150"
            >
              <span className="text-xs text-[var(--mono-white)]">{item.label}</span>
              <item.icon size={18} className="text-[var(--mono-400)]" />
            </button>
          ))}
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex h-14 w-14 items-center justify-center bg-[var(--mono-700)] shadow-lg transition-[background-color,transform] duration-150 hover:bg-[var(--mono-600)]"
        style={{ borderRadius: '50%' }}
      >
        <IconPlus
          size={24}
          className="text-[var(--mono-white)] transition-transform duration-150"
          style={{ transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Hidden camera input */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />
    </div>
  );
}
