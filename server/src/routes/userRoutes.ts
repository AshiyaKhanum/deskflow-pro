import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createUserSchema, updateUserSchema, listUsersQuerySchema } from '../validation/userSchemas';

const router = Router();

router.use(authenticate());

// Any authenticated agent/admin needs the active-agent list to build assignment dropdowns.
router.get('/agents', authorize('agent', 'admin'), userController.listAgents);

router.get('/', authorize('admin'), validate(listUsersQuerySchema, 'query'), userController.listUsers);
router.post('/', authorize('admin'), validate(createUserSchema), userController.createUser);
router.patch('/:id', authorize('admin'), validate(updateUserSchema), userController.updateUser);

export default router;
