import { apiClient } from '../api/client';
import {
  ApiResponse,
  Comment,
  CommentVisibility,
  PaginationMeta,
  Ticket,
  TicketCategory,
  TicketListParams,
  TicketPriority,
  TicketStatus,
} from '../types';

export interface TicketListResult {
  tickets: Ticket[];
  pagination: PaginationMeta;
}

export async function listTickets(params: TicketListParams): Promise<TicketListResult> {
  const res = await apiClient.get<ApiResponse<TicketListResult>>('/tickets', { params });
  return res.data.data;
}

export async function getTicket(id: string): Promise<Ticket> {
  const res = await apiClient.get<ApiResponse<Ticket>>(`/tickets/${id}`);
  return res.data.data;
}

export async function createTicket(input: {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}): Promise<Ticket> {
  const res = await apiClient.post<ApiResponse<Ticket>>('/tickets', input);
  return res.data.data;
}

export async function changeTicketStatus(id: string, status: TicketStatus, note?: string): Promise<Ticket> {
  const res = await apiClient.patch<ApiResponse<Ticket>>(`/tickets/${id}/status`, { status, note });
  return res.data.data;
}

export async function updateTicket(
  id: string,
  input: Partial<{ priority: TicketPriority; category: TicketCategory; assignedAgent: string | null }>,
): Promise<Ticket> {
  const res = await apiClient.patch<ApiResponse<Ticket>>(`/tickets/${id}`, input);
  return res.data.data;
}

export async function listComments(ticketId: string): Promise<Comment[]> {
  const res = await apiClient.get<ApiResponse<Comment[]>>(`/tickets/${ticketId}/comments`);
  return res.data.data;
}

export async function addComment(ticketId: string, body: string, visibility: CommentVisibility): Promise<Comment> {
  const res = await apiClient.post<ApiResponse<Comment>>(`/tickets/${ticketId}/comments`, { body, visibility });
  return res.data.data;
}
