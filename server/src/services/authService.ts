import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { signToken } from '../utils/jwt';
import { env } from '../config/env';

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: IUser['role'];
  avatarColor: string;
  isActive: boolean;
  createdAt: Date;
}

export function toPublicUser(user: IUser): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds);
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: 'customer', // client-supplied role is never trusted - see authSchemas.ts
  });

  const token = signToken({ sub: String(user._id), role: user.role });
  return { token, user: toPublicUser(user) };
}

export async function login(input: { email: string; password: string }): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated. Contact an administrator.');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken({ sub: String(user._id), role: user.role });
  return { token, user: toPublicUser(user) };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toPublicUser(user);
}
