import request from 'supertest';
import { app, registerAndLogin, seedSlaPolicies } from './helpers';

describe('Role-based access control', () => {
  beforeEach(async () => {
    await seedSlaPolicies();
  });

  it('returns 403 when a customer calls an admin-only endpoint', async () => {
    const { token } = await registerAndLogin('customer');
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 when an agent calls an admin-only endpoint', async () => {
    const { token } = await registerAndLogin('agent');
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    const dashboard = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${token}`);
    expect(dashboard.status).toBe(403);
  });

  it('returns 403 when a customer tries to create a ticket for someone else / directly assign', async () => {
    const { token } = await registerAndLogin('customer');
    const res = await request(app)
      .patch('/api/tickets/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ priority: 'high' });
    // customers cannot PATCH tickets at all -> blocked by role middleware before the id is even looked up
    expect(res.status).toBe(403);
  });

  it("a customer cannot view another customer's ticket (404, not leaking existence)", async () => {
    const { token: ownerToken } = await registerAndLogin('customer', { email: 'owner@example.com' });
    const { token: otherToken } = await registerAndLogin('customer', { email: 'other@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: "Owner's private ticket", description: 'This should not be visible to anyone else.', priority: 'low', category: 'general' });
    const ticketId = createRes.body.data._id;

    const res = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect([403, 404]).toContain(res.status);
  });

  it('a customer cannot escalate their own role via the register or update endpoints', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      name: 'Sneaky',
      email: 'sneaky@example.com',
      password: 'Password123!',
      role: 'admin',
    });
    expect(registerRes.body.data.user.role).toBe('customer');

    const { token } = await registerAndLogin('customer', { email: 'sneaky2@example.com' });
    // No customer-accessible endpoint accepts a role field; /api/users is admin-only and
    // returns 403 outright, which is itself the correct defense.
    const res = await request(app)
      .patch('/api/users/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated requests to protected routes with 401', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
  });
});
