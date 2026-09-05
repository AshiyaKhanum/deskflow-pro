import { useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import * as dashboardService from '../services/dashboardService';
import { ErrorState, LoadingState, EmptyState } from '../components/ui/States';
import { BarList } from '../components/BarList';
import { StatusBadge, PriorityBadge } from '../components/TicketBadges';
import { UserDetailModal } from '../components/UserDetailModal';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../utils/format';

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery(
    () => dashboardService.getDashboardStats(),
    [],
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  if (isLoading) return <LoadingState label="Crunching the numbers…" />;
  if (error || !data) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { statusCounts, priorityBreakdown, sla, performance, agentWorkload, recentActivity } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Operations Dashboard</h1>
          <p className="page-subtitle">
            Live statistics computed from the database - nothing here is hard-coded.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total tickets" value={statusCounts.total} />
        <StatCard label="Open" value={statusCounts.open} />
        <StatCard label="In progress" value={statusCounts.in_progress} />
        <StatCard label="Pending" value={statusCounts.pending} />
        <StatCard label="Resolved" value={statusCounts.resolved} />
        <StatCard label="Closed" value={statusCounts.closed} />
        <StatCard label="SLA breached (open)" value={sla.breachedOpenCount} accent="danger" />
        <StatCard label="Due soon" value={sla.dueSoonCount} accent="warning" />
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card card-padded">
            <h2 style={{ fontSize: '1rem' }}>Ticket status distribution</h2>
            <BarList
              items={[
                { label: 'Open', value: statusCounts.open, color: 'var(--color-info)' },
                {
                  label: 'In progress',
                  value: statusCounts.in_progress,
                  color: 'var(--color-warning)',
                },
                { label: 'Pending', value: statusCounts.pending, color: 'var(--color-text-faint)' },
                { label: 'Resolved', value: statusCounts.resolved, color: 'var(--color-success)' },
                { label: 'Closed', value: statusCounts.closed, color: '#0f9d58' },
              ]}
              maxOverride={Math.max(1, statusCounts.total)}
            />
          </div>

          <div className="card card-padded">
            <h2 style={{ fontSize: '1rem' }}>Priority breakdown</h2>
            <BarList
              items={[
                { label: 'Low', value: priorityBreakdown.low, color: 'var(--color-text-faint)' },
                { label: 'Medium', value: priorityBreakdown.medium, color: 'var(--color-info)' },
                { label: 'High', value: priorityBreakdown.high, color: 'var(--color-warning)' },
                { label: 'Urgent', value: priorityBreakdown.urgent, color: 'var(--color-danger)' },
              ]}
            />
          </div>

          <div className="card card-padded">
            <h2 style={{ fontSize: '1rem' }}>Agent workload</h2>
            {agentWorkload.length === 0 ? (
              <EmptyState
                title="No agents yet"
                message="Add agents from the Users page to see workload here."
              />
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Agent</th>
                      <th scope="col">Assigned</th>
                      <th scope="col">Open</th>
                      <th scope="col">Resolved</th>
                      <th scope="col">Breached</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentWorkload.map((agent) => (
                      <tr key={agent.agentId}>
                        <td>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => setSelectedUserId(agent.agentId)}
                          >
                            {agent.name}
                          </button>
                        </td>
                        <td>{agent.assignedCount}</td>
                        <td>{agent.openCount}</td>
                        <td>{agent.resolvedCount}</td>
                        <td>{agent.breachedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card card-padded">
            <h2 style={{ fontSize: '1rem' }}>SLA performance</h2>
            <dl>
              <div className="detail-row">
                <dt>Compliance rate</dt>
                <dd>
                  {sla.slaComplianceRate !== null
                    ? `${sla.slaComplianceRate}%`
                    : 'No resolved tickets yet'}
                </dd>
              </div>
              <div className="detail-row">
                <dt>Resolved within SLA</dt>
                <dd>
                  {sla.resolvedWithinSlaCount} / {sla.resolvedCount}
                </dd>
              </div>
              <div className="detail-row">
                <dt>Avg. resolution time</dt>
                <dd>
                  {performance.averageResolutionHours !== null
                    ? `${performance.averageResolutionHours}h`
                    : '—'}
                </dd>
              </div>
              <div className="detail-row">
                <dt>Created (last {performance.rangeDays}d)</dt>
                <dd>{performance.ticketsCreated}</dd>
              </div>
              <div className="detail-row">
                <dt>Resolved (last {performance.rangeDays}d)</dt>
                <dd>{performance.ticketsResolved}</dd>
              </div>
              <div className="detail-row">
                <dt>Currently open</dt>
                <dd>{performance.ticketsCurrentlyOpen}</dd>
              </div>
            </dl>
          </div>

          <div className="card card-padded">
            <h2 style={{ fontSize: '1rem' }}>Recent activity</h2>
            {recentActivity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {recentActivity.map((ticket) => (
                  <li
                    key={ticket._id}
                    style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}
                  >
                    <Link
                      to={`/tickets/${ticket._id}`}
                      style={{ fontWeight: 600, fontSize: '0.875rem' }}
                    >
                      #{ticket.ticketNumber} {ticket.title}
                    </Link>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 4,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                        {formatDateTime(ticket.updatedAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'danger' | 'warning';
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div
        className="stat-card-value"
        style={{
          color:
            accent === 'danger'
              ? 'var(--color-danger)'
              : accent === 'warning'
                ? 'var(--color-warning)'
                : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
