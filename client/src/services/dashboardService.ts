import { apiClient } from '../api/client';
import { ApiResponse, DashboardStats } from '../types';

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await apiClient.get<ApiResponse<DashboardStats>>('/dashboard/stats');
  return res.data.data;
}
