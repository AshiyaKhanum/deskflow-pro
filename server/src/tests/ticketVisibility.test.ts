import request from 'supertest';
import { app, createUserDirect, loginAs, registerAndLogin, seedSlaPolicies } from './helpers';

/**
 * DeskFlow's role-based ticket visibility rule, enforced at the API layer (not just
 * hidden in the React UI - see ticketService.baseScopeFilter / assertCanViewTicket):
 *
 *   ADMIN    -> every ticket
 *   AGENT    -> tickets assigned to them, or created by them
 *   CUSTOMER -> tickets they created, or that they've been made the assignee of
 *
 * Anything outside those buckets must be invisible both in the list endpoint and
 * when fetched directly by id (no leaking existence via a 200/403 split).
 */
describe('Role-based ticket visibility', () => {
  beforeEach(async () => {
    await seedSlaPolicies();
  });

  async function createTicketAs(token: string, overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: overrides.title ?? 'A ticket',
        description: overrides.description ?? 'Enough detail to pass validation.',
        priority: 'medium',
        category: 'general',
        ...overrides,
      });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  it('lets an admin see every ticket in the system, regardless of who filed or is assigned to it', async () => {
    const { token: adminToken } = await registerAndLogin('admin', { email: 'admin-sees-all@example.com' });
    const { token: aliceToken } = await registerAndLogin('customer', { email: 'alice-visibility@example.com' });
    const { token: bobToken } = await registerAndLogin('customer', { email: 'bob-visibility@example.com' });

    const t1 = await createTicketAs(aliceToken, { title: "Alice's ticket" });
    const t2 = await createTicketAs(bobToken, { title: "Bob's ticket" });

    const listRes = await request(app).get('/api/tickets').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.tickets.map((t: { _id: string }) => t._id);
    expect(ids).toEqual(expect.arrayContaining([t1._id, t2._id]));
  });

  it("a customer sees only tickets they created and tickets they're assigned to - not unrelated ones", async () => {
    const { token: aliceToken, user: alice } = await registerAndLogin('customer', {
      email: 'alice-scope@example.com',
    });
    await createUserDirect('customer', { email: 'bob-scope@example.com' });
    const bobToken = await loginAs('bob-scope@example.com');

    const ownTicket = await createTicketAs(aliceToken, { title: "Alice's own ticket" });
    const assignedToAlice = await createTicketAs(bobToken, {
      title: 'Assigned to Alice by Bob',
      assignedAgent: String(alice._id),
    });
    const unrelated = await createTicketAs(bobToken, { title: "Bob's unrelated ticket" });

    const listRes = await request(app).get('/api/tickets').set('Authorization', `Bearer ${aliceToken}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.tickets.map((t: { _id: string }) => t._id);
    expect(ids).toEqual(expect.arrayContaining([ownTicket._id, assignedToAlice._id]));
    expect(ids).not.toContain(unrelated._id);

    // Direct-by-id fetch must independently enforce the same boundary.
    const directRes = await request(app)
      .get(`/api/tickets/${unrelated._id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(directRes.status).toBe(404);
  });

  it('an agent sees only tickets assigned to them - not the general unassigned queue, not unrelated tickets', async () => {
    const sanu = await createUserDirect('agent', { name: 'Sanu', email: 'sanu-scope@example.com' });
    const sanuToken = await loginAs('sanu-scope@example.com');
    const { token: customerToken } = await registerAndLogin('customer', { email: 'filer-scope@example.com' });

    const assignedToSanu = await createTicketAs(customerToken, {
      title: "Sanu's assigned ticket",
      assignedAgent: String(sanu._id),
    });
    const unassigned = await createTicketAs(customerToken, { title: 'Nobody has picked this up yet' });
    const assignedToSomeoneElse = await createTicketAs(customerToken, {
      title: "Someone else's ticket",
      assignedAgent: String((await createUserDirect('agent', { email: 'rahul-scope@example.com' }))._id),
    });

    const listRes = await request(app).get('/api/tickets').set('Authorization', `Bearer ${sanuToken}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.tickets.map((t: { _id: string }) => t._id);
    expect(ids).toContain(assignedToSanu._id);
    expect(ids).not.toContain(unassigned._id);
    expect(ids).not.toContain(assignedToSomeoneElse._id);

    // Direct-by-id fetch must independently enforce the same boundary - an agent
    // cannot view a ticket they have no relationship to just by knowing its id.
    const directRes = await request(app)
      .get(`/api/tickets/${assignedToSomeoneElse._id}`)
      .set('Authorization', `Bearer ${sanuToken}`);
    expect(directRes.status).toBe(404);

    // But they CAN view the one actually assigned to them.
    const ownRes = await request(app)
      .get(`/api/tickets/${assignedToSanu._id}`)
      .set('Authorization', `Bearer ${sanuToken}`);
    expect(ownRes.status).toBe(200);
  });

  it('the Dashboard "filter by assignee" query (assignedAgent=<id>) returns only that person\'s tickets, for any role', async () => {
    const { token: adminToken } = await registerAndLogin('admin', { email: 'admin-filter@example.com' });
    const john = await createUserDirect('admin', { name: 'John', email: 'john-filter@example.com' });
    const { token: customerToken } = await registerAndLogin('customer', { email: 'filer-filter@example.com' });

    const assignedToJohn = await createTicketAs(customerToken, {
      title: "John's ticket",
      assignedAgent: String(john._id),
    });
    await createTicketAs(customerToken, { title: 'Not assigned to John' });

    const res = await request(app)
      .get('/api/tickets')
      .query({ assignedAgent: String(john._id) })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.tickets.map((t: { _id: string }) => t._id);
    expect(ids).toEqual([assignedToJohn._id]);
  });
});
