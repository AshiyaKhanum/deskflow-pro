import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as ticketService from '../services/ticketService';
import * as userService from '../services/userService';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { normalizeError } from '../api/client';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TicketCategory,
  TicketPriority,
  User,
} from '../types';
import { roleLabel } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export function NewTicketPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  // Customers file their own ticket. Agents can also file one, but on behalf of a
  // customer they must explicitly name - see the "Customer" field below, and
  // server/src/controllers/ticketController.createTicket, which requires it for them.
  const isAgent = user?.role === 'agent';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [assignedAgent, setAssignedAgent] = useState('');
  const [customerId, setCustomerId] = useState('');
  // Every active user, fetched live from the database (see
  // server/src/services/userService.listAssignableUsers) - used both for the "Assign
  // to" dropdown (any role) and, filtered down, for the agent-only "Customer" field.
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);
  const customers = assignableUsers.filter((u) => u.role === 'customer');
  // Distinguishes "still fetching" from "fetched, and there are genuinely zero eligible
  // assignees" - the dropdown needs to tell those two states apart instead of looking
  // the same as "nobody has been chosen yet".
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    userService
      .listAssignableUsers()
      .then((list) => {
        if (!cancelled) setAssignableUsers(list);
      })
      .catch(() => {
        // Non-fatal: if the assignee list can't be loaded, the "Assign to" field just
        // stays empty and the ticket is created unassigned - never silently auto-picked.
      })
      .finally(() => {
        if (!cancelled) setUsersLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isAgent && !customerId) {
      setError('Choose which customer this ticket is for.');
      return;
    }
    setIsSubmitting(true);
    try {
      const ticket = await ticketService.createTicket({
        title,
        description,
        category,
        priority,
        assignedAgent: assignedAgent || undefined,
        customerId: isAgent ? customerId : undefined,
      });
      showToast(`Ticket #${ticket.ticketNumber} created`, 'success');
      navigate(`/tickets/${ticket._id}`);
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>New Ticket</h1>
          <p className="page-subtitle">
            {isAgent
              ? "Filing this on a customer's behalf. We'll automatically calculate the SLA deadline based on priority."
              : "Tell us what's going on. We'll automatically calculate the SLA deadline based on priority."}
          </p>
        </div>
      </div>

      <div className="card card-padded" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Subject"
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary of the issue"
          />
          <Textarea
            label="Description"
            required
            minLength={10}
            maxLength={10000}
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please include as much detail as possible - what happened, when, and what you expected."
          />
          {isAgent && (
            <Select
              label="Customer"
              required
              placeholder={usersLoaded && customers.length === 0 ? 'No customer accounts exist yet' : 'Please select'}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              hint="Who this ticket is being filed for - fetched from the database, never a made-up name."
            />
          )}
          <div className="form-row">
            <Select
              label="Category"
              options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c.replace('_', ' ') }))}
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
            />
            <Select
              label="Priority"
              options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              hint="Urgent = 4h SLA, High = 24h, Medium = 48h, Low = 72h (default policy)"
            />
          </div>
          <Select
            label="Assign to"
            placeholder={
              usersLoaded && assignableUsers.length === 0 ? 'No assignees are available' : 'Please select'
            }
            options={assignableUsers.map((u) => ({ value: u.id, label: `${u.name} - ${roleLabel(u.role)}` }))}
            value={assignedAgent}
            onChange={(e) => setAssignedAgent(e.target.value)}
            hint={
              usersLoaded && assignableUsers.length === 0
                ? 'No eligible accounts exist yet, so there is nothing to assign to. An admin can add one from Admin > Users, then reassign this ticket afterward.'
                : 'Optional - leave blank to leave it unassigned. An agent or admin can pick it up or assign it later.'
            }
          />
          {error && (
            <p className="form-error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <Button type="submit" isLoading={isSubmitting}>
              Submit ticket
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
