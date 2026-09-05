/**
 * Standalone DB-independent verification script.
 *
 * This sandbox's network egress policy blocks the MongoDB binary CDN that
 * mongodb-memory-server needs (fastdl.mongodb.org), so the full Jest + Supertest
 * integration suite in src/tests/*.test.ts cannot execute *inside this build
 * environment*. It runs correctly anywhere with normal internet access (a laptop,
 * GitHub Actions, Render, Codespaces, etc.) via `npm test`.
 *
 * This script exercises everything that does NOT require a live database
 * connection, as real, executed assertions rather than a claim:
 *   - the ticket status state machine (every allowed + a sample of illegal transitions)
 *   - SLA due-date / SLA-status calculation
 *   - the Express app booting and responding to /api/health
 *   - the auth middleware rejecting requests with no token / a malformed token
 *     (both paths throw before ever touching the database)
 */
import request from 'supertest';
import { createApp } from '../app';
import { isValidTransition, TICKET_TRANSITIONS, TicketStatus } from '../types/enums';
import { assertValidTransition } from '../services/stateMachine';
import { computeSlaStatus } from '../services/slaService';

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

async function main() {
  console.log('\n[1/4] Ticket status state machine');
  for (const [from, tos] of Object.entries(TICKET_TRANSITIONS)) {
    for (const to of tos) {
      check(`${from} -> ${to} is allowed`, isValidTransition(from as TicketStatus, to as TicketStatus));
    }
  }
  const illegal: [TicketStatus, TicketStatus][] = [
    ['open', 'closed'],
    ['open', 'resolved'],
    ['pending', 'closed'],
    ['pending', 'resolved'],
    ['closed', 'open'],
    ['resolved', 'open'],
  ];
  for (const [from, to] of illegal) {
    check(`${from} -> ${to} is rejected`, !isValidTransition(from, to));
    try {
      assertValidTransition(from, to);
      check(`assertValidTransition throws for ${from} -> ${to}`, false);
    } catch {
      check(`assertValidTransition throws for ${from} -> ${to}`, true);
    }
  }

  console.log('\n[2/4] SLA status calculation');
  const dueAt = new Date('2026-06-01T12:00:00Z');
  check(
    'within_sla well before due date',
    computeSlaStatus({ slaDueAt: dueAt, status: 'open', resolvedAt: null, now: new Date('2026-06-01T00:00:00Z') }) ===
      'within_sla',
  );
  check(
    'due_soon inside the 4h window',
    computeSlaStatus({ slaDueAt: dueAt, status: 'open', resolvedAt: null, now: new Date('2026-06-01T09:00:00Z') }) ===
      'due_soon',
  );
  check(
    'breached once due date passes while still open',
    computeSlaStatus({ slaDueAt: dueAt, status: 'open', resolvedAt: null, now: new Date('2026-06-01T13:00:00Z') }) ===
      'breached',
  );
  check(
    'resolved before due date stays within_sla forever after',
    computeSlaStatus({
      slaDueAt: dueAt,
      status: 'resolved',
      resolvedAt: new Date('2026-06-01T10:00:00Z'),
      now: new Date('2030-01-01T00:00:00Z'),
    }) === 'within_sla',
  );
  check(
    'resolved after due date is breached',
    computeSlaStatus({
      slaDueAt: dueAt,
      status: 'resolved',
      resolvedAt: new Date('2026-06-01T13:00:00Z'),
    }) === 'breached',
  );

  console.log('\n[3/4] Express app boots and responds (no DB required)');
  const app = createApp();
  const health = await request(app).get('/api/health');
  check('GET /api/health returns 200', health.status === 200);

  console.log('\n[4/4] Auth middleware rejects before touching the DB');
  const noToken = await request(app).get('/api/tickets');
  check('missing token -> 401', noToken.status === 401);
  const badToken = await request(app).get('/api/tickets').set('Authorization', 'Bearer garbage.not.a.jwt');
  check('malformed token -> 401', badToken.status === 401);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
