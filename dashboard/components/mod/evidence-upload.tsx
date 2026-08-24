'use client';

import { useState, useRef, useCallback } from 'react';
import { IconX } from '@/lib/mod-icons';
import {
  initiateUpload,
  confirmUpload,
  addUrlEvidence,
  computeSHA256,
} from '@/lib/services/mod.service';

interface EvidenceUploadProps {
  guildId: string;
  caseNumber: number;
  onUploadComplete: () => void;
}

interface FileUploadState {
  file: File;
  status: 'pending' | 'scanning' | 'uploading' | 'confirming' | 'done' | 'error';
  progress: number;
  error?: string;
}

export function EvidenceUpload({ guildId, caseNumber, onUploadComplete }: EvidenceUploadProps) {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [urlDescription, setUrlDescription] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles);
    const newStates: FileUploadState[] = fileArray.map((f) => ({
      file: f,
      status: 'pending' as const,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newStates]);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const stateIndex = files.length + i;

      const update = (patch: Partial<FileUploadState>) => {
        setFiles((prev) => prev.map((s, idx) => (idx === stateIndex ? { ...s, ...patch } : s)));
      };

      try {
        update({ status: 'uploading', progress: 10 });

        // Step 1: Initiate
        const { evidenceId, uploadUrl } = await initiateUpload(guildId, {
          caseNumber,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        });

        update({ progress: 30 });

        // Step 2: Upload to presigned URL
        // Note: Content-Length is computed automatically by the browser from the body
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });
        if (!uploadResponse.ok) {
          const body = await uploadResponse.text().catch(() => '');
          throw new Error(`Upload failed (${uploadResponse.status}): ${body.slice(0, 200)}`);
        }

        update({ status: 'confirming', progress: 70 });

        // Step 3: Compute hash
        const contentHash = await computeSHA256(file);
        update({ progress: 85 });

        // Step 4: Confirm
        await confirmUpload(guildId, evidenceId, contentHash);
        update({ status: 'done', progress: 100 });
      } catch (err) {
        update({
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
      }
    }

    onUploadComplete();
  }, [guildId, caseNumber, files.length, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleUrlSubmit = async () => {
    const url = urlInput.trim();
    if (!url) return;

    setUrlLoading(true);
    setUrlError(null);

    try {
      await addUrlEvidence(guildId, {
        caseNumber,
        url,
        description: urlDescription.trim() || undefined,
      });
      setUrlInput('');
      setUrlDescription('');
      onUploadComplete();
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to add URL evidence');
    } finally {
      setUrlLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed p-8 text-center transition-[background-color,border-color] duration-75 ${
          dragOver
            ? 'border-[var(--mono-400)] bg-[var(--mono-850)]'
            : 'border-[var(--mod-border)] bg-[var(--mod-surface)] hover:border-[var(--mod-border-hover)]'
        }`}
      >
        <p className="text-sm text-[var(--mod-text-muted)]">
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-xs text-[var(--mod-text-dim)]">
          Images, videos, audio, documents
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.json,.log,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* File upload progress */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fs, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border border-[var(--mod-border)] bg-[var(--mod-surface)] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--mono-white)]">{fs.file.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden bg-[var(--mono-800)]">
                    <div
                      className={`h-full transition-[width] duration-150 ${
                        fs.status === 'error' ? 'bg-red-500' :
                        fs.status === 'done' ? 'bg-green-500' : 'bg-[var(--mono-400)]'
                      }`}
                      style={{ width: `${fs.progress}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-[var(--mod-text-dim)]">
                    {fs.status === 'pending' && 'Queued'}
                    {fs.status === 'scanning' && 'Scanning...'}
                    {fs.status === 'uploading' && 'Uploading...'}
                    {fs.status === 'confirming' && 'Verifying...'}
                    {fs.status === 'done' && 'Done'}
                    {fs.status === 'error' && (fs.error ?? 'Error')}
                  </span>
                </div>
              </div>
              {(fs.status === 'done' || fs.status === 'error') && (
                <button
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* URL input */}
      <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
        <p className="mb-2 text-sm font-medium text-[var(--mono-white)]">Add URL Evidence</p>
        <div className="space-y-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://..."
            className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
          />
          <input
            type="text"
            value={urlDescription}
            onChange={(e) => setUrlDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
          />
          {urlError && <p className="text-xs text-red-400">{urlError}</p>}
          <button
            onClick={handleUrlSubmit}
            disabled={urlLoading || !urlInput.trim()}
            className="border border-[var(--mod-border)] px-4 py-1.5 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] disabled:opacity-30"
          >
            {urlLoading ? 'Adding...' : 'Add URL'}
          </button>
        </div>
      </div>
    </div>
  );
}
