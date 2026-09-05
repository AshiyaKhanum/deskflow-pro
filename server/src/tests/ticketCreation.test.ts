import request from 'supertest';
import { app, registerAndLogin, createUserDirect, seedSlaPolicies, loginAs } from './helpers';

describe('Ticket creation - optional "assign to" agent', () => {
  beforeEach(async () => {
    await seedSlaPolicies();
  });

  it('lets a customer request a specific active agent, and that agent can then see the ticket', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const agent = await createUserDirect('agent', { email: 'preferred-agent@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Please route this to my usual agent',
        description: 'I worked with this agent before and would like them again.',
        priority: 'medium',
        category: 'general',
        assignedAgent: String(agent._id),
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.assignedAgent._id ?? createRes.body.data.assignedAgent).toBe(String(agent._id));

    // The assigned agent must be able to see and work on the ticket.
    const agentToken = await loginAs('preferred-agent@example.com');
    const getRes = await request(app)
      .get(`/api/tickets/${createRes.body.data._id}`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(getRes.status).toBe(200);
  });

  it('falls back to auto-assignment when no agent is requested', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    await createUserDirect('agent', { email: 'auto-agent@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'No preference on agent',
        description: 'Whoever is available is fine with me.',
        priority: 'low',
        category: 'general',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.assignedAgent).not.toBeNull();
  });

  it('rejects a request that names a non-agent (or non-existent) user as the assignee', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const otherCustomer = await createUserDirect('customer', { email: 'not-an-agent@example.com' });

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Trying to assign a customer as if they were an agent',
        description: 'This should be rejected by the backend regardless of what the client sends.',
        priority: 'low',
        category: 'general',
        assignedAgent: String(otherCustomer._id),
      });

    expect(res.status).toBe(400);
  });

  it('rejects a made-up/non-existent agent id', async () => {
    const { token: customerToken } = await registerAndLogin('customer');

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Assigning to an id that does not exist',
        description: 'The backend must not trust an arbitrary client-supplied id.',
        priority: 'low',
        category: 'general',
        assignedAgent: '000000000000000000000000',
      });

    expect(res.status).toBe(400);
  });
});
