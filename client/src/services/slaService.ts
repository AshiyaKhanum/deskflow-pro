import { apiClient } from '../api/client';
import { ApiResponse, SlaPolicy, TicketPriority } from '../types';

export async function listSlaPolicies(): Promise<SlaPolicy[]> {
  const res = await apiClient.get<ApiResponse<SlaPolicy[]>>('/sla-policies');
  return res.data.data;
}

export async function upsertSlaPolicy(input: {
  priority: TicketPriority;
  responseTimeHours: number;
  resolutionTimeHours: number;
  isActive?: boolean;
}): Promise<SlaPolicy> {
  const res = await apiClient.post<ApiResponse<SlaPolicy>>('/sla-policies', input);
  return res.data.data;
}

export async function updateSlaPolicy(
  id: string,
  input: Partial<{ responseTimeHours: number; resolutionTimeHours: number; isActive: boolean }>,
): Promise<SlaPolicy> {
  const res = await apiClient.patch<ApiResponse<SlaPolicy>>(`/sla-policies/${id}`, input);
  return res.data.data;
}
