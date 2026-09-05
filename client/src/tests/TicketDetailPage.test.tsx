import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailPage } from '../pages/TicketDetailPage';
import * as ticketService from '../services/ticketService';
import * as userService from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { Comment, Ticket } from '../types';

vi.mock('../services/ticketService');
vi.mock('../services/userService');
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockTicket: Ticket = {
  _id: 't1',
  ticketNumber: 1001,
  title: 'Export produces garbled characters',
  description: 'CSV export shows garbled accented characters.',
  customer: { _id: 'c1', name: 'Sam Rivera', email: 'sam@example.com' },
  assignedAgent: { _id: 'a1', name: 'Jordan Blake', email: 'jordan@example.com' },
  priority: 'medium',
  status: 'in_progress',
  category: 'bug',
  slaDueAt: new Date(Date.now() + 3600_000).toISOString(),
  slaBreached: false,
  slaStatus: 'within_sla',
  history: [],
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const publicComment: Comment = {
  _id: 'cm1',
  ticket: 't1',
  author: { _id: 'c1', name: 'Sam Rivera', role: 'customer', avatarColor: '#000' },
  body: 'Any update on this?',
  visibility: 'public',
  createdAt: new Date().toISOString(),
};

function renderPage(role: 'customer' | 'agent' | 'admin' = 'customer') {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: role === 'customer' ? 'c1' : 'a1', name: 'Test User', email: 'test@example.com', role, avatarColor: '#000', isActive: true, createdAt: '' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={['/tickets/t1']}>
      <ToastProvider>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('TicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ticketService.getTicket).mockResolvedValue(mockTicket);
    vi.mocked(ticketService.listComments).mockResolvedValue([publicComment]);
    vi.mocked(userService.listAssignableUsers).mockResolvedValue([]);
  });

  it('renders ticket details and public comments for a customer', async () => {
    renderPage('customer');
    await waitFor(() => expect(screen.getByText(/export produces garbled characters/i)).toBeInTheDocument());
    expect(screen.getByText(/any update on this/i)).toBeInTheDocument();
    // Customers never see workflow status-change controls.
    expect(screen.queryByText(/move to/i)).not.toBeInTheDocument();
  });

  it('shows status transition controls and internal-note option for an agent', async () => {
    renderPage('agent');
    await waitFor(() => expect(screen.getByText(/export produces garbled characters/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /move to pending/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move to resolved/i })).toBeInTheDocument();
    // in_progress -> open is not a valid transition, so it must not be offered.
    expect(screen.queryByRole('button', { name: /move to open/i })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /internal note \(team only\)/i })).toBeInTheDocument();
  });

  it('visually distinguishes internal notes from public comments', async () => {
    vi.mocked(ticketService.listComments).mockResolvedValue([
      publicComment,
      {
        _id: 'cm2',
        ticket: 't1',
        author: { _id: 'a1', name: 'Jordan Blake', role: 'agent', avatarColor: '#111' },
        body: 'Internal: escalating to engineering.',
        visibility: 'internal',
        createdAt: new Date().toISOString(),
      },
    ]);
    renderPage('agent');
    await waitFor(() => expect(screen.getByText(/escalating to engineering/i)).toBeInTheDocument());
    expect(screen.getByText('Internal note', { selector: '.badge-warning' })).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderPage('agent');
    await waitFor(() => expect(screen.getByText(/export produces garbled characters/i)).toBeInTheDocument());
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
