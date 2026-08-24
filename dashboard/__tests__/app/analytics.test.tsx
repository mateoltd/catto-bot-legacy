import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ALL mock state must be hoisted since vi.mock factory runs before module initialization
const { mockUseParams, mockUseSWR } = vi.hoisted(() => {
  const mockUseParams = vi.fn(() => ({ guildId: 'guild-123' }));
  const mockUseSWR = vi.fn();

  return { mockUseParams, mockUseSWR };
});

vi.mock('next/navigation', () => ({
  useParams: mockUseParams,
}));

vi.mock('swr', () => ({
  default: mockUseSWR,
}));

vi.mock('@/lib/services/mod.service', () => ({
  getEvidenceAnalytics: vi.fn(),
  getCaseAnalytics: vi.fn(),
}));

vi.mock('@/lib/mod-types', () => ({
  EVIDENCE_TYPE_META: {
    IMAGE: { label: 'Image', icon: 'photo', className: 'type-image' },
    VIDEO: { label: 'Video', icon: 'video', className: 'type-video' },
    URL: { label: 'URL', icon: 'link', className: 'type-url' },
  },
}));

vi.mock('recharts', () => ({
  LineChart: (props: any) => <div data-testid="line-chart">{props.children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: (props: any) => <div data-testid="responsive-container">{props.children}</div>,
  PieChart: (props: any) => <div data-testid="pie-chart">{props.children}</div>,
  Pie: (props: any) => <div data-testid="pie">{props.children}</div>,
  Cell: () => <div data-testid="cell" />,
}));

import AnalyticsPage from '@/app/mod/(protected)/[guildId]/analytics/page';

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows loading state during data fetch', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: true });

    render(<AnalyticsPage />);

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false });

    render(<AnalyticsPage />);

    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Analytics will appear here once moderation cases and evidence are created in this server.'
      )
    ).toBeInTheDocument();
  });

  it('shows summary cards with data', () => {
    mockUseSWR.mockImplementation((key: string[]) => {
      if (key[0] === 'evidence-analytics') {
        return {
          data: {
            byType: { IMAGE: 10, VIDEO: 5 },
            storageUsage: { totalBytes: 1048576 },
            flaggedRate: 0.123,
            volumeOverTime: [],
            topUploaders: [],
          },
          isLoading: false,
        };
      }
      if (key[0] === 'case-analytics') {
        return {
          data: {
            byAction: { BAN: 3, WARN: 7 },
            volumeOverTime: [],
          },
          isLoading: false,
        };
      }
      return { data: undefined, isLoading: false };
    });

    render(<AnalyticsPage />);

    expect(screen.getByText('Total Evidence')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();

    expect(screen.getByText('Total Cases')).toBeInTheDocument();
    // "10" appears in both the stat card and the pie chart legend, so use getAllByText
    const tens = screen.getAllByText('10');
    expect(tens.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Storage Used')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();

    expect(screen.getByText('Flagged Rate')).toBeInTheDocument();
    expect(screen.getByText('12.3%')).toBeInTheDocument();
  });

  it('period selector buttons render', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false });

    render(<AnalyticsPage />);

    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();
  });

  it('clicking period button changes active selection', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false });

    render(<AnalyticsPage />);

    const btn7d = screen.getByText('7d');
    const btn30d = screen.getByText('30d');

    // 30d is the default active period
    expect(btn30d.className).toContain('border-[var(--mono-500)]');
    expect(btn7d.className).not.toContain('border-[var(--mono-500)]');

    // Click 7d
    fireEvent.click(btn7d);

    expect(btn7d.className).toContain('border-[var(--mono-500)]');
    expect(btn30d.className).not.toContain('border-[var(--mono-500)]');
  });
});
