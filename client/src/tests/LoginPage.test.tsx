import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { AuthProvider } from '../context/AuthContext';
import * as authService from '../services/authService';

vi.mock('../services/authService');

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/tickets" element={<div>Tickets landing</div>} />
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

  it('has no detectable accessibility violations', async () => {
    const { container } = renderLoginPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
