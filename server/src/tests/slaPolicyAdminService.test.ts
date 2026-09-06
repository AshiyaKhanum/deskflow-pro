import request from 'supertest';
import { app, registerAndLogin } from './helpers';
import { SlaPolicy } from '../models/SlaPolicy';
import * as slaAdminService from '../services/slaPolicyAdminService';

describe('ensureDefaultSlaPolicies', () => {
  it('creates all four default policies on a brand-new (empty) database', async () => {
    expect(await SlaPolicy.countDocuments()).toBe(0);

    await slaAdminService.ensureDefaultSlaPolicies();

    const policies = await SlaPolicy.find().sort({ priority: 1 });
    expect(policies).toHaveLength(4);
    expect(policies.map((p) => p.priority)).toEqual(['high', 'low', 'medium', 'urgent']);
    expect(policies.every((p) => p.isActive)).toBe(true);
  });

  it('is idempotent - running it again never creates duplicates', async () => {
    await slaAdminService.ensureDefaultSlaPolicies();
    await slaAdminService.ensureDefaultSlaPolicies();
    await slaAdminService.ensureDefaultSlaPolicies();

    expect(await SlaPolicy.countDocuments()).toBe(4);
  });

  it("never overwrites a policy an admin already customized - it only fills in what's missing", async () => {
    // Simulate an admin who already customized the "urgent" policy before this
    // fix shipped (or one that a prior deploy already backfilled).
    await SlaPolicy.create({
      priority: 'urgent',
      responseTimeHours: 0.5,
      resolutionTimeHours: 2,
      isActive: false,
    });

    await slaAdminService.ensureDefaultSlaPolicies();

    const policies = await SlaPolicy.find().sort({ priority: 1 });
    expect(policies).toHaveLength(4);
    const urgent = policies.find((p) => p.priority === 'urgent')!;
    expect(urgent.responseTimeHours).toBe(0.5);
    expect(urgent.resolutionTimeHours).toBe(2);
    expect(urgent.isActive).toBe(false);
  });

  it('lets a genuine admin see all four populated rows through the API once backfilled', async () => {
    await slaAdminService.ensureDefaultSlaPolicies();
    const { token } = await registerAndLogin('admin');

    const res = await request(app).get('/api/sla-policies').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
  });
});
