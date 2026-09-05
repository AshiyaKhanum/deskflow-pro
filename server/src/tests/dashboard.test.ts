import request from 'supertest';
import { app, registerAndLogin, seedSlaPolicies } from './helpers';

describe('Dashboard aggregation', () => {
  beforeEach(async () => {
    await seedSlaPolicies();
  });

  it('computes real counts from the database, not hard-coded numbers', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const { token: adminToken } = await registerAndLogin('admin');

    await request(app).post('/api/tickets').set('Authorization', `Bearer ${customerToken}`).send({
      title: 'First ticket', description: 'Description for the first seeded ticket here.', priority: 'high', category: 'bug',
    });
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${customerToken}`).send({
      title: 'Second ticket', description: 'Description for the second seeded ticket here.', priority: 'low', category: 'general',
    });

    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.statusCounts.total).toBe(2);
    expect(res.body.data.statusCounts.open).toBe(2);
    expect(res.body.data.priorityBreakdown.high).toBe(1);
    expect(res.body.data.priorityBreakdown.low).toBe(1);
    expect(Array.isArray(res.body.data.recentActivity)).toBe(true);
    expect(res.body.data.recentActivity).toHaveLength(2);
  });

  it('is forbidden for customers and agents', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const { token: agentToken } = await registerAndLogin('agent');

    const c = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${customerToken}`);
    expect(c.status).toBe(403);
    const a = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${agentToken}`);
    expect(a.status).toBe(403);
  });
});
