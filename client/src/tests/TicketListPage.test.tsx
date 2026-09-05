import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { TicketListPage } from '../pages/TicketListPage';
import * as ticketService from '../services/ticketService';
import { useAuth } from '../context/AuthContext';
import { Ticket } from '../types';

vi.mock('../services/ticketService');
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockTicket: Ticket = {
  _id: 't1',
  ticketNumber: 1001,
  title: 'Cannot log in',
  description: 'Details',
  customer: { _id: 'c1', name: 'Sam Rivera', email: 'sam@example.com' },
  assignedAgent: null,
  priority: 'high',
  status: 'open',
  category: 'account',
  slaDueAt: new Date(Date.now() + 3600_000).toISOString(),
  slaBreached: false,
  slaStatus: 'within_sla',
  history: [],
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderPage(role: 'customer' | 'agent' | 'admin' = 'customer') {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'c1', name: 'Sam Rivera', email: 'sam@example.com', role, avatarColor: '#000', isActive: true, createdAt: '' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });

  return render(
    <MemoryRouter>
      <TicketListPage />
    </MemoryRouter>,
  );
}

describe('TicketListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });
  });

  it('shows a loading state, then renders ticket rows', async () => {
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [mockTicket],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText(/cannot log in/i)).toBeInTheDocument());
    expect(screen.getByText(/showing 1–1 of 1/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no tickets', async () => {
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText(/no tickets found/i)).toBeInTheDocument());
  });

  it('shows an error state with a retry option when the request fails', async () => {
    vi.mocked(ticketService.listTickets).mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Server error' } },
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('has no detectable accessibility violations once loaded', async () => {
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [mockTicket],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText(/cannot log in/i)).toBeInTheDocument());
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows the "+ New Ticket" shortcut for a customer', async () => {
    renderPage('customer');
    await waitFor(() => expect(screen.getByText('Tickets')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /\+ new ticket/i })).toBeInTheDocument();
  });

  it('shows the "+ New Ticket" shortcut for an agent, who can now file tickets too', async () => {
    renderPage('agent');
    await waitFor(() => expect(screen.getByText('Tickets')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /\+ new ticket/i })).toBeInTheDocument();
  });

  it('hides the "+ New Ticket" shortcut for an admin, who cannot file tickets', async () => {
    renderPage('admin');
    await waitFor(() => expect(screen.getByText('Tickets')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /\+ new ticket/i })).not.toBeInTheDocument();
  });
});
