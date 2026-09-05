import { z } from 'zod';
import { ROLES } from '../types/enums';

export const updateUserSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    name: z.string().trim().min(2).max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields provided to update' });

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
  role: z.enum(ROLES).default('customer'),
});

export const listUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
