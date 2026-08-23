import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { Evidence } from '@/lib/mod-types';

// Hoisted mocks
const { mockGetEvidenceDownloadUrl, mockAmendEvidence } = vi.hoisted(() => ({
  mockGetEvidenceDownloadUrl: vi.fn(),
  mockAmendEvidence: vi.fn(),
}));

vi.mock('@/lib/mod-types', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/mod-types')>();
  return {
    ...orig,
    EVIDENCE_TYPE_META: {
      IMAGE: { label: 'Image', className: 'text-blue-400' },
      VIDEO: { label: 'Video', className: 'text-purple-400' },
      URL: { label: 'URL', className: 'text-green-400' },
      AUDIO: { label: 'Audio', className: 'text-yellow-400' },
      DOCUMENT: { label: 'Document', className: 'text-gray-400' },
      DISCORD_URL: { label: 'Discord URL', className: 'text-indigo-400' },
      MESSAGE_SNAPSHOT: { label: 'Snapshot', className: 'text-cyan-400' },
    },
    EVIDENCE_STATUS_META: {
      VERIFIED: { label: 'Verified', className: 'text-green-400' },
      PENDING: { label: 'Pending', className: 'text-yellow-400' },
      FLAGGED: { label: 'Flagged', className: 'text-red-400' },
      PROCESSING: { label: 'Processing', className: 'text-blue-400' },
      REJECTED: { label: 'Rejected', className: 'text-red-400' },
    },
  };
});

// Simple icon component factory
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
  IconEye: Icon('eye'),
  IconHistory: Icon('history'),
  IconDownload: Icon('download'),
  IconPencil: Icon('pencil'),
  IconX: Icon('x'),
  IconFlag: Icon('flag'),
  IconNote: Icon('note'),
  IconCheck: Icon('check'),
  IconGrid: Icon('grid'),
  IconList: Icon('list'),
  IconCompare: Icon('compare'),
}));

vi.mock('@/lib/services/mod.service', () => ({
  getEvidenceDownloadUrl: mockGetEvidenceDownloadUrl,
  amendEvidence: mockAmendEvidence,
}));

