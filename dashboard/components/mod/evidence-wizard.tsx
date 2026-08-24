"use client";

import { useReducer, useRef, useCallback, useEffect } from "react";
import {
  EVIDENCE_TYPE_ICONS,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconX,
  IconCheck,
  IconCamera,
  IconClipboard,
} from "@/lib/mod-icons";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  initiateUpload,
  confirmUpload,
  addUrlEvidence,
  previewOG,
  computeSHA256,
} from "@/lib/services/mod.service";
import { TagSelector } from "./tag-selector";
import { OGCard } from "./og-card";
import { scanImage, isImageFile, type NsfwResult } from "@/lib/nsfw";
import { NsfwScanner } from "./nsfw-scanner";

// ─── Props & Constants ───

interface EvidenceWizardProps {
  guildId: string;
  caseNumber: number;
  onUploadComplete: () => void;
}

type UploadableType =
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "URL"
  | "DISCORD_URL";
type WizardStep = 1 | 2 | 3;

// ─── State & Reducer ───

interface FileEntry {
  file: File;
  description: string;
}

interface UploadProgress {
  index: number;
  status: "pending" | "uploading" | "hashing" | "confirming" | "done" | "error";
  progress: number;
  error?: string;
}

interface OGPreview {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface NsfwFlag {
  fileIndex: number;
  result: NsfwResult;
}

interface WizardState {
  step: WizardStep;
  selectedType: UploadableType | null;
  files: FileEntry[];
  urlInput: string;
  description: string;
  applyDescToAll: boolean;
  tags: string[];
  dragOver: boolean;
  uploading: boolean;
  uploadProgress: UploadProgress[];
  ogPreview: OGPreview | null;
  ogLoading: boolean;
  nsfwScanning: boolean;
  nsfwFlags: NsfwFlag[];
  nsfwScanDone: boolean;
  completed: boolean;
  completedCount: number;
  completedErrors: number;
}

type WizardAction =
  | { type: "BEGIN_FILES"; files: File[] }
  | { type: "BEGIN_URL" }
  | { type: "PREV_STEP" }
  | { type: "NEXT_STEP" }
  | { type: "ADD_FILES"; files: File[] }
  | { type: "REMOVE_FILE"; index: number }
  | { type: "UPDATE_FILE_DESC"; index: number; description: string }
  | { type: "SET_URL"; url: string }
  | { type: "SET_DESCRIPTION"; description: string }
  | { type: "TOGGLE_APPLY_DESC_ALL" }
  | { type: "SET_TAGS"; tags: string[] }
  | { type: "SET_DRAG_OVER"; dragOver: boolean }
  | { type: "START_UPLOAD"; progress: UploadProgress[] }
  | { type: "UPDATE_PROGRESS"; index: number; patch: Partial<UploadProgress> }
  | { type: "FINISH_UPLOAD"; success?: boolean }
  | { type: "OG_LOADING" }
  | { type: "OG_LOADED"; og: OGPreview | null }
  | { type: "RESET" }
  | { type: "NSFW_SCAN_START" }
  | { type: "NSFW_SCAN_DONE"; flags: NsfwFlag[] }
  | { type: "NSFW_DISMISS"; fileIndex: number }
  // Compound actions — update multiple fields atomically
  | { type: "FAB_UPLOAD" }
  | { type: "FAB_URL" }
  | { type: "FAB_PASTE"; file: File }
  | { type: "CAMERA_CAPTURE"; file: File };

const INITIAL_STATE: WizardState = {
  step: 1,
  selectedType: null,
  files: [],
  urlInput: "",
  description: "",
  applyDescToAll: true,
  tags: [],
  dragOver: false,
  uploading: false,
  uploadProgress: [],
  ogPreview: null,
  ogLoading: false,
  nsfwScanning: false,
  nsfwFlags: [],
  nsfwScanDone: false,
  completed: false,
  completedCount: 0,
  completedErrors: 0,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "BEGIN_FILES":
      return {
        ...state,
        selectedType: "DOCUMENT",
        files: [
          ...state.files,
          ...action.files.map((file) => ({ file, description: "" })),
        ],
        step: 2,
      };
    case "BEGIN_URL":
      return { ...state, selectedType: "URL", step: 2 };
    case "PREV_STEP":
      return state.step > 1
        ? { ...state, step: (state.step - 1) as WizardStep }
        : state;
    case "NEXT_STEP":
      return state.step < 3
        ? { ...state, step: (state.step + 1) as WizardStep }
        : state;
    case "ADD_FILES":
      return {
        ...state,
        files: [
          ...state.files,
          ...action.files.map((f) => ({ file: f, description: "" })),
        ],
      };
    case "REMOVE_FILE":
      return {
        ...state,
        files: state.files.filter((_, i) => i !== action.index),
      };
    case "UPDATE_FILE_DESC":
      return {
        ...state,
        files: state.files.map((f, i) =>
          i === action.index ? { ...f, description: action.description } : f,
        ),
      };
    case "SET_URL":
      return { ...state, urlInput: action.url };
    case "SET_DESCRIPTION":
      return { ...state, description: action.description };
    case "TOGGLE_APPLY_DESC_ALL":
      return { ...state, applyDescToAll: !state.applyDescToAll };
    case "SET_TAGS":
      return { ...state, tags: action.tags };
    case "SET_DRAG_OVER":
      return { ...state, dragOver: action.dragOver };
    case "START_UPLOAD":
      return { ...state, uploading: true, uploadProgress: action.progress };
    case "UPDATE_PROGRESS":
      return {
        ...state,
        uploadProgress: state.uploadProgress.map((p) =>
          p.index === action.index ? { ...p, ...action.patch } : p,
        ),
      };
    case "FINISH_UPLOAD": {
      const doneCount = state.uploadProgress.filter(
        (p) => p.status === "done",
      ).length;
      const errorCount = state.uploadProgress.filter(
        (p) => p.status === "error",
      ).length;
      const isUrl =
        state.selectedType === "URL" || state.selectedType === "DISCORD_URL";
      const successCount = isUrl
        ? action.success !== false
          ? 1
          : 0
        : doneCount;
      const failCount = isUrl ? (action.success === false ? 1 : 0) : errorCount;
      return {
        ...state,
        uploading: false,
        completed: true,
        completedCount: successCount,
        completedErrors: failCount,
      };
    }
    case "OG_LOADING":
      return { ...state, ogLoading: true };
    case "OG_LOADED":
      return { ...state, ogLoading: false, ogPreview: action.og };
    case "NSFW_SCAN_START":
      return { ...state, nsfwScanning: true, nsfwFlags: [] };
    case "NSFW_SCAN_DONE":
      return {
        ...state,
        nsfwScanning: false,
        nsfwFlags: action.flags,
        nsfwScanDone: true,
      };
    case "NSFW_DISMISS":
      return {
        ...state,
        nsfwFlags: state.nsfwFlags.filter(
          (f) => f.fileIndex !== action.fileIndex,
        ),
      };
    case "RESET":
      return INITIAL_STATE;
    // Compound: FAB "Upload File" → jump directly to the mixed-file queue.
    case "FAB_UPLOAD":
      return { ...state, selectedType: "DOCUMENT", step: 2 };
    // Compound: FAB "Add URL" → jump to step 2 as URL
    case "FAB_URL":
      return { ...state, selectedType: "URL", step: 2 };
    // Compound: FAB paste / quick photo → add file, jump to step 2 as IMAGE
    case "FAB_PASTE":
      return {
        ...state,
        selectedType: "IMAGE",
        files: [...state.files, { file: action.file, description: "" }],
        step: 2,
      };
    // Compound: Camera capture → replace files, jump to step 2 as IMAGE
    case "CAMERA_CAPTURE":
      return {
        ...state,
        selectedType: "IMAGE",
        files: [{ file: action.file, description: "" }],
        step: 2,
      };
    default:
      return state;
  }
}

