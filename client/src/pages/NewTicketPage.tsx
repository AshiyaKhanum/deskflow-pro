import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as ticketService from '../services/ticketService';
import * as userService from '../services/userService';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { normalizeError } from '../api/client';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TicketCategory, TicketPriority, User } from '../types';
import { useToast } from '../context/ToastContext';

export function NewTicketPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [assignedAgent, setAssignedAgent] = useState('');
  const [agents, setAgents] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    userService
      .listAgents()
      .then((list) => {
        if (!cancelled) setAgents(list);
      })
      .catch(() => {
        // Non-fatal: the "Assign to" field just falls back to auto-assignment if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const ticket = await ticketService.createTicket({
        title,
        description,
        category,
        priority,
        assignedAgent: assignedAgent || undefined,
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
            Tell us what&apos;s going on. We&apos;ll automatically calculate the SLA deadline based on priority.
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
            placeholder="Auto-assign to the least-busy agent"
            options={agents.map((a) => ({ value: a.id, label: `${a.name} (${a.email})` }))}
            value={assignedAgent}
            onChange={(e) => setAssignedAgent(e.target.value)}
            hint="Optional - leave blank to let us route it automatically."
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
