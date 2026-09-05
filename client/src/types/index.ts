export type Role = 'customer' | 'agent' | 'admin';

export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'billing' | 'technical' | 'account' | 'feature_request' | 'bug' | 'general';
export type CommentVisibility = 'public' | 'internal';
export type SlaStatus = 'within_sla' | 'due_soon' | 'breached';

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'pending', 'resolved', 'closed'];
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
export const TICKET_CATEGORIES: TicketCategory[] = [
  'billing',
  'technical',
  'account',
  'feature_request',
  'bug',
  'general',
];

/** Mirrors the backend's explicit state machine (src/types/enums.ts) - the frontend
 * uses this only to decide which options to SHOW; the backend is still the final authority. */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'pending'],
  in_progress: ['pending', 'resolved'],
  pending: ['in_progress'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
  isActive: boolean;
  createdAt: string;
}

export interface TicketRef {
  _id: string;
  name: string;
  email: string;
}

export interface TicketHistoryEntry {
  field: string;
  from?: string;
  to?: string;
  changedBy: string;
  changedAt: string;
  note?: string;
}

export interface Ticket {
  _id: string;
  ticketNumber: number;
  title: string;
  description: string;
  customer: TicketRef;
  assignedAgent: TicketRef | null;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  slaDueAt: string;
  slaBreached: boolean;
  slaStatus: SlaStatus;
  history: TicketHistoryEntry[];
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  ticket: string;
  author: { _id: string; name: string; role: Role; avatarColor: string };
  body: string;
  visibility: CommentVisibility;
  createdAt: string;
}

export interface SlaPolicy {
  _id: string;
  priority: TicketPriority;
  responseTimeHours: number;
  resolutionTimeHours: number;
  isActive: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorPayload {
  success: false;
  message: string;
  details?: Array<{ path: string; message: string }> | unknown;
}

export interface DashboardStats {
  statusCounts: {
    total: number;
    open: number;
    in_progress: number;
    pending: number;
    resolved: number;
    closed: number;
  };
  priorityBreakdown: { low: number; medium: number; high: number; urgent: number };
  sla: {
    breachedOpenCount: number;
    dueSoonCount: number;
    totalOpenCount: number;
    slaComplianceRate: number | null;
    resolvedWithinSlaCount: number;
    resolvedCount: number;
  };
  performance: {
    ticketsCreated: number;
    ticketsResolved: number;
    ticketsCurrentlyOpen: number;
    averageResolutionHours: number | null;
    rangeDays: number;
  };
  agentWorkload: Array<{
    agentId: string;
    name: string;
    email: string;
    isActive: boolean;
    assignedCount: number;
    openCount: number;
    resolvedCount: number;
    breachedCount: number;
  }>;
  recentActivity: Ticket[];
}

export interface TicketListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedAgent?: string;
  slaStatus?: SlaStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'slaDueAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}
