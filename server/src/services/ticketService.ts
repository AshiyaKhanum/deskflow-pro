import { Types } from 'mongoose';
import { Ticket, ITicket } from '../models/Ticket';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { calculateSlaForNewTicket, computeSlaStatus } from './slaService';
import { assertValidTransition } from './stateMachine';
import { pickAgentForAssignment } from './assignmentService';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../utils/pagination';
import { TicketPriority, TicketCategory, TicketStatus, Role, SlaStatus } from '../types/enums';

export interface CreateTicketInput {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  customerId: string;
}

export async function createTicket(input: CreateTicketInput): Promise<ITicket> {
  const now = new Date();
  const { slaPolicySnapshot, slaDueAt } = await calculateSlaForNewTicket(input.priority, now);
  const assignedAgent = await pickAgentForAssignment();

  const ticket = await Ticket.create({
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    customer: input.customerId,
    status: 'open',
    assignedAgent,
    slaPolicySnapshot,
    slaDueAt,
    history: [
      {
        field: 'status',
        to: 'open',
        changedBy: input.customerId,
        changedAt: now,
        note: 'Ticket created',
      },
    ],
  });

  return ticket;
}

export interface ListTicketsParams {
  requesterId: string;
  requesterRole: Role;
  page?: string;
  limit?: string;
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedAgent?: string;
  slaStatus?: SlaStatus;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListTicketsResult {
  tickets: ITicket[];
  pagination: PaginationMeta;
}

/**
 * Builds the base Mongo filter for the requester's role BEFORE any of their own
 * search/filter params are applied. This is the RBAC boundary at the query layer:
 * a customer's query can never even see another customer's tickets, regardless of
 * what filters they pass in.
 */
async function baseScopeFilter(requesterId: string, requesterRole: Role) {
  if (requesterRole === 'customer') {
    return { customer: new Types.ObjectId(requesterId) };
  }
  if (requesterRole === 'agent') {
    // Agents see tickets assigned to them, plus the unassigned queue.
    return { $or: [{ assignedAgent: new Types.ObjectId(requesterId) }, { assignedAgent: null }] };
  }
  // admin: no restriction
  return {};
}

export async function listTickets(params: ListTicketsParams): Promise<ListTicketsResult> {
  const { page, limit, skip } = parsePagination({ page: params.page, limit: params.limit });

  const filter: Record<string, unknown> = await baseScopeFilter(params.requesterId, params.requesterRole);
  const andConditions: Record<string, unknown>[] = [];

  if (params.status) andConditions.push({ status: params.status });
  if (params.priority) andConditions.push({ priority: params.priority });
  if (params.category) andConditions.push({ category: params.category });
  if (params.assignedAgent) {
    andConditions.push({ assignedAgent: new Types.ObjectId(params.assignedAgent) });
  }

  if (params.dateFrom || params.dateTo) {
    const range: Record<string, Date> = {};
    if (params.dateFrom) range.$gte = new Date(params.dateFrom);
    if (params.dateTo) range.$lte = new Date(params.dateTo);
    andConditions.push({ createdAt: range });
  }

  if (params.search) {
    const term = params.search.trim();
    const asNumber = Number(term.replace(/^#/, ''));
    const searchOr: Record<string, unknown>[] = [
      { title: { $regex: escapeRegex(term), $options: 'i' } },
    ];
    if (Number.isFinite(asNumber) && term.replace(/^#/, '').length > 0) {
      searchOr.push({ ticketNumber: asNumber });
    }
    // Search by customer name/email requires resolving matching customer ids first.
    const matchingCustomers = await User.find({
      role: 'customer',
      $or: [
        { name: { $regex: escapeRegex(term), $options: 'i' } },
        { email: { $regex: escapeRegex(term), $options: 'i' } },
      ],
    })
      .select('_id')
      .lean();
    if (matchingCustomers.length > 0) {
      searchOr.push({ customer: { $in: matchingCustomers.map((c) => c._id) } });
    }
    andConditions.push({ $or: searchOr });
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  const sortField = params.sortBy ?? 'createdAt';
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

  const query = Ticket.find(filter)
    .populate('customer', 'name email')
    .populate('assignedAgent', 'name email');

  // slaStatus is a derived field, so it can't be filtered in the DB query directly;
  // apply it as a post-filter on the (already paginated-by-everything-else) page.
  // To keep pagination counts correct when slaStatus filtering is requested, we
  // compute it against the full matching set rather than a single page.
  if (params.slaStatus) {
    const all = await Ticket.find(filter)
      .populate('customer', 'name email')
      .populate('assignedAgent', 'name email')
      .sort({ [sortField]: sortOrder })
      .lean();
    const filtered = all.filter(
      (t) => computeSlaStatus({ slaDueAt: t.slaDueAt, status: t.status, resolvedAt: t.resolvedAt }) === params.slaStatus,
    );
    const total = filtered.length;
    const pageItems = filtered.slice(skip, skip + limit);
    return {
      tickets: pageItems as unknown as ITicket[],
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  const total = await Ticket.countDocuments(filter);
  const tickets = await query
    .sort({ [sortField]: sortOrder })
    .skip(skip)
    .limit(limit);

  return { tickets, pagination: buildPaginationMeta(page, limit, total) };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getTicketById(
  ticketId: string,
  requesterId: string,
  requesterRole: Role,
): Promise<ITicket> {
  const ticket = await Ticket.findById(ticketId)
    .populate('customer', 'name email')
    .populate('assignedAgent', 'name email');
  if (!ticket) throw ApiError.notFound('Ticket not found');

  assertCanViewTicket(ticket, requesterId, requesterRole);
  return ticket;
}

/** Server-side ownership check - a customer must never load another customer's ticket by guessing an id. */
export function assertCanViewTicket(ticket: ITicket, requesterId: string, requesterRole: Role): void {
  if (requesterRole === 'admin') return;
  if (requesterRole === 'agent') return; // agents can view any ticket (assigned or in the unassigned queue)
  if (requesterRole === 'customer') {
    if (String(ticket.customer._id ?? ticket.customer) !== requesterId) {
      throw ApiError.notFound('Ticket not found');
    }
    return;
  }
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedAgent?: string | null;
}

export async function updateTicket(
  ticketId: string,
  input: UpdateTicketInput,
  requesterId: string,
  requesterRole: Role,
): Promise<ITicket> {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  assertCanViewTicket(ticket, requesterId, requesterRole);

  if (requesterRole === 'customer') {
    throw ApiError.forbidden('Customers cannot modify ticket fields directly');
  }
  if (input.assignedAgent !== undefined && requesterRole !== 'admin') {
    throw ApiError.forbidden('Only admins can (re)assign tickets');
  }

  const historyEntries: ITicket['history'] = [];

  if (input.priority && input.priority !== ticket.priority) {
    historyEntries.push({
      field: 'priority',
      from: ticket.priority,
      to: input.priority,
      changedBy: new Types.ObjectId(requesterId),
      changedAt: new Date(),
    });
    ticket.priority = input.priority;
  }
  if (input.category && input.category !== ticket.category) {
    historyEntries.push({
      field: 'category',
      from: ticket.category,
      to: input.category,
      changedBy: new Types.ObjectId(requesterId),
      changedAt: new Date(),
    });
    ticket.category = input.category;
  }
  if (input.title) ticket.title = input.title;
  if (input.description) ticket.description = input.description;

  if (input.assignedAgent !== undefined) {
    if (input.assignedAgent === null) {
      historyEntries.push({
        field: 'assignedAgent',
        from: ticket.assignedAgent ? String(ticket.assignedAgent) : undefined,
        to: undefined,
        changedBy: new Types.ObjectId(requesterId),
        changedAt: new Date(),
        note: 'Unassigned',
      });
      ticket.assignedAgent = null;
    } else {
      const agent = await User.findOne({ _id: input.assignedAgent, role: 'agent' });
      if (!agent) throw ApiError.badRequest('assignedAgent must reference an existing agent');
      historyEntries.push({
        field: 'assignedAgent',
        from: ticket.assignedAgent ? String(ticket.assignedAgent) : undefined,
        to: String(agent._id),
        changedBy: new Types.ObjectId(requesterId),
        changedAt: new Date(),
      });
      ticket.assignedAgent = agent._id;
    }
  }

  ticket.history.push(...historyEntries);
  await ticket.save();
  return ticket;
}

export async function changeTicketStatus(
  ticketId: string,
  toStatus: TicketStatus,
  note: string | undefined,
  requesterId: string,
  requesterRole: Role,
): Promise<ITicket> {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  assertCanViewTicket(ticket, requesterId, requesterRole);

  if (requesterRole === 'customer') {
    throw ApiError.forbidden('Customers cannot change ticket status');
  }

  assertValidTransition(ticket.status, toStatus);

  const fromStatus = ticket.status;
  ticket.status = toStatus;
  ticket.history.push({
    field: 'status',
    from: fromStatus,
    to: toStatus,
    changedBy: new Types.ObjectId(requesterId),
    changedAt: new Date(),
    note,
  });

  if (toStatus === 'resolved') {
    ticket.resolvedAt = new Date();
    ticket.closedAt = null;
  } else if (toStatus === 'closed') {
    ticket.closedAt = new Date();
  } else {
    // Reopening (resolved -> in_progress) clears the resolved timestamp.
    if (fromStatus === 'resolved') ticket.resolvedAt = null;
  }

  ticket.slaBreached = computeSlaStatus({
    slaDueAt: ticket.slaDueAt,
    status: ticket.status,
    resolvedAt: ticket.resolvedAt,
  }) === 'breached';

  await ticket.save();
  return ticket;
}

export async function deleteTicket(ticketId: string, requesterRole: Role): Promise<void> {
  if (requesterRole !== 'admin') {
    throw ApiError.forbidden('Only admins can delete tickets');
  }
  const result = await Ticket.findByIdAndDelete(ticketId);
  if (!result) throw ApiError.notFound('Ticket not found');
}
