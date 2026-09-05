import { z } from 'zod';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_CATEGORIES,
} from '../types/enums';

export const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(10000),
  category: z.enum(TICKET_CATEGORIES).default('general'),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
  // Optional: the customer may request a specific active agent or customer as the
  // assignee (see ASSIGNABLE_ROLES in ticketService). If omitted, the ticket is left
  // unassigned - there is no automatic "least busy agent" fallback.
  assignedAgent: z.string().trim().min(1).nullable().optional(),
});

export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(10).max(10000).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    assignedAgent: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields provided to update' });

export const changeStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  note: z.string().trim().max(2000).optional(),
});

export const assignTicketSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
});

export const listTicketsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  assignedAgent: z.string().optional(),
  slaStatus: z.enum(['within_sla', 'due_soon', 'breached']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'slaDueAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});
