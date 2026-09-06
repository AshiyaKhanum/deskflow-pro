import { SlaPolicy, DEFAULT_SLA_HOURS } from '../models/SlaPolicy';
import { ApiError } from '../utils/ApiError';
import { TicketPriority, TICKET_PRIORITIES } from '../types/enums';

export async function listSlaPolicies() {
  return SlaPolicy.find().sort({ priority: 1 });
}

/**
 * Guarantees a policy document exists for every priority level (low/medium/high/urgent).
 *
 * Root cause this fixes: a brand-new database (e.g. a fresh production MongoDB that was
 * never populated by the local-only `npm run seed` script - which is destructive and
 * wipes users/tickets, so it must never be run against live data) has an empty
 * SlaPolicy collection. Ticket creation never notices, because slaService.getActivePolicy()
 * quietly falls back to DEFAULT_SLA_HOURS when no document exists - but the Admin > SLA
 * Policies page lists the raw collection with no such fallback and no "create" UI, so it
 * rendered table headers with zero rows and no way for an admin to add the missing ones.
 *
 * $setOnInsert only fills in a priority that's completely missing - it never touches (or
 * resets) a policy an admin already customized, so this is safe to run on every server
 * boot, not just once.
 */
export async function ensureDefaultSlaPolicies(): Promise<void> {
  await Promise.all(
    TICKET_PRIORITIES.map((priority) =>
      SlaPolicy.findOneAndUpdate(
        { priority },
        {
          $setOnInsert: {
            priority,
            responseTimeHours: DEFAULT_SLA_HOURS[priority].response,
            resolutionTimeHours: DEFAULT_SLA_HOURS[priority].resolution,
            isActive: true,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

export async function upsertSlaPolicy(input: {
  priority: TicketPriority;
  responseTimeHours: number;
  resolutionTimeHours: number;
  isActive?: boolean;
}) {
  return SlaPolicy.findOneAndUpdate(
    { priority: input.priority },
    {
      $set: {
        responseTimeHours: input.responseTimeHours,
        resolutionTimeHours: input.resolutionTimeHours,
        isActive: input.isActive ?? true,
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
}

export async function updateSlaPolicy(
  id: string,
  input: { responseTimeHours?: number; resolutionTimeHours?: number; isActive?: boolean },
) {
  const policy = await SlaPolicy.findById(id);
  if (!policy) throw ApiError.notFound('SLA policy not found');

  if (input.responseTimeHours !== undefined) policy.responseTimeHours = input.responseTimeHours;
  if (input.resolutionTimeHours !== undefined) policy.resolutionTimeHours = input.resolutionTimeHours;
  if (input.isActive !== undefined) policy.isActive = input.isActive;

  await policy.save();
  return policy;
}
