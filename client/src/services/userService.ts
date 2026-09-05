import { apiClient } from '../api/client';
import { ApiResponse, PaginationMeta, Role, User } from '../types';

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: 'true' | 'false';
}

export interface UserListResult {
  users: User[];
  pagination: PaginationMeta;
}

export async function listUsers(params: UserListParams): Promise<UserListResult> {
  const res = await apiClient.get<ApiResponse<UserListResult>>('/users', { params });
  return res.data.data;
}

export async function listAgents(): Promise<User[]> {
  const res = await apiClient.get<ApiResponse<User[]>>('/users/agents');
  return res.data.data;
}

/** Always a fresh, live lookup by id - used by "click a name to see the account" views. */
export async function getUser(id: string): Promise<User> {
  const res = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
  return res.data.data;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<User> {
  const res = await apiClient.post<ApiResponse<User>>('/users', input);
  return res.data.data;
}

export async function updateUser(
  id: string,
  input: Partial<{ role: Role; isActive: boolean; name: string }>,
): Promise<User> {
  const res = await apiClient.patch<ApiResponse<User>>(`/users/${id}`, input);
  return res.data.data;
}
