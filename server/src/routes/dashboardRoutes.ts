import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate());
// Operations dashboard is admin-only per spec (agents work tickets, they don't get org-wide stats).
router.get('/stats', authorize('admin'), dashboardController.getDashboardStats);

export default router;
