import { isValidTransition, TICKET_TRANSITIONS } from '../types/enums';
import { assertValidTransition } from '../services/stateMachine';
import request from 'supertest';
import { app, registerAndLogin, seedSlaPolicies } from './helpers';

describe('Ticket status state machine (unit)', () => {
  it('allows every explicitly defined transition', () => {
    for (const [from, tos] of Object.entries(TICKET_TRANSITIONS)) {
      for (const to of tos) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(isValidTransition(from as any, to as any)).toBe(true);
      }
    }
  });

  it('rejects the classic illegal transition open -> closed', () => {
    expect(isValidTransition('open', 'closed')).toBe(false);
    expect(() => assertValidTransition('open', 'closed')).toThrow();
  });

  it('rejects transitioning a status to itself', () => {
    expect(() => assertValidTransition('open', 'open')).toThrow();
  });

  it('rejects resolved -> open (not a defined transition)', () => {
    expect(isValidTransition('resolved', 'open')).toBe(false);
  });

  it('closed is a terminal state with no outgoing transitions', () => {
    expect(TICKET_TRANSITIONS.closed).toHaveLength(0);
  });
});

describe('Ticket status state machine (API)', () => {
  beforeEach(async () => {
    await seedSlaPolicies();
  });

  it('allows a valid transition (open -> in_progress) and rejects an invalid one (open -> closed)', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const { token: agentToken } = await registerAndLogin('agent');

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ title: 'Test ticket', description: 'Something is broken, please help.', priority: 'medium', category: 'bug' });
    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.data._id;
    expect(createRes.body.data.status).toBe('open');

    const invalid = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'closed' });
    expect(invalid.status).toBe(400);

    const valid = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'in_progress' });
    expect(valid.status).toBe(200);
    expect(valid.body.data.status).toBe('in_progress');
  });

  it('forbids customers from changing ticket status at all', async () => {
    const { token: customerToken } = await registerAndLogin('customer');
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ title: 'Another ticket', description: 'Please look into this issue soon.', priority: 'low', category: 'general' });
    const ticketId = createRes.body.data._id;

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(403);
  });
});