vi.mock('@/hooks/use-mod-shortcuts', () => ({
  useModShortcuts: vi.fn(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/use-long-press', () => ({
  useLongPress: () => ({
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
    onPointerLeave: vi.fn(),
    onClick: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-swipe', () => ({
  useSwipe: () => ({
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
  }),
}));

vi.mock('@/components/mod/evidence-viewer', () => ({
  EvidenceViewer: () => <div data-testid="evidence-viewer" />,
}));

vi.mock('@/components/mod/evidence-history', () => ({
  EvidenceHistory: () => <div data-testid="evidence-history" />,
}));

vi.mock('@/components/mod/evidence-comparison', () => ({
  EvidenceComparison: () => <div data-testid="evidence-comparison" />,
}));

vi.mock('@/components/mod/shortcut-help', () => ({
  ShortcutHelp: () => null,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span />,
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

// Import after all mocks
const { EvidenceGallery } = await import('@/components/mod/evidence-gallery');

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
    contentHash: 'abc123',
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

/** Find the selection checkbox button (the small absolute-positioned one) */
function findSelectionButton(): HTMLElement {
  const buttons = screen.getAllByRole('button');
  const actionTexts = ['View', 'History', 'Amend', 'Download'];
  const btn = buttons.find(
    (b) => !actionTexts.some((t) => b.textContent?.includes(t)) && !b.title
  );
  if (!btn) throw new Error('Selection button not found');
  return btn;
}

describe('EvidenceGallery', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows empty state when evidence array is empty', () => {
    render(<EvidenceGallery evidence={[]} guildId="guild-123" />);
    expect(screen.getByText('No evidence has been added yet.')).toBeInTheDocument();
  });

  it('renders evidence items with filenames', () => {
    const items = [
      makeEvidence({ id: 'ev-1', originalFilename: 'photo1.png' }),
      makeEvidence({ id: 'ev-2', originalFilename: 'photo2.png', type: 'VIDEO' }),
    ];

    render(<EvidenceGallery evidence={items} guildId="guild-123" />);

    expect(screen.getByText('photo1.png')).toBeInTheDocument();
    expect(screen.getByText('photo2.png')).toBeInTheDocument();
  });

  it('renders action buttons per evidence card', () => {
    render(<EvidenceGallery evidence={[makeEvidence()]} guildId="guild-123" />);

    // Single item should have one of each action
    expect(screen.getAllByText('View')).toHaveLength(1);
    expect(screen.getAllByText('History')).toHaveLength(1);
    expect(screen.getAllByText('Amend')).toHaveLength(1);
    expect(screen.getAllByText('Download')).toHaveLength(1);
  });

  it('shows Download button only for items with storageKey', () => {
    const items = [
      makeEvidence({ id: 'ev-1', storageKey: 'key.png' }),
      makeEvidence({ id: 'ev-2', storageKey: null, url: 'https://example.com' }),
    ];

    render(<EvidenceGallery evidence={items} guildId="guild-123" />);

    // Only 1 Download button (first item has storageKey, second doesn't)
    expect(screen.getAllByText('Download')).toHaveLength(1);
  });

  it('toggles selection checkbox on click', () => {
    render(<EvidenceGallery evidence={[makeEvidence()]} guildId="guild-123" />);

    expect(screen.queryByTestId('icon-check')).not.toBeInTheDocument();

    fireEvent.click(findSelectionButton());

    expect(screen.getByTestId('icon-check')).toBeInTheDocument();
  });

  it('shows bulk action bar when items are selected', () => {
    render(<EvidenceGallery evidence={[makeEvidence()]} guildId="guild-123" />);

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    fireEvent.click(findSelectionButton());

    expect(screen.getAllByText('1 selected').length).toBeGreaterThan(0);
  });

  it('opens viewer when View button is clicked', () => {
    render(<EvidenceGallery evidence={[makeEvidence()]} guildId="guild-123" />);

    fireEvent.click(screen.getByText('View'));

    expect(screen.getByTestId('evidence-viewer')).toBeInTheDocument();
  });

  it('opens history when History button is clicked', () => {
    render(<EvidenceGallery evidence={[makeEvidence()]} guildId="guild-123" />);

    fireEvent.click(screen.getByText('History'));

    expect(screen.getByTestId('evidence-history')).toBeInTheDocument();
  });

  it('shows inline amend form when Amend is clicked', () => {
    render(<EvidenceGallery evidence={[makeEvidence()]} guildId="guild-123" />);

    fireEvent.click(screen.getByText('Amend'));

    expect(screen.getByText('Amend Evidence')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Reason...')).toBeInTheDocument();
  });

  it('triggers download via service call', async () => {
    mockGetEvidenceDownloadUrl.mockResolvedValue('https://download.example.com/file.png');
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<EvidenceGallery evidence={[makeEvidence()]} guildId="guild-123" />);
    fireEvent.click(screen.getByText('Download'));

    await waitFor(() => {
      expect(mockGetEvidenceDownloadUrl).toHaveBeenCalledWith('guild-123', 'ev-1');
    });
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('https://download.example.com/file.png', '_blank');
    });

    openSpy.mockRestore();
  });

  it('displays tags on evidence items', () => {
    const item = makeEvidence({ tags: ['important', 'review', 'urgent'] });
    render(<EvidenceGallery evidence={[item]} guildId="guild-123" />);

    expect(screen.getByText('important')).toBeInTheDocument();
    expect(screen.getByText('review')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('truncates tags beyond 3 with overflow indicator', () => {
    const item = makeEvidence({ tags: ['a', 'b', 'c', 'd', 'e'] });
    render(<EvidenceGallery evidence={[item]} guildId="guild-123" />);

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('submits amend form with reason', async () => {
    mockAmendEvidence.mockResolvedValue({});
    const onUpdated = vi.fn();

    render(
      <EvidenceGallery evidence={[makeEvidence()]} guildId="guild-123" onEvidenceUpdated={onUpdated} />
    );

    fireEvent.click(screen.getByText('Amend'));
    fireEvent.change(screen.getByPlaceholderText('Reason...'), {
      target: { value: 'Test reason' },
    });
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockAmendEvidence).toHaveBeenCalledWith('guild-123', 'ev-1', {
        action: 'NOTE_ADDED',
        newValue: undefined,
        reason: 'Test reason',
      });
    });
  });
});
