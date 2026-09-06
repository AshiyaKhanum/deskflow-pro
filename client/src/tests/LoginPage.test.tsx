import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { AuthProvider } from '../context/AuthContext';
import * as authService from '../services/authService';

vi.mock('../services/authService');

/** Renders the search string it landed with, so a test can prove stale filter
 * query params from a saved `from` location were (or weren't) carried over. */
function TicketsLanding() {
  const location = useLocation();
  return <div>Tickets landing (search: &quot;{location.search}&quot;)</div>;
}

function renderLoginPage(initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/tickets" element={<TicketsLanding />} />
          <Route path="/dashboard" element={<div>Dashboard landing</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function demoUser(role: 'admin' | 'agent' | 'customer') {
  return {
    id: `${role}-1`,
    name: `Demo ${role}`,
    email: `${role}@deskflow.demo`,
    role,
    avatarColor: '#4f46e5',
    isActive: true,
    createdAt: new Date().toISOString(),
  } as const;
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the sign-in form with accessible labels', () => {
    renderLoginPage();
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('fills demo credentials when a demo account button is clicked', async () => {
    renderLoginPage();
    await userEvent.click(screen.getByRole('button', { name: /^admin$/i }));
    expect(screen.getByLabelText(/email address/i)).toHaveValue('admin@deskflow.demo');
  });

  it('shows a friendly error message on invalid credentials', async () => {
    vi.mocked(authService.login).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { message: 'Invalid email or password' } },
    });

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'wrong@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i);
    });
  });

  it('lands an Admin on the Dashboard after a successful login, not the ticket list', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce({ token: 'tok-admin', user: demoUser('admin') });

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'admin@deskflow.demo');
    await userEvent.type(screen.getByLabelText(/password/i), 'DeskflowDemo123!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/dashboard landing/i)).toBeInTheDocument());
  });

  it('lands a Customer on the ticket list after a successful login, not the Dashboard', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce({ token: 'tok-customer', user: demoUser('customer') });

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'customer@deskflow.demo');
    await userEvent.type(screen.getByLabelText(/password/i), 'DeskflowDemo123!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/tickets landing/i)).toBeInTheDocument());
  });

  it('drops a stale filter query string from a saved "from" location on login - never replays someone else\'s filters', async () => {
    // Simulates: the browser tab was previously on a filtered /tickets URL (e.g. from a
    // different account's session, or before the token expired), got bounced to /login
    // with that full location - including its query string - saved as `from`. A fresh
    // login must land back on /tickets, but WITHOUT those old filters: replaying an
    // arbitrary ?assignedAgent=<someone else>&status=... against this user's own scoped
    // query can produce zero results even when they have real tickets ("No tickets
    // found" until the user manually revisits the page with a clean URL).
    vi.mocked(authService.login).mockResolvedValueOnce({ token: 'tok-customer', user: demoUser('customer') });

    renderLoginPage([
      {
        pathname: '/login',
        state: { from: { pathname: '/tickets', search: '?assignedAgent=someone-elses-id&status=resolved' } },
      },
    ]);
    await userEvent.type(screen.getByLabelText(/email address/i), 'customer@deskflow.demo');
    await userEvent.type(screen.getByLabelText(/password/i), 'DeskflowDemo123!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/tickets landing/i)).toBeInTheDocument());
    expect(screen.getByText(/search: ""/)).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderLoginPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
