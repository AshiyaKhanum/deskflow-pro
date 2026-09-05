import request from 'supertest';
import { app, registerAndLogin, seedSlaPolicies } from './helpers';

describe('Public vs internal comment visibility', () => {
  beforeEach(async () => {
    await seedSlaPolicies();
  });

  async function setupTicketWithComments() {
    const { token: customerToken } = await registerAndLogin('customer');
    const { token: agentToken } = await registerAndLogin('agent');

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ title: 'Need help with export', description: 'My CSV export is failing every time I try it.', priority: 'medium', category: 'bug' });
    const ticketId = createRes.body.data._id;

    await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'Here is more detail about the issue.', visibility: 'public' });

    await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body: 'INTERNAL: this is a known bug, ticket JIRA-123 tracks the fix.', visibility: 'internal' });

    await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body: "We're investigating this, thanks for the report!", visibility: 'public' });

    return { ticketId, customerToken, agentToken };
  }

  it('never returns internal comments to the customer, at the API level', async () => {
    const { ticketId, customerToken } = await setupTicketWithComments();

    const res = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    for (const comment of res.body.data) {
      expect(comment.visibility).toBe('public');
      expect(comment.body).not.toMatch(/INTERNAL/);
    }
  });

  it('returns both public and internal comments to an agent', async () => {
    const { ticketId, agentToken } = await setupTicketWithComments();

    const res = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.some((c: { visibility: string }) => c.visibility === 'internal')).toBe(true);
  });

  it('prevents a customer from creating an internal note', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ title: 'Ticket for internal-note test', description: 'Testing that customers cannot post internal notes.', priority: 'low', category: 'general' });
    const ticketId = createRes.body.data._id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'Trying to sneak in an internal note', visibility: 'internal' });

    expect(res.status).toBe(403);
  });
});
