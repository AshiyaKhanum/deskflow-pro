import { Role, SlaStatus, TicketPriority, TicketStatus } from '../types';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatRelative(iso: string): string {
  const date = new Date(iso).getTime();
  const diffMs = date - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMinutes);

  if (abs < 1) return 'just now';
  if (abs < 60) return diffMinutes < 0 ? `${abs}m ago` : `in ${abs}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return diffHours < 0 ? `${Math.abs(diffHours)}h ago` : `in ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return diffDays < 0 ? `${Math.abs(diffDays)}d ago` : `in ${diffDays}d`;
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const SLA_LABELS: Record<SlaStatus, string> = {
  within_sla: 'Within SLA',
  due_soon: 'Due soon',
  breached: 'Breached',
};

export function statusBadgeVariant(status: TicketStatus): 'neutral' | 'info' | 'warning' | 'success' {
  switch (status) {
    case 'open':
      return 'info';
    case 'in_progress':
      return 'warning';
    case 'pending':
      return 'neutral';
    case 'resolved':
    case 'closed':
      return 'success';
    default:
      return 'neutral';
  }
}

export function priorityBadgeVariant(priority: TicketPriority): 'neutral' | 'info' | 'warning' | 'danger' {
  switch (priority) {
    case 'low':
      return 'neutral';
    case 'medium':
      return 'info';
    case 'high':
      return 'warning';
    case 'urgent':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function slaBadgeVariant(sla: SlaStatus): 'success' | 'warning' | 'danger' {
  switch (sla) {
    case 'within_sla':
      return 'success';
    case 'due_soon':
      return 'warning';
    case 'breached':
      return 'danger';
    default:
      return 'success';
  }
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  agent: 'Agent',
  customer: 'Customer',
};

/** "agent" -> "Agent" - keeps role display consistent (dropdowns, ticket views, account details). */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
