import { isValidTransition, TicketStatus } from '../types/enums';
import { ApiError } from '../utils/ApiError';

/**
 * Guards a ticket status transition against the explicit state machine table.
 * This is the ONLY place a status change is allowed to happen from - both the
 * ticket service and any future workflow automation must route through here.
 * Throws 400 on illegal transitions (e.g. open -> closed).
 */
export function assertValidTransition(from: TicketStatus, to: TicketStatus): void {
  if (from === to) {
    throw ApiError.badRequest(`Ticket is already in status '${from}'`);
  }
  if (!isValidTransition(from, to)) {
    throw ApiError.badRequest(
      `Invalid status transition: '${from}' -> '${to}' is not allowed. ` +
        `Valid next steps from '${from}' are handled by the ticket workflow.`,
    );
  }
}
