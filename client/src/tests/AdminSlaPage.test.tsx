import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminSlaPage } from '../pages/AdminSlaPage';
import { ToastProvider } from '../context/ToastContext';
import * as slaService from '../services/slaService';
import { SlaPolicy } from '../types';

vi.mock('../services/slaService');

const mockPolicies: SlaPolicy[] = [
  { _id: 'p-low', priority: 'low', responseTimeHours: 24, resolutionTimeHours: 72, isActive: true },
  { _id: 'p-medium', priority: 'medium', responseTimeHours: 8, resolutionTimeHours: 48, isActive: true },
  { _id: 'p-high', priority: 'high', responseTimeHours: 4, resolutionTimeHours: 24, isActive: true },
  { _id: 'p-urgent', priority: 'urgent', responseTimeHours: 1, resolutionTimeHours: 4, isActive: true },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AdminSlaPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AdminSlaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four priority rows once the backend has populated policies', async () => {
    vi.mocked(slaService.listSlaPolicies).mockResolvedValue(mockPolicies);

    renderPage();

    await waitFor(() => expect(screen.getByText('low')).toBeInTheDocument());
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    // Regression guard: previously this table body silently rendered zero rows
    // with no explanation whenever the SlaPolicy collection was empty.
    expect(screen.queryByText(/no sla policies yet/i)).not.toBeInTheDocument();
  });

  it('shows an explanatory empty state instead of a silent blank table when no policies exist yet', async () => {
    vi.mocked(slaService.listSlaPolicies).mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/no sla policies yet/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
