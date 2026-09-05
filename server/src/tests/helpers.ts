import request from 'supertest';
import { createApp } from '../app';
import { User } from '../models/User';
import { SlaPolicy, DEFAULT_SLA_HOURS } from '../models/SlaPolicy';
import bcrypt from 'bcryptjs';
import { Role, TicketPriority } from '../types/enums';

export const app = createApp();

export async function seedSlaPolicies() {
  const priorities: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
  await SlaPolicy.insertMany(
    priorities.map((priority) => ({
      priority,
      responseTimeHours: DEFAULT_SLA_HOURS[priority].response,
      resolutionTimeHours: DEFAULT_SLA_HOURS[priority].resolution,
      isActive: true,
    })),
  );
}

export async function createUserDirect(role: Role, overrides: Partial<{ name: string; email: string }> = {}) {
  const passwordHash = await bcrypt.hash('Password123!', 4);
  const user = await User.create({
    name: overrides.name ?? `${role} user`,
    email: overrides.email ?? `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    passwordHash,
    role,
  });
  return user;
}

export async function loginAs(email: string, password = 'Password123!') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token as string;
}

export async function registerAndLogin(role: Role, overrides: Partial<{ name: string; email: string }> = {}) {
  const email = overrides.email ?? `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const user = await createUserDirect(role, { ...overrides, email });
  const token = await loginAs(email);
  return { user, token };
}
