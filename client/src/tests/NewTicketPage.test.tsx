import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NewTicketPage } from '../pages/NewTicketPage';
import { ToastProvider } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import * as ticketService from '../services/ticketService';
import * as userService from '../services/userService';
import { User } from '../types';

vi.mock('../services/ticketService');
vi.mock('../services/userService');
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUsers: User[] = [
  { id: 'agent-1', name: 'Sanu', email: 'sanu@example.com', role: 'agent', avatarColor: '#111', isActive: true, createdAt: '' },
  { id: 'cust-1', name: 'Ashiya', email: 'ashiya@example.com', role: 'customer', avatarColor: '#222', isActive: true, createdAt: '' },
  { id: 'cust-2', name: 'Rahul', email: 'rahul@example.com', role: 'customer', avatarColor: '#333', isActive: true, createdAt: '' },
];

function renderPage(role: 'customer' | 'agent') {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'me-1', name: 'Me', email: 'me@example.com', role, avatarColor: '#000', isActive: true, createdAt: '' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });

  return render(
    <MemoryRouter>
      <ToastProvider>
        <NewTicketPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('NewTicketPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userService.listAssignableUsers).mockResolvedValue(mockUsers);
  });

  it('does not show a "Customer" field for a customer filing their own ticket', async () => {
    renderPage('customer');
    await waitFor(() => expect(screen.getByText('New Ticket')).toBeInTheDocument());
    expect(screen.queryByLabelText(/^customer$/i)).not.toBeInTheDocument();
  });

  it('shows a required "Customer" field for an agent, listing only customer accounts', async () => {
    renderPage('agent');
    await waitFor(() => expect(screen.getByLabelText(/^customer$/i)).toBeInTheDocument());

    // Only the two customer accounts appear as options - the agent in the fixture does not.
    expect(screen.getByRole('option', { name: 'Ashiya' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Rahul' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Sanu' })).not.toBeInTheDocument();
  });

  it('blocks submission with a clear error if an agent has not chosen which customer this is for', async () => {
    renderPage('agent');
    await waitFor(() => expect(screen.getByLabelText(/^customer$/i)).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/subject/i), 'A ticket missing its customer');
    await userEvent.type(
      screen.getByLabelText(/description/i),
      'Filed without picking who this is for - should be blocked client-side.',
    );
    await userEvent.click(screen.getByRole('button', { name: /submit ticket/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/choose which customer/i);
    expect(ticketService.createTicket).not.toHaveBeenCalled();
  });

  it("submits with the chosen customerId when an agent files on a customer's behalf", async () => {
    vi.mocked(ticketService.createTicket).mockResolvedValue({
      _id: 't1',
      ticketNumber: 3001,
    } as never);

    renderPage('agent');
    await waitFor(() => expect(screen.getByLabelText(/^customer$/i)).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/subject/i), 'Called in about a billing issue');
    await userEvent.type(
      screen.getByLabelText(/description/i),
      'Customer called in and asked the agent to log this for them.',
    );
    await userEvent.selectOptions(screen.getByLabelText(/^customer$/i), 'cust-2');
    await userEvent.click(screen.getByRole('button', { name: /submit ticket/i }));

    await waitFor(() => expect(ticketService.createTicket).toHaveBeenCalled());
    expect(ticketService.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust-2' }),
    );
  });
});
