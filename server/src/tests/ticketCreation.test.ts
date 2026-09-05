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

  it('leaves the ticket unassigned when no agent is requested - never auto-picks one', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    // Even with an active agent in the system, the ticket must NOT be auto-assigned
    // to them (there is no more "least busy agent" fallback).
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
    expect(createRes.body.data.assignedAgent).toBeNull();
  });

  it('lets a customer request another customer as the assignee (customers are an eligible assignee role)', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const otherCustomer = await createUserDirect('customer', { email: 'assignee-customer@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Assigning to a fellow customer',
        description: 'Customers are an explicitly eligible assignee role in this app.',
        priority: 'low',
        category: 'general',
        assignedAgent: String(otherCustomer._id),
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.assignedAgent._id ?? createRes.body.data.assignedAgent).toBe(
      String(otherCustomer._id),
    );

    // The assignee must be able to see the ticket even though they didn't file it.
    const assigneeToken = await loginAs('assignee-customer@example.com');
    const getRes = await request(app)
      .get(`/api/tickets/${createRes.body.data._id}`)
      .set('Authorization', `Bearer ${assigneeToken}`);
    expect(getRes.status).toBe(200);
  });

  it('lets a customer request an active admin as the assignee (admins are also an eligible assignee role)', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const admin = await createUserDirect('admin', { email: 'assignee-admin@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Escalating directly to an admin',
        description: 'Admins are an explicitly eligible assignee role in this app.',
        priority: 'low',
        category: 'general',
        assignedAgent: String(admin._id),
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.assignedAgent._id ?? createRes.body.data.assignedAgent).toBe(String(admin._id));

    // Admins can already see every ticket regardless of assignment - confirm access still works.
    const adminToken = await loginAs('assignee-admin@example.com');
    const getRes = await request(app)
      .get(`/api/tickets/${createRes.body.data._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
  });

  it('rejects a request that names a deactivated user, even though their role is otherwise eligible', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const inactiveAgent = await createUserDirect('agent', {
      email: 'inactive-agent@example.com',
      isActive: false,
    });

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Assigning to a deactivated agent',
        description: 'Deactivated accounts must never be assignable, regardless of role.',
        priority: 'low',
        category: 'general',
        assignedAgent: String(inactiveAgent._id),
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
