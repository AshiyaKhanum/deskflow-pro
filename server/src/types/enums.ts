export const ROLES = ['customer', 'agent', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Roles eligible to be a ticket's assignee. Currently every role - an admin, an
 * agent, or a customer can all be handed a ticket to work (business rule, not
 * every support tool works this way). Shared by ticketService (assignment
 * validation) and userService (the assignee dropdown/filter's user list) so the
 * two can never drift out of sync.
 */
export const ASSIGNABLE_ROLES: readonly Role[] = ROLES;

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'pending',
  'resolved',
  'closed',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  'billing',
  'technical',
  'account',
  'feature_request',
  'bug',
  'general',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const COMMENT_VISIBILITY = ['public', 'internal'] as const;
export type CommentVisibility = (typeof COMMENT_VISIBILITY)[number];

export const SLA_STATUSES = ['within_sla', 'due_soon', 'breached'] as const;
export type SlaStatus = (typeof SLA_STATUSES)[number];

/**
 * Explicit ticket status state machine.
 * Key = current status, value = set of statuses it may transition to.
 * Any transition not listed here is rejected by the API (400 Bad Request).
 */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'pending'],
  in_progress: ['pending', 'resolved'],
  pending: ['in_progress'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

export function isValidTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return false;
  return TICKET_TRANSITIONS[from]?.includes(to) ?? false;
}
