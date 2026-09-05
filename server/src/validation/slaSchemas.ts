import { z } from 'zod';
import { TICKET_PRIORITIES } from '../types/enums';

export const upsertSlaPolicySchema = z.object({
  priority: z.enum(TICKET_PRIORITIES),
  responseTimeHours: z.number().positive().max(720),
  resolutionTimeHours: z.number().positive().max(2160),
  isActive: z.boolean().optional(),
});

export const updateSlaPolicySchema = z
  .object({
    responseTimeHours: z.number().positive().max(720).optional(),
    resolutionTimeHours: z.number().positive().max(2160).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields provided to update' });