// ─── Derived helpers ───

function isFileType(type: UploadableType | null): boolean {
  return type !== null && !["URL", "DISCORD_URL"].includes(type);
}

function isUrlType(type: UploadableType | null): boolean {
  return type === "URL" || type === "DISCORD_URL";
}

function inferFileType(file: File): "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

// ─── Component ───

export function EvidenceWizard({
  guildId,
  caseNumber,
  onUploadComplete,
}: EvidenceWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const ogDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();

  const fileMode = isFileType(state.selectedType);
  const urlMode = isUrlType(state.selectedType);

  const canAdvance = () => {
    if (state.step === 1) return state.selectedType !== null;
    if (state.step === 2) {
      if (fileMode) return state.files.length > 0;
      if (urlMode) return state.urlInput.trim().length > 0;
      return false;
    }
    return true;
  };

  // ─── Effects ───

  // Debounced OG preview when URL input changes
  useEffect(() => {
    if (!urlMode || !state.urlInput.trim().startsWith("http")) {
      dispatch({ type: "OG_LOADED", og: null });
      return;
    }

    dispatch({ type: "OG_LOADING" });
    if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);

    ogDebounceRef.current = setTimeout(async () => {
      const og = await previewOG(guildId, state.urlInput.trim());
      dispatch({ type: "OG_LOADED", og });
    }, 500);

    return () => {
      if (ogDebounceRef.current) clearTimeout(ogDebounceRef.current);
    };
  }, [state.urlInput, urlMode, guildId]);

  // Global paste listener for file types in step 2
  useEffect(() => {
    if (state.step !== 2 || !fileMode) return;

    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) dispatch({ type: "ADD_FILES", files: [blob] });
          return;
        }
      }
    };

    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [state.step, fileMode]);

  // FAB custom events → single dispatch each
  useEffect(() => {
    const onUpload = () => dispatch({ type: "FAB_UPLOAD" });
    const onUrl = () => dispatch({ type: "FAB_URL" });
    const onPaste = (e: Event) => {
      const file = (e as CustomEvent<{ file: File }>).detail?.file;
      if (file) dispatch({ type: "FAB_PASTE", file });
    };

    window.addEventListener("fab:upload-file", onUpload);
    window.addEventListener("fab:add-url", onUrl);
    window.addEventListener("fab:paste-image", onPaste);
    return () => {
      window.removeEventListener("fab:upload-file", onUpload);
      window.removeEventListener("fab:add-url", onUrl);
      window.removeEventListener("fab:paste-image", onPaste);
    };
  }, []);

  // ─── Handlers ───

  const handleFileSelect = useCallback(
    (selected: FileList | File[]) => {
      const files = Array.from(selected);
      dispatch(
        state.step === 1
          ? { type: "BEGIN_FILES", files }
          : { type: "ADD_FILES", files },
      );
    },
    [state.step],
  );

  const handleCameraCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) dispatch({ type: "CAMERA_CAPTURE", file });
      e.target.value = "";
    },
    [],
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_DRAG_OVER", dragOver: false });
    if (e.dataTransfer.files.length > 0) {
      dispatch({ type: "ADD_FILES", files: Array.from(e.dataTransfer.files) });
    }
  }, []);

  const handleClipboardPaste = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File(
            [blob],
            `pasted-image.${imageType.split("/")[1] || "png"}`,
            {
              type: imageType,
            },
          );
          dispatch(
            state.step === 1
              ? { type: "BEGIN_FILES", files: [file] }
              : { type: "ADD_FILES", files: [file] },
          );
          return;
        }
      }
    } catch {
      // Clipboard API may not be available or permission denied
    }
  }, [state.step]);

  const runUpload = async () => {
    if (urlMode) {
      dispatch({ type: "START_UPLOAD", progress: [] });
      try {
        await addUrlEvidence(guildId, {
          caseNumber,
          url: state.urlInput.trim(),
          type: state.selectedType === "DISCORD_URL" ? "DISCORD_URL" : "URL",
          description: state.description.trim() || undefined,
          tags: state.tags.length > 0 ? state.tags : undefined,
        });
        onUploadComplete();
        dispatch({ type: "FINISH_UPLOAD", success: true });
      } catch {
        dispatch({ type: "FINISH_UPLOAD", success: false });
      }
      return;
    }

    // File uploads. Three workers keep batches quick without flooding storage or
    // hashing a large number of files on the main thread at once.
    const progress: UploadProgress[] = state.files.map((_, i) => ({
      index: i,
      status: "pending" as const,
      progress: 0,
    }));
    dispatch({ type: "START_UPLOAD", progress });

    let nextIndex = 0;

    const uploadEntry = async (i: number) => {
      const entry = state.files[i];
      const fileDesc = state.applyDescToAll
        ? state.description
        : entry.description || state.description;

      try {
        dispatch({
          type: "UPDATE_PROGRESS",
          index: i,
          patch: { status: "uploading", progress: 10 },
        });

        const { evidenceId, uploadUrl } = await initiateUpload(guildId, {
          caseNumber,
          filename: entry.file.name,
          mimeType: entry.file.type || "application/octet-stream",
          sizeBytes: entry.file.size,
          description: fileDesc.trim() || undefined,
          tags: state.tags.length > 0 ? state.tags : undefined,
        });

        dispatch({
          type: "UPDATE_PROGRESS",
          index: i,
          patch: { progress: 30 },
        });

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": entry.file.type || "application/octet-stream",
          },
          body: entry.file,
        });
        if (!uploadResponse.ok) {
          const body = await uploadResponse.text().catch(() => "");
          throw new Error(
            `Upload failed (${uploadResponse.status}): ${body.slice(0, 200)}`,
          );
        }

        dispatch({
          type: "UPDATE_PROGRESS",
          index: i,
          patch: { status: "hashing", progress: 60 },
        });

        const contentHash = await computeSHA256(entry.file);
        dispatch({
          type: "UPDATE_PROGRESS",
          index: i,
          patch: { status: "confirming", progress: 80 },
        });

        await confirmUpload(guildId, evidenceId, contentHash);
        dispatch({
          type: "UPDATE_PROGRESS",
          index: i,
          patch: { status: "done", progress: 100 },
        });
        // Refresh after every completed item so the case updates while a large
        // batch is still running; SSE remains the cross-tab source of truth.
        onUploadComplete();
      } catch (err) {
        dispatch({
          type: "UPDATE_PROGRESS",
          index: i,
          patch: {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          },
        });
      }
    };

    const worker = async () => {
      while (nextIndex < state.files.length) {
        const index = nextIndex;
        nextIndex += 1;
        await uploadEntry(index);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(3, state.files.length) }, () => worker()),
    );

    dispatch({ type: "FINISH_UPLOAD" });
  };

  const handleUpload = async () => {
    // Run NSFW scan on image files before uploading
    if (fileMode && !state.nsfwScanDone) {
      const imageFiles = state.files.filter((e) => isImageFile(e.file));
      if (imageFiles.length > 0) {
        dispatch({ type: "NSFW_SCAN_START" });
        const flags: NsfwFlag[] = [];
        for (let i = 0; i < state.files.length; i++) {
          if (!isImageFile(state.files[i].file)) continue;
          try {
            const result = await scanImage(state.files[i].file);
            if (result.isNsfw) {
              flags.push({ fileIndex: i, result });
            }
          } catch {
            // Scan failure is non-blocking — proceed with upload
          }
        }
        dispatch({ type: "NSFW_SCAN_DONE", flags });
        if (flags.length > 0) return; // Show NSFW warnings, don't upload yet
      }
    }

    await runUpload();
  };

  // ─── Render ───

  return (
    <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)]">
      {/* Step Indicator */}
      {!state.completed && (
        <div className="flex border-b border-[var(--mod-border)]">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 px-4 py-3 text-center text-xs font-medium transition-[background-color] duration-75 ${
                s === state.step
                  ? "bg-[var(--mono-800)] text-[var(--mono-white)]"
                  : s < state.step
                    ? "text-[var(--mod-text-muted)]"
                    : "text-[var(--mod-text-dim)]"
              }`}
            >
              {s}. {s === 1 ? "Add" : s === 2 ? "Review" : "Details"}
            </div>
          ))}
        </div>
      )}

      <div className="p-5">
        {/* Completed screen */}
        {state.completed && (
          <div className="flex flex-col items-center py-6">
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center border ${
                state.completedCount > 0
                  ? "border-green-800 bg-green-950/30 text-green-400"
                  : "border-red-800 bg-red-950/30 text-red-400"
              }`}
            >
              {state.completedCount > 0 ? (
                <IconCheck size={24} />
              ) : (
                <IconX size={24} />
              )}
            </div>
            <h3 className="mb-1 text-lg font-semibold text-[var(--mono-white)]">
              {state.completedCount > 0 ? "Upload complete" : "Upload failed"}
            </h3>
            <p className="mb-6 text-sm text-[var(--mod-text-muted)]">
              {urlMode
                ? state.completedCount > 0
                  ? "Link added successfully"
                  : "The link could not be added"
                : `${state.completedCount} file${state.completedCount !== 1 ? "s" : ""} uploaded successfully`}
              {state.completedErrors > 0 && (
                <span className="text-red-400">
                  {" "}
                  &middot; {state.completedErrors} failed
                </span>
              )}
            </p>
            {state.uploadProgress.length > 0 && (
              <div
                className="mb-6 w-full max-w-xl border border-[var(--mod-border)]"
                aria-live="polite"
              >
                {state.uploadProgress.map((progress) => {
                  const entry = state.files[progress.index];
                  const FileIcon = entry
                    ? EVIDENCE_TYPE_ICONS[inferFileType(entry.file)]
                    : EVIDENCE_TYPE_ICONS.DOCUMENT;
                  return (
                    <div
                      key={progress.index}
                      className="flex items-center gap-3 border-b border-[var(--mod-border)] px-3 py-2 last:border-b-0"
                    >
                      <FileIcon
                        size={15}
                        className="text-[var(--mod-text-dim)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-left text-xs text-[var(--mod-text-muted)]">
                        {entry?.file.name}
                      </span>
                      <span
                        className={
                          progress.status === "done"
                            ? "text-xs text-green-400"
                            : "text-xs text-red-400"
                        }
                      >
                        {progress.status === "done"
                          ? "Added"
                          : (progress.error ?? "Failed")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => dispatch({ type: "RESET" })}
                className="flex items-center gap-1 border border-[var(--mono-500)] px-4 py-2 text-sm text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mono-800)]"
              >
                <IconPlus size={16} />
                Upload More
              </button>
            </div>
          </div>
        )}

        {/* Step 1: direct intake. File type is inferred per item, so mixed batches work. */}
        {!state.completed && state.step === 1 && (
          <div>
            <p className="mb-4 text-sm text-[var(--mod-text-muted)]">
              Add a mixed batch of files, paste a capture, or attach a link.
            </p>

            {/* Camera quick-capture (mobile only) */}
            {isMobile && (
              <>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="mb-3 flex w-full items-center justify-center gap-2 border border-[var(--mono-500)] bg-[var(--mono-850)] p-4 text-sm font-medium text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mono-800)]"
                >
                  <IconCamera size={20} />
                  Quick Photo
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleCameraCapture}
                />
              </>
            )}

            <div
              onDragOver={(event) => {
                event.preventDefault();
                dispatch({ type: "SET_DRAG_OVER", dragOver: true });
              }}
              onDragLeave={() =>
                dispatch({ type: "SET_DRAG_OVER", dragOver: false })
              }
              onDrop={(event) => {
                event.preventDefault();
                dispatch({ type: "SET_DRAG_OVER", dragOver: false });
                if (event.dataTransfer.files.length)
                  handleFileSelect(event.dataTransfer.files);
              }}
              className={`border-2 border-dashed p-8 text-center ${
                state.dragOver
                  ? "border-[var(--mono-400)] bg-[var(--mono-850)]"
                  : "border-[var(--mod-border)] bg-[var(--mono-950)]"
              }`}
            >
              <p className="text-base font-medium text-[var(--mono-white)]">
                Drop all evidence files here
              </p>
              <p className="mt-1 text-xs text-[var(--mod-text-dim)]">
                Images, video, audio and documents can be mixed in one batch.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 border border-[var(--mono-500)] px-4 py-2 text-sm text-[var(--mono-white)] hover:bg-[var(--mono-800)]"
              >
                Choose files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.json,.log,.csv,.zip"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.length)
                    handleFileSelect(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>

            <div className="mt-3 flex flex-wrap border border-[var(--mod-border)]">
              <button
                type="button"
                onClick={handleClipboardPaste}
                className="flex flex-1 items-center justify-center gap-2 border-r border-[var(--mod-border)] px-4 py-3 text-sm text-[var(--mod-text-muted)] hover:bg-[var(--mod-surface-hover)]"
              >
                <IconClipboard size={16} />
                Paste image
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "BEGIN_URL" })}
                className="flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm text-[var(--mod-text-muted)] hover:bg-[var(--mod-surface-hover)]"
              >
                Add a link →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {!state.completed && state.step === 2 && fileMode && (
          <div>
            <p className="mb-3 text-sm text-[var(--mod-text-muted)]">
              {state.files.length} file{state.files.length === 1 ? "" : "s"}{" "}
              queued. Add more if needed.
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                dispatch({ type: "SET_DRAG_OVER", dragOver: true });
              }}
              onDragLeave={() =>
                dispatch({ type: "SET_DRAG_OVER", dragOver: false })
              }
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed p-6 text-center transition-[background-color,border-color] duration-75 ${
                state.dragOver
                  ? "border-[var(--mono-400)] bg-[var(--mono-850)]"
                  : "border-[var(--mod-border)] hover:border-[var(--mod-border-hover)]"
              }`}
            >
              <p className="text-sm text-[var(--mod-text-muted)]">
                Drop files here or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.json,.log,.csv,.zip"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleFileSelect(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Paste from clipboard */}
            <button
              type="button"
              onClick={handleClipboardPaste}
              className="mt-2 flex w-full items-center justify-center gap-2 border border-dashed border-[var(--mod-border)] px-3 py-2 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:border-[var(--mod-border-hover)] hover:bg-[var(--mod-surface-hover)]"
            >
              <IconClipboard size={16} />
              Paste from clipboard
            </button>

            {/* File list */}
            {state.files.length > 0 && (
              <div className="mt-3 space-y-2">
                {state.files.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2"
                  >
                    {(() => {
                      const FileIcon =
                        EVIDENCE_TYPE_ICONS[inferFileType(entry.file)];
                      return (
                        <FileIcon
                          size={15}
                          className="shrink-0 text-[var(--mod-text-dim)]"
                        />
                      );
                    })()}
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--mono-white)]">
                      {entry.file.name}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--mod-text-dim)]">
                      {(entry.file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      onClick={() =>
                        dispatch({ type: "REMOVE_FILE", index: i })
                      }
                      className="shrink-0 text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!state.completed && state.step === 2 && urlMode && (
          <div>
            <p className="mb-3 text-sm text-[var(--mod-text-muted)]">
              Enter the{" "}
              {state.selectedType === "DISCORD_URL" ? "Discord message" : ""}{" "}
              URL:
            </p>
            <input
              type="url"
              value={state.urlInput}
              onChange={(e) =>
                dispatch({ type: "SET_URL", url: e.target.value })
              }
              placeholder={
                state.selectedType === "DISCORD_URL"
                  ? "https://discord.com/channels/..."
                  : "https://..."
              }
              className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
            />

            {/* OG preview */}
            {state.ogLoading && (
              <div className="mt-3 h-20 animate-pulse border border-[var(--mod-border)] bg-[var(--mod-surface)]" />
            )}
            {!state.ogLoading && state.ogPreview && (
              <div className="mt-3">
                <OGCard og={state.ogPreview} url={state.urlInput.trim()} />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Metadata */}
        {!state.completed && state.step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
                Description
              </label>
              <textarea
                value={state.description}
                onChange={(e) =>
                  dispatch({
                    type: "SET_DESCRIPTION",
                    description: e.target.value,
                  })
                }
                placeholder="Describe the evidence..."
                rows={3}
                className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
                Tags
              </label>
              <TagSelector
                value={state.tags}
                onChange={(tags) => dispatch({ type: "SET_TAGS", tags })}
              />
            </div>

            {/* Per-file metadata for multi-file uploads */}
            {fileMode && state.files.length > 1 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <button
                    onClick={() => dispatch({ type: "TOGGLE_APPLY_DESC_ALL" })}
                    className={`flex h-4 w-4 items-center justify-center border transition-[background-color,border-color] duration-75 ${
                      state.applyDescToAll
                        ? "border-[var(--mono-500)] bg-[var(--mono-700)]"
                        : "border-[var(--mod-border)]"
                    }`}
                  >
                    {state.applyDescToAll && (
                      <IconCheck
                        size={12}
                        className="text-[var(--mono-white)]"
                      />
                    )}
                  </button>
                  <span className="text-xs text-[var(--mod-text-muted)]">
                    Apply description to all files
                  </span>
                </div>

                {!state.applyDescToAll && (
                  <div className="space-y-2">
                    {state.files.map((entry, i) => (
                      <div key={i}>
                        <label className="mb-1 block text-xs text-[var(--mod-text-dim)]">
                          {entry.file.name}
                        </label>
                        <input
                          type="text"
                          value={entry.description}
                          onChange={(e) =>
                            dispatch({
                              type: "UPDATE_FILE_DESC",
                              index: i,
                              description: e.target.value,
                            })
                          }
                          placeholder="Description for this file..."
                          className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-xs text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* NSFW scanning indicator */}
            {state.nsfwScanning && (
              <div className="border border-[var(--mod-border)] bg-[var(--mono-950)] p-4 text-center text-sm text-[var(--mod-text-muted)]">
                Scanning images for NSFW content...
              </div>
            )}

            {/* NSFW warnings */}
            {state.nsfwFlags.length > 0 && (
              <div className="space-y-3">
                {state.nsfwFlags.map((flag) => (
                  <NsfwScanner
                    key={flag.fileIndex}
                    result={flag.result}
                    filename={
                      state.files[flag.fileIndex]?.file.name ?? "Unknown"
                    }
                    onConfirmSafe={() =>
                      dispatch({
                        type: "NSFW_DISMISS",
                        fileIndex: flag.fileIndex,
                      })
                    }
                    onReject={() =>
                      dispatch({ type: "REMOVE_FILE", index: flag.fileIndex })
                    }
                  />
                ))}
              </div>
            )}

            {/* Upload progress */}
            {state.uploadProgress.length > 0 && (
              <div className="space-y-2" aria-live="polite">
                {state.uploadProgress.map((p) => (
                  <div
                    key={p.index}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate text-[var(--mono-white)]">
                      {state.files[p.index]?.file.name}
                    </span>
                    <div className="h-1.5 w-24 bg-[var(--mono-800)]">
                      <div
                        className={`h-full transition-[width] duration-150 ${
                          p.status === "error"
                            ? "bg-red-500"
                            : p.status === "done"
                              ? "bg-green-500"
                              : "bg-[var(--mono-400)]"
                        }`}
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[var(--mod-text-dim)]">
                      {p.status === "pending" && "Queued"}
                      {p.status === "uploading" && "Uploading"}
                      {p.status === "hashing" && "Hashing"}
                      {p.status === "confirming" && "Verifying"}
                      {p.status === "done" && "Done"}
                      {p.status === "error" && (p.error ?? "Error")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {!state.completed && state.step > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--mod-border)] px-5 py-3">
          <button
            onClick={() => dispatch({ type: "PREV_STEP" })}
            disabled={state.step === 1 || state.uploading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--mod-text-muted)] hover:text-[var(--mono-white)] disabled:opacity-30"
          >
            <IconChevronLeft size={16} />
            Back
          </button>
          <div className="flex gap-2">
            {state.step < 3 && (
              <button
                onClick={() => dispatch({ type: "NEXT_STEP" })}
                disabled={!canAdvance()}
                className="flex items-center gap-1 border border-[var(--mod-border)] px-4 py-1.5 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] disabled:opacity-30"
              >
                Next
                <IconChevronRight size={16} />
              </button>
            )}
            {state.step === 3 && (
              <button
                onClick={handleUpload}
                disabled={
                  state.uploading ||
                  state.nsfwScanning ||
                  state.nsfwFlags.length > 0
                }
                className="flex items-center gap-1 border border-[var(--mono-500)] px-4 py-1.5 text-sm text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mono-800)] disabled:opacity-30"
              >
                <IconPlus size={16} />
                {state.nsfwScanning
                  ? "Scanning..."
                  : state.uploading
                    ? `Uploading ${state.files.length} item${state.files.length === 1 ? "" : "s"}...`
                    : `Upload ${urlMode ? "link" : `${state.files.length} item${state.files.length === 1 ? "" : "s"}`}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
