import { Role, SlaStatus, TicketPriority, TicketRef, TicketStatus, User } from '../types';

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

export interface AssigneeOption {
  value: string;
  label: string;
}

/**
 * Builds the option list for a ticket-assignee <Select>, always including the
 * ticket's CURRENT assignee even if the live "eligible assignees" list no longer
 * contains them (e.g. they were deactivated after being assigned, or their role
 * changed) - otherwise the dropdown's value wouldn't match any of its options,
 * which silently makes an actually-assigned ticket look unassigned/wrong in the UI.
 */
export function assigneeSelectOptions(
  assignableUsers: User[] | null | undefined,
  currentAssignee: TicketRef | null | undefined,
): AssigneeOption[] {
  const list = assignableUsers ?? [];
  const options = list.map((u) => ({ value: u.id, label: `${u.name} - ${roleLabel(u.role)}` }));
  if (currentAssignee && !list.some((u) => u.id === currentAssignee._id)) {
    options.push({
      value: currentAssignee._id,
      label: currentAssignee.role
        ? `${currentAssignee.name} - ${roleLabel(currentAssignee.role)} (no longer eligible)`
        : `${currentAssignee.name} (no longer eligible)`,
    });
  }
  return options;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
