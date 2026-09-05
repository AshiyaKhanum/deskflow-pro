import request from 'supertest';
import { app, registerAndLogin, seedSlaPolicies } from './helpers';

describe('Ticket list: search, filter, sort, pagination', () => {
  beforeEach(async () => {
    await seedSlaPolicies();
  });

  it('paginates results and reports correct pagination metadata', async () => {
    const { token } = await registerAndLogin('customer');

    for (let i = 0; i < 25; i += 1) {
      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Ticket number ${i}`, description: 'Description text long enough to pass validation.', priority: 'medium', category: 'general' });
    }

    const page1 = await request(app).get('/api/tickets?page=1&limit=10').set('Authorization', `Bearer ${token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.tickets).toHaveLength(10);
    expect(page1.body.data.pagination).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });

    const page3 = await request(app).get('/api/tickets?page=3&limit=10').set('Authorization', `Bearer ${token}`);
    expect(page3.body.data.tickets).toHaveLength(5);
  });

  it('filters by status and priority', async () => {
    const { token } = await registerAndLogin('customer');
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`).send({
      title: 'Urgent one', description: 'This is an urgent issue that needs attention.', priority: 'urgent', category: 'technical',
    });
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`).send({
      title: 'Low one', description: 'This is a low priority cosmetic issue.', priority: 'low', category: 'general',
    });

    const res = await request(app).get('/api/tickets?priority=urgent').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(res.body.data.tickets[0].priority).toBe('urgent');
  });

  it('searches by title text', async () => {
    const { token } = await registerAndLogin('customer');
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`).send({
      title: 'Zebra alignment issue', description: 'Zebras are misaligned on the safari page apparently.', priority: 'low', category: 'bug',
    });
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`).send({
      title: 'Login button broken', description: 'Cannot click the login button on Safari browser.', priority: 'medium', category: 'bug',
    });

    const res = await request(app).get('/api/tickets?search=zebra').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(res.body.data.tickets[0].title).toMatch(/Zebra/);
  });

  it('sorts by priority', async () => {
    const { token } = await registerAndLogin('customer');
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`).send({
      title: 'Low prio', description: 'Not urgent at all, whenever you get a chance.', priority: 'low', category: 'general',
    });
    await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`).send({
      title: 'Urgent prio', description: 'This needs immediate attention please.', priority: 'urgent', category: 'general',
    });

    const res = await request(app)
      .get('/api/tickets?sortBy=priority&sortOrder=desc')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tickets[0].priority).toBe('urgent');
  });

  it('caps limit at the maximum allowed page size instead of trusting the client', async () => {
    const { token } = await registerAndLogin('customer');
    const res = await request(app).get('/api/tickets?limit=99999').set('Authorization', `Bearer ${token}`);
    expect(res.body.data.pagination.limit).toBeLessThanOrEqual(100);
  });
});
