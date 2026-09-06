import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { TicketListPage } from '../pages/TicketListPage';
import { ToastProvider } from '../context/ToastContext';
import * as ticketService from '../services/ticketService';
import * as userService from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { Ticket, User } from '../types';

vi.mock('../services/ticketService');
vi.mock('../services/userService');
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

const mockAssignableUsers: User[] = [
  { id: 'a1', name: 'Jordan Blake', email: 'jordan@example.com', role: 'agent', avatarColor: '#111', isActive: true, createdAt: '' },
  { id: 'a2', name: 'Priya Nair', email: 'priya@example.com', role: 'agent', avatarColor: '#222', isActive: true, createdAt: '' },
];

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
      <ToastProvider>
        <TicketListPage />
      </ToastProvider>
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
    vi.mocked(userService.listAssignableUsers).mockResolvedValue(mockAssignableUsers);
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

  it('lets an agent reassign a ticket right from the list, without opening it', async () => {
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [mockTicket],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    vi.mocked(ticketService.updateTicket).mockResolvedValue({
      ...mockTicket,
      assignedAgent: { _id: 'a2', name: 'Priya Nair', email: 'priya@example.com' },
    });

    renderPage('agent');
    const assigneeSelect = await screen.findByLabelText(/assignee for ticket #1001/i);
    await userEvent.selectOptions(assigneeSelect, 'a2');

    await waitFor(() =>
      expect(ticketService.updateTicket).toHaveBeenCalledWith('t1', { assignedAgent: 'a2' }),
    );
    expect(await screen.findByText(/reassigned/i)).toBeInTheDocument();
  });

  it('also lets a customer reassign their own ticket right from the list', async () => {
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [{ ...mockTicket, assignedAgent: { _id: 'a1', name: 'Jordan Blake', email: 'jordan@example.com', role: 'agent' } }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    vi.mocked(ticketService.updateTicket).mockResolvedValue({
      ...mockTicket,
      assignedAgent: { _id: 'a2', name: 'Priya Nair', email: 'priya@example.com' },
    });

    renderPage('customer');
    const assigneeSelect = await screen.findByLabelText(/assignee for ticket #1001/i);
    await userEvent.selectOptions(assigneeSelect, 'a2');

    await waitFor(() =>
      expect(ticketService.updateTicket).toHaveBeenCalledWith('t1', { assignedAgent: 'a2' }),
    );
  });

  it('uses "Please select" as the unassigned placeholder, not "Unassigned"', async () => {
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [mockTicket],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    renderPage('agent');
    const assigneeSelect = await screen.findByLabelText(/assignee for ticket #1001/i);
    expect(screen.getByRole('option', { name: 'Please select' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Unassigned' })).not.toBeInTheDocument();
    // The ticket has no assignee, so the placeholder option is the selected one.
    expect((assigneeSelect as HTMLSelectElement).value).toBe('');
  });

  it('hides the reassignment dropdown entirely when there is nobody eligible to assign - shows plain text instead', async () => {
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [{ ...mockTicket, assignedAgent: { _id: 'a1', name: 'Jordan Blake', email: 'jordan@example.com', role: 'agent' } }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    vi.mocked(userService.listAssignableUsers).mockResolvedValue([]);

    renderPage('agent');
    await waitFor(() => expect(screen.getByText(/jordan blake/i)).toBeInTheDocument());
    expect(screen.queryByLabelText(/assignee for ticket/i)).not.toBeInTheDocument();
  });

  it("still shows the ticket's current assignee correctly even if they've since dropped out of the eligible pool", async () => {
    // e.g. deactivated after being assigned - the dropdown's value must still match a
    // real option instead of silently looking unassigned.
    vi.mocked(ticketService.listTickets).mockResolvedValue({
      tickets: [{ ...mockTicket, assignedAgent: { _id: 'gone', name: 'Former Agent', email: 'former@example.com', role: 'agent' } }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    renderPage('agent');
    const assigneeSelect = await screen.findByLabelText(/assignee for ticket #1001/i);
    expect((assigneeSelect as HTMLSelectElement).value).toBe('gone');
    expect(screen.getByRole('option', { name: /former agent.*no longer eligible/i })).toBeInTheDocument();
  });
});
