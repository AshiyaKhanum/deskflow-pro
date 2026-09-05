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
router.patch('/:id', authorize('agent', 'admin'), validate(updateTicketSchema), ticketController.updateTicket);
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
