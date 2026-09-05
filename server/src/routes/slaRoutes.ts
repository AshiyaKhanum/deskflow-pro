import { Router } from 'express';
import * as slaController from '../controllers/slaController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upsertSlaPolicySchema, updateSlaPolicySchema } from '../validation/slaSchemas';

const router = Router();

router.use(authenticate());

// Everyone authenticated can read the active policies (needed to render SLA info in the UI).
router.get('/', slaController.listSlaPolicies);

router.post('/', authorize('admin'), validate(upsertSlaPolicySchema), slaController.createSlaPolicy);
router.patch('/:id', authorize('admin'), validate(updateSlaPolicySchema), slaController.updateSlaPolicy);

export default router;
