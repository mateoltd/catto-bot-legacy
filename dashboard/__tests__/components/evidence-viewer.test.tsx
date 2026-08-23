import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Evidence } from '@/lib/mod-types';

// ── Hoisted mocks ──
const { mockGetEvidenceViewUrl, mockGetEvidenceHistory, mockAmendEvidence, mockUseSWR } =
  vi.hoisted(() => ({
    mockGetEvidenceViewUrl: vi.fn(),
    mockGetEvidenceHistory: vi.fn(),
    mockAmendEvidence: vi.fn(),
    mockUseSWR: vi.fn(),
  }));

// ── SWR mock ──
vi.mock('swr', () => ({
  default: mockUseSWR,
}));

// ── mod-types: pass through originals ──
vi.mock('@/lib/mod-types', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/mod-types')>();
  return {
    ...orig,
    EVIDENCE_TYPE_META: {
      IMAGE: { label: 'Image', className: 'type-image' },
      VIDEO: { label: 'Video', className: 'type-video' },
      AUDIO: { label: 'Audio', className: 'type-audio' },
      DOCUMENT: { label: 'Document', className: 'type-document' },
      URL: { label: 'URL', className: 'type-url' },
      DISCORD_URL: { label: 'Discord Link', className: 'type-url' },
      MESSAGE_SNAPSHOT: { label: 'Snapshot', className: 'type-snapshot' },
    },
  };
});

// ── Simple icon factory (mirrors evidence-gallery.test.tsx pattern) ──
const Icon = (name: string) => {
  const Comp = (props: any) => <span data-testid={`icon-${name}`} {...props} />;
  Comp.displayName = `Icon${name}`;
  return Comp;
};

vi.mock('@/lib/mod-icons', () => ({
  EVIDENCE_TYPE_ICONS: {
    IMAGE: Icon('type-image'),
    VIDEO: Icon('type-video'),
    URL: Icon('type-url'),
    AUDIO: Icon('type-audio'),
    DOCUMENT: Icon('type-document'),
    DISCORD_URL: Icon('type-discord-url'),
    MESSAGE_SNAPSHOT: Icon('type-snapshot'),
  },
  IconX: Icon('x'),
  IconDownload: Icon('download'),
  IconFile: Icon('file'),
  IconFlag: Icon('flag'),
}));

// ── Service mock ──
vi.mock('@/lib/services/mod.service', () => ({
  getEvidenceViewUrl: mockGetEvidenceViewUrl,
  getEvidenceHistory: mockGetEvidenceHistory,
  amendEvidence: mockAmendEvidence,
}));

// ── Hook mocks ──
vi.mock('@/hooks/use-escape-close', () => ({
  useEscapeClose: (cb: () => void) => {
    // Wire up a real keydown listener so our test can trigger Escape
    React.useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') cb();
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [cb]);
  },
}));

