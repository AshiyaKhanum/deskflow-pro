import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../utils/pagination';
import { Role, ASSIGNABLE_ROLES } from '../types/enums';
import { env } from '../config/env';

export interface ListUsersParams {
  page?: string;
  limit?: string;
  search?: string;
  role?: Role;
  isActive?: 'true' | 'false';
}

export async function listUsers(params: ListUsersParams) {
  const { page, limit, skip } = parsePagination({ page: params.page, limit: params.limit });
  const filter: Record<string, unknown> = {};
  if (params.role) filter.role = params.role;
  if (params.isActive !== undefined) filter.isActive = params.isActive === 'true';
  if (params.search) {
    const term = params.search.trim();
    filter.$or = [
      { name: { $regex: escapeRegex(term), $options: 'i' } },
      { email: { $regex: escapeRegex(term), $options: 'i' } },
    ];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

  return { users, pagination: buildPaginationMeta(page, limit, total) as PaginationMeta };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function createUserByAdmin(input: { name: string; email: string; password: string; role: Role }) {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds);
  return User.create({ name: input.name, email: input.email, passwordHash, role: input.role });
}

export interface UpdateUserInput {
  role?: Role;
  isActive?: boolean;
  name?: string;
}

/**
 * Admin-only user mutation. This is the ONLY place a user's role can change after
 * registration - see authService.register, which always hard-codes role='customer'
 * regardless of what the client sends. Privilege escalation can only happen here,
 * and only an authenticated admin can reach this function (enforced by the
 * authorize('admin') middleware on the route, independently of the frontend UI).
 */
export async function updateUser(userId: string, input: UpdateUserInput, requesterId: string) {
  if (input.isActive === false && userId === requesterId) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  if (input.role) user.role = input.role;
  if (input.isActive !== undefined) user.isActive = input.isActive;
  if (input.name) user.name = input.name;

  await user.save();
  return user;
}

export async function listActiveAgents() {
  return User.find({ role: 'agent', isActive: true }).select('_id name email').sort({ name: 1 });
}

/**
 * Eligible ticket assignees: every active user, regardless of role (admin, agent, or
 * customer - per the explicit business rule that a ticket may be handed to any of
 * them). Used to build both the assignee dropdown (ticket creation/reassignment) and
 * the Dashboard's "filter by assignee" list. Includes `role` so callers can label
 * each option (e.g. "Rahul - Agent", "John - Admin").
 */
export async function listAssignableUsers() {
  return User.find({ role: { $in: ASSIGNABLE_ROLES }, isActive: true })
    .select('_id name email role')
    .sort({ role: 1, name: 1 });
}

/** Used by the "click a name to see the account" views - always a live lookup, never a static/cached copy. */
export async function getUserById(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}
