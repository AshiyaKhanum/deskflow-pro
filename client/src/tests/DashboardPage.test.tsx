import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import * as dashboardService from '../services/dashboardService';
import * as userService from '../services/userService';
import * as ticketService from '../services/ticketService';
import { DashboardStats, Ticket, User } from '../types';

vi.mock('../services/dashboardService');
vi.mock('../services/userService');
vi.mock('../services/ticketService');

const mockAssignableUsers: User[] = [
  { id: 'admin-1', name: 'John', email: 'john@example.com', role: 'admin', avatarColor: '#111', isActive: true, createdAt: '' },
  { id: 'agent-1', name: 'Sanu', email: 'sanu@example.com', role: 'agent', avatarColor: '#222', isActive: true, createdAt: '' },
  { id: 'customer-1', name: 'Ashiya', email: 'ashiya@example.com', role: 'customer', avatarColor: '#333', isActive: true, createdAt: '' },
];

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userService.listAssignableUsers).mockResolvedValue(mockAssignableUsers);
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
    });
  });

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

  it('lets you filter "Tickets by assignee" to any role - Admin, Agent, or Customer - fetched from the database', async () => {
    vi.mocked(dashboardService.getDashboardStats).mockResolvedValue(mockStats);
    const johnsTicket: Ticket = {
      _id: 't-john',
      ticketNumber: 2001,
      title: "John's escalation",
      description: 'x',
      customer: { _id: 'c1', name: 'Someone', email: 's@example.com' },
      assignedAgent: { _id: 'admin-1', name: 'John', email: 'john@example.com', role: 'admin' },
      priority: 'high',
      status: 'open',
      category: 'general',
      slaDueAt: new Date().toISOString(),
      slaBreached: false,
      slaStatus: 'within_sla',
      history: [],
      resolvedAt: null,
      closedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [johnsTicket],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Operations Dashboard')).toBeInTheDocument());

    // The dropdown must offer every role, labeled, and never hard-coded.
    expect(screen.getByRole('option', { name: 'John - Admin' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sanu - Agent' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ashiya - Customer' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/filter by assignee/i), 'admin-1');

    await waitFor(() => expect(screen.getByText(/john's escalation/i)).toBeInTheDocument());
    expect(ticketService.listTickets).toHaveBeenCalledWith(
      expect.objectContaining({ assignedAgent: 'admin-1' }),
    );
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
