import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createUserSchema, updateUserSchema, listUsersQuerySchema } from '../validation/userSchemas';

const router = Router();

router.use(authenticate());

// Any authenticated user needs the active-agent list to build assignment dropdowns -
// agents/admins for reassignment, customers to optionally request a specific agent when
// filing a new ticket. This only exposes name/email of active agents, nothing sensitive.
router.get('/agents', userController.listAgents);

// The full assignee dropdown/filter (admins, agents, AND customers, per the "assign
// to any eligible user" business rule) - same authenticated-any-role reach as /agents
// above.
router.get('/assignable', userController.listAssignableUsers);

router.get('/', authorize('admin'), validate(listUsersQuerySchema, 'query'), userController.listUsers);
router.post('/', authorize('admin'), validate(createUserSchema), userController.createUser);
// Single-user lookup backs the "click a name to see the account" views (Dashboard's agent
// workload, Admin > Users). Admin-only, same as the full user list - it can return any
// user's email address, which customers/agents have no business seeing for anyone but
// themselves via /auth/me.
router.get('/:id', authorize('admin'), userController.getUser);
router.patch('/:id', authorize('admin'), validate(updateUserSchema), userController.updateUser);

export default router;
