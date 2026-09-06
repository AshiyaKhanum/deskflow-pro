import { Types } from 'mongoose';
import { Ticket, ITicket } from '../models/Ticket';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { calculateSlaForNewTicket, computeSlaStatus } from './slaService';
import { assertValidTransition } from './stateMachine';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../utils/pagination';
import { TicketPriority, TicketCategory, TicketStatus, Role, SlaStatus, ASSIGNABLE_ROLES } from '../types/enums';

export interface CreateTicketInput {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  /** Who the ticket is ABOUT / owned by. A customer filing their own ticket names
   * themselves; an agent filing on someone's behalf names the chosen customer. */
  customerId: string;
  /** Who actually performed the create action (the authenticated requester) - see
   * `createdBy` on the Ticket model for why this is tracked separately from customerId. */
  filedById: string;
  filedByRole: Role;
  /** Optional: the requester's chosen assignee, picked from the real list of active users. */
  assignedAgent?: string | null;
}

export async function createTicket(input: CreateTicketInput): Promise<ITicket> {
  const now = new Date();
  const { slaPolicySnapshot, slaDueAt } = await calculateSlaForNewTicket(input.priority, now);

  let customerId = input.customerId;
  if (input.filedByRole === 'agent') {
    // An agent files a ticket ON BEHALF OF a customer they name explicitly - never
    // trust that client-supplied id blindly, it must resolve to a real, active
    // customer account (never another agent/admin masquerading as the ticket owner).
    const customer = await User.findOne({ _id: input.customerId, role: 'customer', isActive: true }).select('_id');
    if (!customer) throw ApiError.badRequest('customerId must reference an active customer account');
    customerId = String(customer._id);
  }

  // Assignment is whatever the requester explicitly chose - never an automatic
  // "least busy agent" pick. Leaving the field blank leaves the ticket unassigned
  // (an admin or agent can assign it later from the ticket detail page).
  let assignedAgent: Types.ObjectId | null = null;
  if (input.assignedAgent) {
    // Never trust a client-supplied id blindly - it must resolve to a real, active
    // user, otherwise a caller could "assign" a ticket to a deactivated account or a
    // made-up id. Every role (admin/agent/customer) is an eligible assignee.
    const assignee = await User.findOne({
      _id: input.assignedAgent,
      role: { $in: ASSIGNABLE_ROLES },
      isActive: true,
    }).select('_id');
    if (!assignee) throw ApiError.badRequest('assignedAgent must reference an active, eligible user');
    assignedAgent = assignee._id;
  }

  const ticket = await Ticket.create({
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    customer: customerId,
    createdBy: input.filedById,
    status: 'open',
    assignedAgent,
    slaPolicySnapshot,
    slaDueAt,
    history: [
      {
        field: 'status',
        to: 'open',
        changedBy: input.filedById,
        changedAt: now,
        note: input.filedByRole === 'agent' ? "Ticket created by an agent on the customer's behalf" : 'Ticket created',
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
    // A customer sees tickets they filed, plus any ticket they've been made the
    // assignee of (customers are an eligible assignee role - see ASSIGNABLE_ROLES).
    const id = new Types.ObjectId(requesterId);
    return { $or: [{ customer: id }, { assignedAgent: id }] };
  }
  if (requesterRole === 'agent') {
    // Agents see tickets assigned to them, plus any ticket they filed themselves on a
    // customer's behalf (createdBy - see the Ticket model; distinct from `customer`,
    // which names who the ticket is ABOUT, not who typed it up). Agents no longer see
    // the general unassigned queue - only admins can (re)assign a ticket, so an agent
    // seeing tickets they have no way to act on was just noise, and unrelated tickets
    // should not be visible to them at all.
    const id = new Types.ObjectId(requesterId);
    return { $or: [{ assignedAgent: id }, { createdBy: id }] };
  }
  // admin: no restriction - admins manage the complete support operation.
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
    .populate('createdBy', 'name email role')
    .populate('assignedAgent', 'name email role');

  // slaStatus is a derived field, so it can't be filtered in the DB query directly;
  // apply it as a post-filter on the (already paginated-by-everything-else) page.
  // To keep pagination counts correct when slaStatus filtering is requested, we
  // compute it against the full matching set rather than a single page.
  if (params.slaStatus) {
    const all = await Ticket.find(filter)
      .populate('customer', 'name email')
      .populate('createdBy', 'name email role')
      .populate('assignedAgent', 'name email role')
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
    .populate('createdBy', 'name email role')
    .populate('assignedAgent', 'name email role');
  if (!ticket) throw ApiError.notFound('Ticket not found');

  assertCanViewTicket(ticket, requesterId, requesterRole);
  return ticket;
}

/**
 * Server-side ownership check - a customer or agent must never load a ticket outside
 * their scope just by guessing/typing its id. This is the same "assigned to me OR
 * created by me" rule baseScopeFilter applies to listings, re-checked per-ticket so
 * the API is the real enforcement boundary (not just what the React UI hides) - see
 * DESKFLOW's "role-based ticket visibility must be enforced by the backend" rule.
 */
export function assertCanViewTicket(ticket: ITicket, requesterId: string, requesterRole: Role): void {
  if (requesterRole === 'admin') return; // admins manage the complete support operation
  if (requesterRole === 'agent') {
    const isAssignee =
      !!ticket.assignedAgent && String((ticket.assignedAgent as { _id?: unknown })._id ?? ticket.assignedAgent) === requesterId;
    const isCreator =
      !!ticket.createdBy && String((ticket.createdBy as { _id?: unknown })._id ?? ticket.createdBy) === requesterId;
    if (!isAssignee && !isCreator) {
      throw ApiError.notFound('Ticket not found');
    }
    return;
  }
  if (requesterRole === 'customer') {
    const isOwner = String(ticket.customer._id ?? ticket.customer) === requesterId;
    const isAssignee =
      !!ticket.assignedAgent && String((ticket.assignedAgent as { _id?: unknown })._id ?? ticket.assignedAgent) === requesterId;
    if (!isOwner && !isAssignee) {
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

  // A customer may reassign a ticket - and ONLY reassign it, nothing else (title,
  // description, priority, category are still off-limits to them). This mirrors ticket
  // creation, where a customer can already choose any eligible assignee up front - so
  // being able to change that choice afterwards is the same permission, not a new one.
  // It's safely scoped: assertCanViewTicket (above) already limits a customer to
  // tickets they filed or are themselves assigned to, so this can never reach a
  // stranger's ticket.
  if (requesterRole === 'customer') {
    const updateKeys = Object.keys(input) as Array<keyof UpdateTicketInput>;
    const isAssignmentOnly = updateKeys.length > 0 && updateKeys.every((key) => key === 'assignedAgent');
    if (!isAssignmentOnly) {
      throw ApiError.forbidden('Customers can only change who a ticket is assigned to');
    }
  }
  // Agents and admins can both (re)assign a ticket - to any eligible active user, not
  // just to themselves. This was previously admin-only, which meant an agent who
  // picked up a ticket had no way to hand it off to a teammate. It's still safely
  // scoped: assertCanViewTicket (above) already limits an agent to tickets assigned to
  // them or created by them, so this never lets an agent touch a ticket outside their
  // own queue - it only lets them redirect the tickets they can already see.

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
      // Same eligibility rule as ticket creation - any active user (admin, agent, or
      // customer), never a stale/deactivated account.
      const assignee = await User.findOne({
        _id: input.assignedAgent,
        role: { $in: ASSIGNABLE_ROLES },
        isActive: true,
      });
      if (!assignee) throw ApiError.badRequest('assignedAgent must reference an active, eligible user');
      historyEntries.push({
        field: 'assignedAgent',
        from: ticket.assignedAgent ? String(ticket.assignedAgent) : undefined,
        to: String(assignee._id),
        changedBy: new Types.ObjectId(requesterId),
        changedAt: new Date(),
      });
      ticket.assignedAgent = assignee._id;
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
