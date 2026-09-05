import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '../hooks/useQuery';
import * as ticketService from '../services/ticketService';
import * as userService from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ErrorState, LoadingState } from '../components/ui/States';
import { StatusBadge, PriorityBadge, SlaBadge } from '../components/TicketBadges';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { formatDateTime, initials } from '../utils/format';
import { TICKET_TRANSITIONS, TicketStatus } from '../types';
import { normalizeError } from '../api/client';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAgentOrAdmin = user?.role === 'agent' || user?.role === 'admin';

  const {
    data: ticket,
    isLoading: ticketLoading,
    error: ticketError,
    refetch: refetchTicket,
  } = useQuery(() => ticketService.getTicket(id!), [id]);

  const {
    data: comments,
    isLoading: commentsLoading,
    refetch: refetchComments,
  } = useQuery(() => ticketService.listComments(id!), [id]);

  const { data: agents } = useQuery(
    () => (isAgentOrAdmin ? userService.listAgents() : Promise.resolve([])),
    [isAgentOrAdmin],
  );

  const [commentBody, setCommentBody] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (ticketLoading) return <LoadingState label="Loading ticket…" />;
  if (ticketError || !ticket) {
    return (
      <ErrorState
        message={ticketError?.status === 404 ? 'Ticket not found.' : ticketError?.message}
        onRetry={refetchTicket}
      />
    );
  }

  const validNextStatuses = TICKET_TRANSITIONS[ticket.status];
  const ticketId = ticket._id;

  async function handleStatusChange(next: TicketStatus) {
    setStatusError(null);
    setIsChangingStatus(true);
    try {
      await ticketService.changeTicketStatus(ticketId, next);
      showToast(`Status changed to ${next.replace('_', ' ')}`, 'success');
      refetchTicket();
    } catch (err) {
      setStatusError(normalizeError(err).message);
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function handleAssign(agentId: string) {
    try {
      await ticketService.updateTicket(ticketId, { assignedAgent: agentId || null });
      showToast('Assignment updated', 'success');
      refetchTicket();
    } catch (err) {
      showToast(normalizeError(err).message, 'error');
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setIsPostingComment(true);
    try {
      await ticketService.addComment(ticketId, commentBody, isAgentOrAdmin ? visibility : 'public');
      setCommentBody('');
      setVisibility('public');
      refetchComments();
    } catch (err) {
      showToast(normalizeError(err).message, 'error');
    } finally {
      setIsPostingComment(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            #{ticket.ticketNumber} {ticket.title}
          </h1>
          <p className="page-subtitle">
            Opened by {ticket.customer?.name} ({ticket.customer?.email})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <SlaBadge sla={ticket.slaStatus} />
        </div>
      </div>

      <div className="ticket-detail-grid">
        <div>
          <div className="card card-padded" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: '1rem' }}>Description</h2>
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text)' }}>{ticket.description}</p>
          </div>

          <div className="card card-padded">
            <h2 style={{ fontSize: '1rem' }}>Activity</h2>
            {commentsLoading && <LoadingState label="Loading comments…" />}
            {!commentsLoading && comments && comments.length === 0 && (
              <p>No comments yet. Be the first to add an update.</p>
            )}
            {!commentsLoading && comments && comments.length > 0 && (
              <ol className="timeline" style={{ listStyle: 'none', padding: 0 }}>
                {comments.map((comment) => (
                  <li key={comment._id} className={`timeline-item ${comment.visibility === 'internal' ? 'internal' : ''}`}>
                    <div className="timeline-item-head">
                      <span className="timeline-author">
                        <span
                          className="user-avatar"
                          style={{ background: comment.author.avatarColor, width: 24, height: 24, fontSize: '0.65rem' }}
                          aria-hidden="true"
                        >
                          {initials(comment.author.name)}
                        </span>
                        {comment.author.name}
                        {comment.visibility === 'internal' && (
                          <span className="badge badge-warning" aria-label="Internal note, not visible to the customer">
                            Internal note
                          </span>
                        )}
                      </span>
                      <span className="timeline-time">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--color-text)' }}>{comment.body}</p>
                  </li>
                ))}
              </ol>
            )}

            <form onSubmit={handleAddComment} style={{ marginTop: 20 }} noValidate>
              <Textarea
                label={isAgentOrAdmin ? 'Add a reply or internal note' : 'Add a public reply'}
                rows={3}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Type your update…"
                required
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                {isAgentOrAdmin ? (
                  <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                    <legend className="visually-hidden">Comment visibility</legend>
                    <label style={{ marginRight: 16, fontSize: '0.875rem' }}>
                      <input
                        type="radio"
                        name="visibility"
                        value="public"
                        checked={visibility === 'public'}
                        onChange={() => setVisibility('public')}
                      />{' '}
                      Public reply (customer sees this)
                    </label>
                    <label style={{ fontSize: '0.875rem' }}>
                      <input
                        type="radio"
                        name="visibility"
                        value="internal"
                        checked={visibility === 'internal'}
                        onChange={() => setVisibility('internal')}
                      />{' '}
                      Internal note (team only)
                    </label>
                  </fieldset>
                ) : (
                  <span className="form-hint">Support agents may also leave internal notes you won&apos;t see.</span>
                )}
                <Button type="submit" isLoading={isPostingComment} size="sm">
                  Post
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div>
          <div className="card card-padded" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: '1rem' }}>Details</h2>
            <dl>
              <div className="detail-row">
                <dt>Category</dt>
                <dd>{ticket.category.replace('_', ' ')}</dd>
              </div>
              <div className="detail-row">
                <dt>Assigned agent</dt>
                <dd>{ticket.assignedAgent?.name ?? 'Unassigned'}</dd>
              </div>
              <div className="detail-row">
                <dt>SLA due</dt>
                <dd>{formatDateTime(ticket.slaDueAt)}</dd>
              </div>
              <div className="detail-row">
                <dt>Created</dt>
                <dd>{formatDateTime(ticket.createdAt)}</dd>
              </div>
              <div className="detail-row">
                <dt>Last updated</dt>
                <dd>{formatDateTime(ticket.updatedAt)}</dd>
              </div>
              {ticket.resolvedAt && (
                <div className="detail-row">
                  <dt>Resolved</dt>
                  <dd>{formatDateTime(ticket.resolvedAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {isAgentOrAdmin && (
            <div className="card card-padded" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: '1rem' }}>Workflow</h2>
              {validNextStatuses.length === 0 ? (
                <p>This ticket is closed. No further status changes are possible.</p>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {validNextStatuses.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant="secondary"
                      isLoading={isChangingStatus}
                      onClick={() => handleStatusChange(status)}
                    >
                      Move to {status.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              )}
              {statusError && (
                <p className="form-error" role="alert" style={{ marginTop: 12 }}>
                  {statusError}
                </p>
              )}
            </div>
          )}

          {user?.role === 'admin' && (
            <div className="card card-padded">
              <h2 style={{ fontSize: '1rem' }}>Assignment</h2>
              <Select
                label="Assigned agent"
                hideLabel
                placeholder="Unassigned"
                options={(agents ?? []).map((a) => ({ value: a.id, label: a.name }))}
                value={ticket.assignedAgent?._id ?? ''}
                onChange={(e) => handleAssign(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
