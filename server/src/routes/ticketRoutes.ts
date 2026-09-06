import { Router } from 'express';
import * as ticketController from '../controllers/ticketController';
import * as commentController from '../controllers/commentController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createTicketSchema,
  updateTicketSchema,
  changeStatusSchema,
  listTicketsQuerySchema,
} from '../validation/ticketSchemas';
import { createCommentSchema } from '../validation/commentSchemas';

const router = Router();

router.use(authenticate());

router.get('/', validate(listTicketsQuerySchema, 'query'), ticketController.listTickets);
router.post('/', authorize('customer', 'agent'), validate(createTicketSchema), ticketController.createTicket);

router.get('/:id', ticketController.getTicket);
// Customers may reach this endpoint too - but ticketService.updateTicket restricts them
// to changing only assignedAgent (nothing else), enforced server-side, not just hidden
// in the UI.
router.patch(
  '/:id',
  authorize('customer', 'agent', 'admin'),
  validate(updateTicketSchema),
  ticketController.updateTicket,
);
router.delete('/:id', authorize('admin'), ticketController.deleteTicket);

router.patch(
  '/:id/status',
  authorize('agent', 'admin'),
  validate(changeStatusSchema),
  ticketController.changeStatus,
);

router.get('/:id/comments', commentController.listComments);
router.post('/:id/comments', validate(createCommentSchema), commentController.addComment);

export default router;
