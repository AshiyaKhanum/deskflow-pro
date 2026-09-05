import { computeSlaStatus } from '../services/slaService';
import request from 'supertest';
import { app, registerAndLogin, seedSlaPolicies } from './helpers';

describe('SLA calculation (unit)', () => {
  it('is within_sla well before the due date', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const slaDueAt = new Date('2026-01-02T00:00:00Z');
    expect(computeSlaStatus({ slaDueAt, status: 'open', resolvedAt: null, now })).toBe('within_sla');
  });

  it('is due_soon within the 4-hour window before the deadline', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const slaDueAt = new Date('2026-01-01T02:00:00Z');
    expect(computeSlaStatus({ slaDueAt, status: 'open', resolvedAt: null, now })).toBe('due_soon');
  });

  it('is breached once the due date has passed and the ticket is still open', () => {
    const now = new Date('2026-01-02T00:00:01Z');
    const slaDueAt = new Date('2026-01-02T00:00:00Z');
    expect(computeSlaStatus({ slaDueAt, status: 'open', resolvedAt: null, now })).toBe('breached');
  });

  it('a resolved ticket is judged against its resolvedAt, not "now"', () => {
    const slaDueAt = new Date('2026-01-02T00:00:00Z');
    const resolvedAt = new Date('2026-01-01T12:00:00Z'); // resolved well before due date
    const farFuture = new Date('2027-01-01T00:00:00Z'); // "now" is irrelevant once resolved
    expect(computeSlaStatus({ slaDueAt, status: 'resolved', resolvedAt, now: farFuture })).toBe('within_sla');
  });

  it('a ticket resolved after its due date is breached even though it is closed', () => {
    const slaDueAt = new Date('2026-01-02T00:00:00Z');
    const resolvedAt = new Date('2026-01-03T00:00:00Z'); // resolved a day late
    expect(computeSlaStatus({ slaDueAt, status: 'resolved', resolvedAt })).toBe('breached');
  });
});

describe('SLA calculation (API - due date set on creation)', () => {
  beforeEach(async () => {
    await seedSlaPolicies();
  });

  it('automatically calculates slaDueAt on ticket creation based on priority (urgent = 4h resolution)', async () => {
    const { token } = await registerAndLogin('customer');
    const before = Date.now();
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Urgent outage', description: 'Production is completely down for all users right now.', priority: 'urgent', category: 'technical' });

    expect(res.status).toBe(201);
    expect(res.body.data.slaDueAt).toBeDefined();
    const dueAt = new Date(res.body.data.slaDueAt).getTime();
    const createdAt = new Date(res.body.data.createdAt).getTime();
    const diffHours = (dueAt - createdAt) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(4, 1);
    expect(dueAt).toBeGreaterThan(before);
    expect(res.body.data.slaStatus).toBe('within_sla');
  });

  it('never relies on the client to supply an SLA due date', async () => {
    const { token } = await registerAndLogin('customer');
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Trying to fake the SLA',
        description: 'Attempting to pass an slaDueAt directly, which should be ignored.',
        priority: 'low',
        category: 'general',
        slaDueAt: '2099-01-01T00:00:00Z',
      });
    expect(res.status).toBe(201);
    expect(new Date(res.body.data.slaDueAt).getFullYear()).toBeLessThan(2099);
  });
});
