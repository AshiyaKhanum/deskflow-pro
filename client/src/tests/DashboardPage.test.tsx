import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import * as dashboardService from '../services/dashboardService';
import { DashboardStats } from '../types';

vi.mock('../services/dashboardService');

const mockStats: DashboardStats = {
  statusCounts: { total: 10, open: 4, in_progress: 2, pending: 1, resolved: 2, closed: 1 },
  priorityBreakdown: { low: 2, medium: 4, high: 3, urgent: 1 },
  sla: {
    breachedOpenCount: 1,
    dueSoonCount: 2,
    totalOpenCount: 7,
    slaComplianceRate: 85.5,
    resolvedWithinSlaCount: 3,
    resolvedCount: 3,
  },
  performance: {
    ticketsCreated: 10,
    ticketsResolved: 3,
    ticketsCurrentlyOpen: 7,
    averageResolutionHours: 12.4,
    rangeDays: 30,
  },
  agentWorkload: [
    { agentId: 'a1', name: 'Jordan Blake', email: 'jordan@example.com', isActive: true, assignedCount: 5, openCount: 3, resolvedCount: 2, breachedCount: 1 },
  ],
  recentActivity: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders real statistics returned by the API, not hard-coded numbers', async () => {
    vi.mocked(dashboardService.getDashboardStats).mockResolvedValue(mockStats);
    renderPage();

    await waitFor(() => expect(screen.getByText('Operations Dashboard')).toBeInTheDocument());
    // "10" appears more than once (total tickets AND tickets-created-in-range both equal
    // 10 in this fixture) - asserting at least one confirms it renders the real API value
    // rather than nothing/undefined, without being brittle about exactly where.
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.getByText('85.5%')).toBeInTheDocument(); // SLA compliance
    expect(screen.getByText('Jordan Blake')).toBeInTheDocument();
  });

  it('shows an error state when the stats request fails', async () => {
    vi.mocked(dashboardService.getDashboardStats).mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Forbidden' } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('has no detectable accessibility violations once loaded', async () => {
    vi.mocked(dashboardService.getDashboardStats).mockResolvedValue(mockStats);
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText('Operations Dashboard')).toBeInTheDocument());
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
