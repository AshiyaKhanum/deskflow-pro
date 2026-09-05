import { Router } from 'express';
import authRoutes from './authRoutes';
import ticketRoutes from './ticketRoutes';
import userRoutes from './userRoutes';
import slaRoutes from './slaRoutes';
import dashboardRoutes from './dashboardRoutes';

const router = Router();

router.get('/health', (_req, res) => res.status(200).json({ success: true, message: 'ok' }));

router.use('/auth', authRoutes);
router.use('/tickets', ticketRoutes);
router.use('/users', userRoutes);
router.use('/sla-policies', slaRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
