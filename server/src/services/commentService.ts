import { Types } from 'mongoose';
import { Comment, IComment } from '../models/Comment';
import { Ticket } from '../models/Ticket';
import { ApiError } from '../utils/ApiError';
import { assertCanViewTicket } from './ticketService';
import { CommentVisibility, Role } from '../types/enums';

/**
 * SECURITY-CRITICAL: this is the only function in the codebase that reads comments.
 * The visibility filter is applied IN THE DATABASE QUERY, not in a post-processing
 * step and not in the frontend - a customer's request literally never fetches
 * internal-note documents out of MongoDB, so there is no code path (a bug in a
 * serializer, a leaked field, etc.) that could accidentally expose them.
 */
export async function listCommentsForTicket(
  ticketId: string,
  requesterId: string,
  requesterRole: Role,
): Promise<IComment[]> {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  assertCanViewTicket(ticket, requesterId, requesterRole);

  const filter: Record<string, unknown> = { ticket: ticketId };
  if (requesterRole === 'customer') {
    filter.visibility = 'public';
  }
  // agent and admin: no visibility restriction - they get public + internal.

  return Comment.find(filter).populate('author', 'name role avatarColor').sort({ createdAt: 1 });
}

export async function addComment(
  ticketId: string,
  body: string,
  visibility: CommentVisibility,
  requesterId: string,
  requesterRole: Role,
): Promise<IComment> {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  assertCanViewTicket(ticket, requesterId, requesterRole);

  if (requesterRole === 'customer' && visibility === 'internal') {
    throw ApiError.forbidden('Customers cannot create internal notes');
  }

  const comment = await Comment.create({
    ticket: ticketId,
    author: new Types.ObjectId(requesterId),
    body,
    visibility,
  });

  return comment.populate('author', 'name role avatarColor');
}
