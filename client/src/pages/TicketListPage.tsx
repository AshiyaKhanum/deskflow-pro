import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '../hooks/useQuery';
import * as ticketService from '../services/ticketService';
import * as userService from '../services/userService';
import { useDebounce } from '../hooks/useDebounce';
import { useQueryParams } from '../hooks/useQueryParams';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '../components/ui/States';
import { StatusBadge, PriorityBadge, SlaBadge } from '../components/TicketBadges';
import { formatDateTime, roleLabel } from '../utils/format';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, Ticket, TicketListParams } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { normalizeError } from '../api/client';

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Created date' },
  { value: 'updatedAt', label: 'Updated date' },
  { value: 'priority', label: 'Priority' },
  { value: 'slaDueAt', label: 'SLA due date' },
  { value: 'status', label: 'Status' },
];

export function TicketListPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  // Named explicitly (rather than inlined in the JSX below) so this can never be
  // mis-parenthesized into an operator-precedence bug again - both customers and
  // agents can file tickets; admins cannot (the server rejects that with 403).
  const canCreateTicket = user?.role === 'customer' || user?.role === 'agent';
  // Every role can reassign a ticket right from this list - previously the only way to
  // change an assignee at all was the admin-only Assignment dropdown buried on each
  // ticket's detail page, so once a ticket had an assignee there was no visible way to
  // hand it to someone else. The server independently enforces who can act on which
  // ticket (see ticketService.updateTicket): an agent can only reassign a ticket
  // already in their own queue, and a customer only a ticket they filed or are
  // themselves assigned to - exactly the same tickets this list already shows them.
  const canReassign = !!user;
  const { data: assignableUsers } = useQuery(
    () => (canReassign ? userService.listAssignableUsers() : Promise.resolve([])),
    [canReassign],
  );
  const { params, setParams } = useQueryParams();
  const [searchInput, setSearchInput] = useState(params.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 350);

  useEffect(() => {
    if (debouncedSearch !== (params.search ?? '')) {
      setParams({ search: debouncedSearch || undefined, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const queryParams: TicketListParams = useMemo(
    () => ({
      page: params.page ? Number(params.page) : 1,
      limit: 10,
      search: params.search || undefined,
      status: (params.status as TicketListParams['status']) || undefined,
      priority: (params.priority as TicketListParams['priority']) || undefined,
      category: (params.category as TicketListParams['category']) || undefined,
      slaStatus: (params.slaStatus as TicketListParams['slaStatus']) || undefined,
      sortBy: (params.sortBy as TicketListParams['sortBy']) || 'createdAt',
      sortOrder: (params.sortOrder as TicketListParams['sortOrder']) || 'desc',
    }),
    [params],
  );

  const { data, isLoading, error, refetch } = useQuery(
    () => ticketService.listTickets(queryParams),
    [JSON.stringify(queryParams)],
  );

  const hasActiveFilters =
    !!queryParams.search || !!queryParams.status || !!queryParams.priority || !!queryParams.category || !!queryParams.slaStatus;

  function clearFilters() {
    setSearchInput('');
    setParams({ search: undefined, status: undefined, priority: undefined, category: undefined, slaStatus: undefined, page: 1 });
  }

  function toggleSort(field: string) {
    if (params.sortBy === field) {
      setParams({ sortOrder: params.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      setParams({ sortBy: field, sortOrder: 'asc' });
    }
  }

  async function handleAssign(ticket: Ticket, assigneeId: string) {
    try {
      await ticketService.updateTicket(ticket._id, { assignedAgent: assigneeId || null });
      showToast(`#${ticket.ticketNumber} reassigned`, 'success');
      refetch();
    } catch (err) {
      showToast(normalizeError(err).message, 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tickets</h1>
          <p className="page-subtitle">
            {user?.role === 'customer' ? 'Your support tickets' : 'Tickets across the support queue'}
          </p>
        </div>
        {canCreateTicket && (
          <Link to="/tickets/new">
            <Button>+ New Ticket</Button>
          </Link>
        )}
      </div>

      <div className="toolbar" role="search">
        <div className="toolbar-field" style={{ minWidth: 240 }}>
          <Input
            label="Search tickets"
            hideLabel
            placeholder="Search by ID, title, customer name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="toolbar-field">
          <Select
            label="Status"
            hideLabel
            placeholder="All statuses"
            options={TICKET_STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
            value={params.status ?? ''}
            onChange={(e) => setParams({ status: e.target.value || undefined, page: 1 })}
          />
        </div>
        <div className="toolbar-field">
          <Select
            label="Priority"
            hideLabel
            placeholder="All priorities"
            options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
            value={params.priority ?? ''}
            onChange={(e) => setParams({ priority: e.target.value || undefined, page: 1 })}
          />
        </div>
        <div className="toolbar-field">
          <Select
            label="Category"
            hideLabel
            placeholder="All categories"
            options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c.replace('_', ' ') }))}
            value={params.category ?? ''}
            onChange={(e) => setParams({ category: e.target.value || undefined, page: 1 })}
          />
        </div>
        <div className="toolbar-field">
          <Select
            label="SLA status"
            hideLabel
            placeholder="Any SLA state"
            options={[
              { value: 'within_sla', label: 'Within SLA' },
              { value: 'due_soon', label: 'Due soon' },
              { value: 'breached', label: 'Breached' },
            ]}
            value={params.slaStatus ?? ''}
            onChange={(e) => setParams({ slaStatus: e.target.value || undefined, page: 1 })}
          />
        </div>
        <div className="toolbar-field">
          <Select
            label="Sort by"
            hideLabel
            options={SORT_OPTIONS}
            value={params.sortBy ?? 'createdAt'}
            onChange={(e) => setParams({ sortBy: e.target.value })}
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {isLoading && <TableSkeleton columns={6} />}

      {!isLoading && error && <ErrorState message={error.message} onRetry={refetch} />}

      {!isLoading && !error && data && data.tickets.length === 0 && (
        <EmptyState
          title="No tickets found"
          message="Try changing your filters or search, or create a new ticket."
          icon="🔍"
        />
      )}

      {!isLoading && !error && data && data.tickets.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <caption className="visually-hidden">Support tickets</caption>
              <thead>
                <tr>
                  <th scope="col">Ticket</th>
                  <th scope="col">Customer</th>
                  <th scope="col" className="sortable-th">
                    <button onClick={() => toggleSort('status')}>
                      Status {params.sortBy === 'status' && (params.sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th scope="col" className="sortable-th">
                    <button onClick={() => toggleSort('priority')}>
                      Priority {params.sortBy === 'priority' && (params.sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th scope="col">Assigned</th>
                  <th scope="col" className="sortable-th">
                    <button onClick={() => toggleSort('slaDueAt')}>
                      SLA {params.sortBy === 'slaDueAt' && (params.sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th scope="col" className="sortable-th">
                    <button onClick={() => toggleSort('createdAt')}>
                      Created {params.sortBy === 'createdAt' && (params.sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.tickets.map((ticket) => (
                  <tr key={ticket._id}>
                    <td>
                      <Link to={`/tickets/${ticket._id}`}>
                        #{ticket.ticketNumber} {ticket.title}
                      </Link>
                    </td>
                    <td>{ticket.customer?.name ?? '—'}</td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td>
                      {canReassign ? (
                        <Select
                          label={`Assignee for ticket #${ticket.ticketNumber}`}
                          hideLabel
                          placeholder="Unassigned"
                          options={(assignableUsers ?? []).map((u) => ({
                            value: u.id,
                            label: `${u.name} - ${roleLabel(u.role)}`,
                          }))}
                          value={ticket.assignedAgent?._id ?? ''}
                          onChange={(e) => handleAssign(ticket, e.target.value)}
                          style={{ minWidth: 160 }}
                        />
                      ) : ticket.assignedAgent ? (
                        `${ticket.assignedAgent.name}${
                          ticket.assignedAgent.role ? ` - ${roleLabel(ticket.assignedAgent.role)}` : ''
                        }`
                      ) : (
                        'Unassigned'
                      )}
                    </td>
                    <td>
                      <SlaBadge sla={ticket.slaStatus} />
                    </td>
                    <td>{formatDateTime(ticket.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onPageChange={(p) => setParams({ page: p })} />
        </>
      )}
    </div>
  );
}
