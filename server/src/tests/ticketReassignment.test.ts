import request from 'supertest';
import { app, createUserDirect, registerAndLogin, seedSlaPolicies } from './helpers';

/**
 * Agents and customers can now (re)assign a ticket, not just admins (previously
 * ticketService.updateTicket rejected any non-admin-supplied assignedAgent with 403
 * "Only admins can (re)assign tickets", so once a ticket had an assignee there was no
 * way for anyone else to hand it to someone new).
 *
 * This is still scoped by the existing visibility rule (assertCanViewTicket): an agent
 * can only reassign a ticket that's already in their own queue (assigned to them or
 * created by them), and a customer only a ticket they filed or are themselves assigned
 * to - never an arbitrary ticket elsewhere in the system. A customer is further
 * restricted to touching assignedAgent alone; every other field stays off-limits to them.
 */
describe('Ticket reassignment permissions', () => {
  beforeEach(async () => {
    await seedSlaPolicies();
  });

  it('lets an agent reassign a ticket assigned to them to a teammate', async () => {
    const { user: agent, token: agentToken } = await registerAndLogin('agent', {
      email: 'agent-reassign-owner@example.com',
    });
    const teammate = await createUserDirect('agent', { email: 'agent-reassign-teammate@example.com' });
    const { token: customerToken } = await registerAndLogin('customer', {
      email: 'customer-reassign@example.com',
    });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Needs a specialist',
        description: 'This requires someone with billing expertise to take a look.',
        priority: 'medium',
        category: 'billing',
        assignedAgent: String(agent._id),
      });
    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.data._id;

    const reassignRes = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ assignedAgent: String(teammate._id) });

    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.data.assignedAgent._id ?? reassignRes.body.data.assignedAgent).toBe(
      String(teammate._id),
    );
  });

  it('lets an admin reassign any ticket, as before', async () => {
    const { token: adminToken } = await registerAndLogin('admin', { email: 'admin-reassign@example.com' });
    const { token: customerToken } = await registerAndLogin('customer', {
      email: 'customer-reassign-2@example.com',
    });
    const newAgent = await createUserDirect('agent', { email: 'agent-reassign-target@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Needs assignment',
        description: 'Nobody has picked this up yet.',
        priority: 'low',
        category: 'general',
      });
    const ticketId = createRes.body.data._id;

    const reassignRes = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignedAgent: String(newAgent._id) });

    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.data.assignedAgent._id ?? reassignRes.body.data.assignedAgent).toBe(
      String(newAgent._id),
    );
  });

  it("still blocks an agent from touching a ticket outside their own queue (not their assignment or creation)", async () => {
    const { token: outsiderToken } = await registerAndLogin('agent', {
      email: 'agent-outsider@example.com',
    });
    const { token: ownerAgentToken } = await registerAndLogin('agent', { email: 'agent-owner@example.com' });
    const { token: customerToken } = await registerAndLogin('customer', {
      email: 'customer-reassign-3@example.com',
    });
    const someTeammate = await createUserDirect('agent', { email: 'agent-reassign-someone@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: "Someone else's ticket",
        description: 'This belongs to a different agent entirely.',
        priority: 'low',
        category: 'general',
      });
    const ticketId = createRes.body.data._id;
    // Have the owning agent claim it first, so it's genuinely outside the outsider's queue.
    await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${ownerAgentToken}`)
      .send({ assignedAgent: String(someTeammate._id) });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ assignedAgent: String(someTeammate._id) });

    expect([403, 404]).toContain(res.status);
  });

  it('lets a customer reassign their own ticket - the same choice they can already make at creation time', async () => {
    const { token: customerToken } = await registerAndLogin('customer', {
      email: 'customer-self-reassign@example.com',
    });
    const agent = await createUserDirect('agent', { email: 'agent-set-by-customer@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'My own ticket',
        description: 'Filed by me, for me.',
        priority: 'low',
        category: 'general',
      });
    const ticketId = createRes.body.data._id;

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ assignedAgent: String(agent._id) });

    expect(res.status).toBe(200);
    expect(res.body.data.assignedAgent._id ?? res.body.data.assignedAgent).toBe(String(agent._id));
  });

  it('still blocks a customer from changing any other field, even bundled with a valid reassignment', async () => {
    const { token: customerToken } = await registerAndLogin('customer', {
      email: 'customer-mixed-update@example.com',
    });
    const agent = await createUserDirect('agent', { email: 'agent-mixed-update@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Attempted mixed update',
        description: 'Trying to sneak a priority change in alongside a reassignment.',
        priority: 'low',
        category: 'general',
      });
    const ticketId = createRes.body.data._id;

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ assignedAgent: String(agent._id), priority: 'urgent' });

    expect(res.status).toBe(403);
  });

  it("still blocks a customer from reassigning a ticket that isn't theirs and isn't assigned to them", async () => {
    const { token: ownerToken } = await registerAndLogin('customer', { email: 'owner-of-ticket@example.com' });
    const { token: outsiderToken } = await registerAndLogin('customer', {
      email: 'outsider-customer@example.com',
    });
    const someAgent = await createUserDirect('agent', { email: 'agent-for-outsider-test@example.com' });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: "Owner's ticket",
        description: 'This belongs to a different customer entirely.',
        priority: 'low',
        category: 'general',
      });
    const ticketId = createRes.body.data._id;

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ assignedAgent: String(someAgent._id) });

    expect([403, 404]).toContain(res.status);
  });

  it('rejects an assignedAgent that does not reference an active, eligible user', async () => {
    const { user: agent, token: agentToken } = await registerAndLogin('agent', {
      email: 'agent-bad-target@example.com',
    });
    const { token: customerToken } = await registerAndLogin('customer', {
      email: 'customer-reassign-4@example.com',
    });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Needs valid reassignment',
        description: 'Trying to reassign to a bogus id.',
        priority: 'low',
        category: 'general',
        assignedAgent: String(agent._id),
      });
    const ticketId = createRes.body.data._id;

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ assignedAgent: '000000000000000000000000' });

    expect(res.status).toBe(400);
  });
});
