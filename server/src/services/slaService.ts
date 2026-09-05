import { SlaPolicy, DEFAULT_SLA_HOURS } from '../models/SlaPolicy';
import { TicketPriority, SlaStatus } from '../types/enums';

export interface SlaPolicySnapshot {
  priority: TicketPriority;
  responseTimeHours: number;
  resolutionTimeHours: number;
}

/**
 * Loads the currently ACTIVE SLA policy for a priority.
 * Falls back to hard-coded defaults only if the admin hasn't configured/seeded one yet,
 * so the app never breaks with an undefined SLA.
 */
export async function getActivePolicy(priority: TicketPriority): Promise<SlaPolicySnapshot> {
  const policy = await SlaPolicy.findOne({ priority, isActive: true }).lean();
  if (policy) {
    return {
      priority,
      responseTimeHours: policy.responseTimeHours,
      resolutionTimeHours: policy.resolutionTimeHours,
    };
  }
  const fallback = DEFAULT_SLA_HOURS[priority];
  return { priority, responseTimeHours: fallback.response, resolutionTimeHours: fallback.resolution };
}

/**
 * Computes the SLA due date (UTC) for a ticket at creation time.
 * IMPORTANT: this snapshot is stored on the ticket itself (slaPolicySnapshot + slaDueAt).
 * If an admin edits the SLA policy later, already-created tickets keep the due date that
 * was authoritative when they were created - only NEW tickets pick up the new policy.
 * This is deliberate: retroactively moving the goalposts on an in-flight ticket would be
 * confusing and unfair to whoever is working it.
 */
export async function calculateSlaForNewTicket(priority: TicketPriority, createdAt: Date) {
  const policy = await getActivePolicy(priority);
  const slaDueAt = new Date(createdAt.getTime() + policy.resolutionTimeHours * 60 * 60 * 1000);
  return { slaPolicySnapshot: policy, slaDueAt };
}

const DUE_SOON_WINDOW_MS = 4 * 60 * 60 * 1000; // within 4 hours of the deadline counts as "due soon"

/** Authoritative SLA status - always derived on the backend from slaDueAt / resolvedAt / status. */
export function computeSlaStatus(params: {
  slaDueAt: Date;
  status: string;
  resolvedAt: Date | null;
  now?: Date;
}): SlaStatus {
  const now = params.now ?? new Date();
  const isFinal = params.status === 'resolved' || params.status === 'closed';
  const referenceTime = isFinal ? params.resolvedAt ?? now : now;

  if (referenceTime.getTime() > params.slaDueAt.getTime()) {
    return 'breached';
  }
  // "Due soon" only makes sense for tickets still awaiting resolution - once a ticket
  // is resolved/closed on time, it's simply within_sla, never "due soon" (there's
  // nothing left pending against the clock).
  if (!isFinal && params.slaDueAt.getTime() - referenceTime.getTime() <= DUE_SOON_WINDOW_MS) {
    return 'due_soon';
  }
  return 'within_sla';
}

export function isBreached(params: { slaDueAt: Date; status: string; resolvedAt: Date | null; now?: Date }): boolean {
  return computeSlaStatus(params) === 'breached';
}
