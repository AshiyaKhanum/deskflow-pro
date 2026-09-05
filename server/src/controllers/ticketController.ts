import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as ticketService from '../services/ticketService';
import { ApiError } from '../utils/ApiError';
import { computeSlaStatus } from '../services/slaService';
import { ITicket } from '../models/Ticket';

function serializeTicket(ticket: ITicket) {
  const obj = ticket.toObject ? ticket.toObject() : ticket;
  const slaStatus = computeSlaStatus({
    slaDueAt: obj.slaDueAt,
    status: obj.status,
    resolvedAt: obj.resolvedAt,
  });
  return { ...obj, slaStatus };
}

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.role !== 'customer') {
    throw ApiError.forbidden('Only customers can create tickets');
  }
  const ticket = await ticketService.createTicket({ ...req.body, customerId: req.user.id });
  res.status(201).json({ success: true, data: serializeTicket(ticket) });
});

export const listTickets = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { tickets, pagination } = await ticketService.listTickets({
    requesterId: req.user.id,
    requesterRole: req.user.role,
    ...(req.query as Record<string, string>),
  });
  res.status(200).json({
    success: true,
    data: { tickets: tickets.map((t) => serializeTicket(t)), pagination },
  });
});

export const getTicket = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const ticket = await ticketService.getTicketById(req.params.id, req.user.id, req.user.role);
  res.status(200).json({ success: true, data: serializeTicket(ticket) });
});

export const updateTicket = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const ticket = await ticketService.updateTicket(req.params.id, req.body, req.user.id, req.user.role);
  res.status(200).json({ success: true, data: serializeTicket(ticket) });
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const ticket = await ticketService.changeTicketStatus(
    req.params.id,
    req.body.status,
    req.body.note,
    req.user.id,
    req.user.role,
  );
  res.status(200).json({ success: true, data: serializeTicket(ticket) });
});

export const deleteTicket = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await ticketService.deleteTicket(req.params.id, req.user.role);
  res.status(200).json({ success: true, message: 'Ticket deleted' });
});
