import { apiClient } from '../api/client';
import { ApiResponse, User } from '../types';

export interface AuthResult {
  token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/login', { email, password });
  return res.data.data;
}

export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/register', { name, email, password });
  return res.data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getCurrentUser(): Promise<User> {
  const res = await apiClient.get<ApiResponse<User>>('/auth/me');
  return res.data.data;
}
