import { SlaPolicy } from '../models/SlaPolicy';
import { ApiError } from '../utils/ApiError';
import { TicketPriority } from '../types/enums';

export async function listSlaPolicies() {
  return SlaPolicy.find().sort({ priority: 1 });
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