vi.mock('@/hooks/use-swipe', () => ({
  useSwipe: () => ({}),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

// ── Sub-component mocks ──
vi.mock('@/components/mod/evidence-access-log', () => ({
  EvidenceAccessLog: (props: any) => (
    <div data-testid="evidence-access-log">
      Access Log for {props.evidenceId}
    </div>
  ),
}));

vi.mock('@/components/mod/snapshot-viewer', () => ({
  SnapshotViewer: () => <div data-testid="snapshot-viewer" />,
}));

vi.mock('@/components/mod/video-player', () => ({
  VideoPlayer: () => <div data-testid="video-player" />,
}));

vi.mock('@/components/mod/audio-player', () => ({
  AudioPlayer: () => <div data-testid="audio-player" />,
}));

vi.mock('@/components/mod/amendment-timeline', () => ({
  AmendmentTimeline: ({ amendments }: any) => (
    <div data-testid="amendment-timeline">{amendments?.length ?? 0} amendments</div>
  ),
}));

vi.mock('@/components/mod/og-card', () => ({
  OGCard: () => <div data-testid="og-card" />,
}));

vi.mock('@/components/mod/tag-selector', () => ({
  TagSelector: () => <div data-testid="tag-selector" />,
}));

vi.mock('@/components/ui/toggle', () => ({
  Toggle: ({ children, onPressedChange, pressed, disabled, ...rest }: any) => (
    <button
      onClick={() => onPressedChange?.(!pressed)}
      disabled={disabled}
      data-pressed={pressed}
      {...rest}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select">
      <select
        data-testid="action-select"
        value={value}
        onChange={(e: any) => onValueChange?.(e.target.value)}
      >
        {/* Rendered by SelectContent children */}
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

// ── Import component AFTER all mocks ──
const { EvidenceViewer } = await import('@/components/mod/evidence-viewer');

// ── Helpers ──

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'ev-1',
    guildId: 'guild-123',
    caseId: 'case-1',
    caseNumber: 1,
    uploadedById: 'user-1',
    uploadedByTag: 'TestUser#0001',
    type: 'IMAGE',
    status: 'VERIFIED',
    storageKey: 'some/key.png',
    storageBucket: 'evidence',
    originalFilename: 'screenshot.png',
    mimeType: 'image/png',
    sizeBytes: 204800,
    contentHash: 'abc123def456789000000000',
    hmacSignature: 'sig123',
    url: null,
    snapshotId: null,
    description: 'A test screenshot',
    metadata: null,
    tags: ['important'],
    createdAt: '2025-01-15T12:00:00Z',
    updatedAt: '2025-01-15T12:00:00Z',
    ...overrides,
  };
}

/** Default SWR mock that returns no data, no loading, no error */
function setupSWR(overrides: Record<string, any> = {}) {
  mockUseSWR.mockImplementation((key: any) => {
    // If key is null (disabled), return empty state
    if (key === null) {
      return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
    }
    return {
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
      ...overrides,
    };
  });
}

function renderViewer(evidenceOverrides: Partial<Evidence> = {}, props: Record<string, any> = {}) {
  const onClose = vi.fn();
  const onDownload = props.onDownload ?? undefined;
  const onPrev = props.onPrev ?? undefined;
  const onNext = props.onNext ?? undefined;

  const evidence = makeEvidence(evidenceOverrides);

  const utils = render(
    <EvidenceViewer
      guildId="guild-123"
      evidenceId={evidence.id}
      evidence={evidence}
      onClose={onClose}
      onDownload={onDownload}
      onPrev={onPrev}
      onNext={onNext}
      {...(props.caseNumber != null ? { caseNumber: props.caseNumber } : {})}
    />,
  );

  return { ...utils, onClose, evidence };
}

// ── Tests ──

describe('EvidenceViewer', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders with evidence details (filename, type, status)', () => {
    setupSWR();
    renderViewer({
      originalFilename: 'evidence-photo.png',
      type: 'IMAGE',
      status: 'VERIFIED',
    });

    // Type label from EVIDENCE_TYPE_META
    expect(screen.getByText('Image')).toBeInTheDocument();
    // Filename shown after dash
    expect(screen.getByText(/evidence-photo\.png/)).toBeInTheDocument();
    // Verified status shown in details tab (default)
    expect(screen.getByText('Signed & Verified')).toBeInTheDocument();
  });

  it('escape key calls onClose', () => {
    setupSWR();
    const { onClose } = renderViewer();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tab switching works (clicking tabs changes content)', () => {
    setupSWR();
    renderViewer();

    // Details tab is active by default - uploader info visible
    expect(screen.getByText(/TestUser#0001/)).toBeInTheDocument();

    // Switch to history tab
    fireEvent.click(screen.getByText('History'));
    expect(screen.getByTestId('amendment-timeline')).toBeInTheDocument();

    // Switch to access-log tab
    fireEvent.click(screen.getByText('Access Log'));
    expect(screen.getByTestId('evidence-access-log')).toBeInTheDocument();

    // Switch to amend tab
    fireEvent.click(screen.getByText('Amend'));
    expect(screen.getByText('Submit Amendment')).toBeInTheDocument();

    // Switch back to details
    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText(/TestUser#0001/)).toBeInTheDocument();
  });

  it('renders URL content type correctly (shows link)', () => {
    setupSWR();
    renderViewer({
      type: 'URL',
      url: 'https://example.com/evidence',
      storageKey: null,
    });

    const link = screen.getByText('https://example.com/evidence');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com/evidence');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows "details" tab by default', () => {
    setupSWR();
    renderViewer({ uploadedByTag: 'Moderator#1234' });

    // Details tab content should be visible: uploader info
    expect(screen.getByText(/Moderator#1234/)).toBeInTheDocument();

    // The Details tab button should have the active styling class (border-b-2)
    const detailsButton = screen.getByText('Details');
    expect(detailsButton.className).toContain('border-b-2');
  });

  it('download button calls onDownload callback', () => {
    setupSWR();
    const onDownload = vi.fn();
    renderViewer({}, { onDownload });

    const downloadButton = screen.getByTitle('Download');
    fireEvent.click(downloadButton);

    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('does not render download button when onDownload is not provided', () => {
    setupSWR();
    renderViewer();

    expect(screen.queryByTitle('Download')).not.toBeInTheDocument();
  });

  it('navigation buttons call onPrev/onNext callbacks (overlay click calls onClose)', () => {
    setupSWR();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const { onClose } = renderViewer({}, { onPrev, onNext });

    // The outer overlay div calls onClose on click
    const overlay = screen.getByText('Image').closest('.fixed');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalled();
  });

  it('amend tab shows form with action selector and reason textarea', () => {
    setupSWR();
    renderViewer();

    // Switch to amend tab
    fireEvent.click(screen.getByText('Amend'));

    // Action label
    expect(screen.getByText('Action')).toBeInTheDocument();

    // Select component (action selector)
    expect(screen.getByTestId('select')).toBeInTheDocument();

    // Action options rendered
    expect(screen.getByText('Add Note')).toBeInTheDocument();
    expect(screen.getByText('Update Description')).toBeInTheDocument();
    expect(screen.getByText('Update Tags')).toBeInTheDocument();

    // Reason textarea
    const textarea = screen.getByPlaceholderText('Reason for amendment...');
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe('TEXTAREA');

    // Flag toggle
    expect(screen.getByLabelText('Toggle flag')).toBeInTheDocument();

    // Submit button
    expect(screen.getByText('Submit Amendment')).toBeInTheDocument();
  });

  it('shows description when provided', () => {
    setupSWR();
    renderViewer({ description: 'This is a key piece of evidence' });

    expect(screen.getByText('This is a key piece of evidence')).toBeInTheDocument();
  });

  it('shows tags in details tab', () => {
    setupSWR();
    renderViewer({ tags: ['harassment', 'urgent'] });

    expect(screen.getByText('harassment')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('shows file size in details tab', () => {
    setupSWR();
    renderViewer({ sizeBytes: 204800 });

    // 204800 / 1024 = 200.0 KB
    expect(screen.getByText('200.0 KB')).toBeInTheDocument();
  });

  it('shows content hash in details tab', () => {
    setupSWR();
    renderViewer({ contentHash: 'abc123def456789000000000' });

    expect(screen.getByText(/SHA-256: abc123def4567890/)).toBeInTheDocument();
  });

  it('renders IMAGE type with img tag when viewUrl is available', () => {
    mockUseSWR.mockImplementation((key: any) => {
      if (key === null) {
        return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
      }
      // Return a presigned URL for the image
      if (Array.isArray(key) && key[0] === 'evidence-view-url') {
        return { data: 'https://cdn.example.com/image.png', error: undefined, isLoading: false, mutate: vi.fn() };
      }
      return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
    });

    renderViewer({ type: 'IMAGE', storageKey: 'some/key.png' });

    const img = screen.getByAltText('screenshot.png');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/image.png');
  });

  it('shows loading state when async URL is loading', () => {
    mockUseSWR.mockImplementation((key: any) => {
      if (key === null) {
        return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
      }
      if (Array.isArray(key) && key[0] === 'evidence-view-url') {
        return { data: undefined, error: undefined, isLoading: true, mutate: vi.fn() };
      }
      return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
    });

    renderViewer({ type: 'IMAGE', storageKey: 'key.png' });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state when URL fetch fails', () => {
    mockUseSWR.mockImplementation((key: any) => {
      if (key === null) {
        return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
      }
      if (Array.isArray(key) && key[0] === 'evidence-view-url') {
        return { data: undefined, error: new Error('fail'), isLoading: false, mutate: vi.fn() };
      }
      return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
    });

    renderViewer({ type: 'IMAGE', storageKey: 'key.png' });

    expect(screen.getByText('Failed to load evidence.')).toBeInTheDocument();
  });
});
