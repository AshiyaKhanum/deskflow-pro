/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Ticket } from '../models/Ticket';
import { Comment } from '../models/Comment';
import { SlaPolicy, DEFAULT_SLA_HOURS } from '../models/SlaPolicy';
import { TicketPriority, TicketCategory } from '../types/enums';
import { calculateSlaForNewTicket, computeSlaStatus } from '../services/slaService';

export const DEMO_PASSWORD = 'DeskflowDemo123!';

const CATEGORIES: TicketCategory[] = ['billing', 'technical', 'account', 'feature_request', 'bug', 'general'];

async function seed() {
  await connectDB(env.mongoUri);
  console.log(`[seed] connected to ${env.mongoUri}`);

  await Promise.all([
    User.deleteMany({}),
    Ticket.deleteMany({}),
    Comment.deleteMany({}),
    SlaPolicy.deleteMany({}),
  ]);
  console.log('[seed] cleared existing collections');

  // --- SLA Policies ---
  const priorities: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
  await SlaPolicy.insertMany(
    priorities.map((priority) => ({
      priority,
      responseTimeHours: DEFAULT_SLA_HOURS[priority].response,
      resolutionTimeHours: DEFAULT_SLA_HOURS[priority].resolution,
      isActive: true,
    })),
  );
  console.log('[seed] created SLA policies');

  // --- Users ---
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.bcryptSaltRounds);

  const admin = await User.create({
    name: 'Amara Chen',
    email: 'admin@deskflow.demo',
    passwordHash,
    role: 'admin',
    avatarColor: '#7C3AED',
  });

  const agents = await User.insertMany([
    { name: 'Jordan Blake', email: 'agent@deskflow.demo', passwordHash, role: 'agent', avatarColor: '#0EA5E9' },
    { name: 'Priya Nair', email: 'agent2@deskflow.demo', passwordHash, role: 'agent', avatarColor: '#0891B2' },
  ]);

  const customers = await User.insertMany([
    { name: 'Sam Rivera', email: 'customer@deskflow.demo', passwordHash, role: 'customer', avatarColor: '#F59E0B' },
    { name: 'Taylor Morgan', email: 'customer2@deskflow.demo', passwordHash, role: 'customer', avatarColor: '#EF4444' },
    { name: 'Nina Kapoor', email: 'customer3@deskflow.demo', passwordHash, role: 'customer', avatarColor: '#10B981' },
  ]);
  console.log('[seed] created users (admin, 2 agents, 3 customers)');

  // --- Tickets ---
  const ticketSeeds: Array<{
    title: string;
    description: string;
    priority: TicketPriority;
    category: TicketCategory;
    customer: (typeof customers)[number];
    agent: (typeof agents)[number] | null;
    status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
    ageHours: number; // how long ago it was created
    resolvedAfterHours?: number; // hours after creation it was resolved (if resolved/closed)
  }> = [
    {
      title: 'Cannot log in after password reset',
      description: 'I reset my password via email but the new password is rejected every time I try to log in.',
      priority: 'urgent',
      category: 'account',
      customer: customers[0],
      agent: agents[0],
      status: 'in_progress',
      ageHours: 2,
    },
    {
      title: 'Invoice shows incorrect tax amount',
      description: 'The invoice for March shows 18% tax but our region should be charged 12%. Please correct and reissue.',
      priority: 'high',
      category: 'billing',
      customer: customers[1],
      agent: agents[0],
      status: 'open',
      ageHours: 30,
    },
    {
      title: 'Feature request: dark mode for dashboard',
      description: 'Would love a dark mode toggle for the analytics dashboard, staring at a bright white screen all day is rough.',
      priority: 'low',
      category: 'feature_request',
      customer: customers[2],
      agent: null,
      status: 'open',
      ageHours: 96,
    },
    {
      title: 'Export to CSV produces garbled characters',
      description: 'When exporting reports to CSV, names with accented characters (e.g. "José") show up as garbled symbols.',
      priority: 'medium',
      category: 'bug',
      customer: customers[0],
      agent: agents[1],
      status: 'pending',
      ageHours: 20,
    },
    {
      title: 'API rate limit hit during normal usage',
      description: 'Our integration is hitting 429 rate limit errors even though we are well under the documented quota.',
      priority: 'urgent',
      category: 'technical',
      customer: customers[1],
      agent: agents[1],
      status: 'open',
      ageHours: 6,
    },
    {
      title: 'How do I add a teammate to my workspace?',
      description: 'I cannot find the option to invite a new teammate to our workspace. Is this a paid-plan-only feature?',
      priority: 'low',
      category: 'general',
      customer: customers[2],
      agent: agents[0],
      status: 'resolved',
      ageHours: 50,
      resolvedAfterHours: 6,
    },
    {
      title: 'Mobile app crashes on ticket submission',
      description: 'The iOS app crashes immediately after tapping "Submit" on a new ticket with an attachment.',
      priority: 'high',
      category: 'bug',
      customer: customers[0],
      agent: agents[1],
      status: 'resolved',
      ageHours: 40,
      resolvedAfterHours: 30, // resolved after 30h, resolution SLA for high = 24h -> breached-but-resolved example
    },
    {
      title: 'Requesting refund for duplicate charge',
      description: 'I was charged twice for my monthly subscription. Please refund the duplicate transaction.',
      priority: 'medium',
      category: 'billing',
      customer: customers[1],
      agent: agents[0],
      status: 'closed',
      ageHours: 200,
      resolvedAfterHours: 30,
    },
    {
      title: 'SSO login redirect loop',
      description: 'Employees using our SAML SSO connection get stuck in a redirect loop and can never reach the dashboard.',
      priority: 'urgent',
      category: 'technical',
      customer: customers[2],
      agent: agents[1],
      status: 'in_progress',
      ageHours: 5,
    },
    {
      title: 'Update billing address',
      description: 'Please update our billing address on file - we moved offices last month.',
      priority: 'low',
      category: 'account',
      customer: customers[0],
      agent: null,
      status: 'open',
      ageHours: 10,
    },
  ];

  let created = 0;
  for (const seedTicket of ticketSeeds) {
    const createdAt = new Date(Date.now() - seedTicket.ageHours * 60 * 60 * 1000);
    const { slaPolicySnapshot, slaDueAt } = await calculateSlaForNewTicket(seedTicket.priority, createdAt);

    let resolvedAt: Date | null = null;
    let closedAt: Date | null = null;
    if (seedTicket.resolvedAfterHours !== undefined) {
      resolvedAt = new Date(createdAt.getTime() + seedTicket.resolvedAfterHours * 60 * 60 * 1000);
      if (seedTicket.status === 'closed') {
        closedAt = new Date(resolvedAt.getTime() + 2 * 60 * 60 * 1000);
      }
    }

    const slaBreached =
      computeSlaStatus({ slaDueAt, status: seedTicket.status, resolvedAt }) === 'breached';

    const ticket = new Ticket({
      title: seedTicket.title,
      description: seedTicket.description,
      priority: seedTicket.priority,
      category: seedTicket.category,
      customer: seedTicket.customer._id,
      assignedAgent: seedTicket.agent ? seedTicket.agent._id : null,
      status: seedTicket.status,
      slaPolicySnapshot,
      slaDueAt,
      slaBreached,
      resolvedAt,
      closedAt,
      history: [
        { field: 'status', to: 'open', changedBy: seedTicket.customer._id, changedAt: createdAt, note: 'Ticket created' },
      ],
    });
    // createdAt/updatedAt are normally managed by timestamps: true, but seed data needs
    // realistic historical dates, so we set them explicitly after the initial save.
    await ticket.save();
    await Ticket.updateOne({ _id: ticket._id }, { $set: { createdAt } });

    // A couple of comments per ticket: one public, sometimes one internal note.
    await Comment.create({
      ticket: ticket._id,
      author: seedTicket.customer._id,
      body: 'Thanks for looking into this - let me know if you need any more details from my end.',
      visibility: 'public',
      createdAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
    });

    if (seedTicket.agent) {
      await Comment.create({
        ticket: ticket._id,
        author: seedTicket.agent._id,
        body: `Internal note: checked logs, this looks related to a known ${seedTicket.category} issue. Escalating priority if needed.`,
        visibility: 'internal',
        createdAt: new Date(createdAt.getTime() + 45 * 60 * 1000),
      });
      await Comment.create({
        ticket: ticket._id,
        author: seedTicket.agent._id,
        body: "I'm on this now, will update you shortly.",
        visibility: 'public',
        createdAt: new Date(createdAt.getTime() + 50 * 60 * 1000),
      });
    }

    created += 1;
  }
  console.log(`[seed] created ${created} tickets with comments`);
  void CATEGORIES; // referenced for clarity of available categories; not otherwise used here

  console.log('\n[seed] Demo accounts (password for all: %s)', DEMO_PASSWORD);
  console.log('  Admin:     admin@deskflow.demo');
  console.log('  Agent:     agent@deskflow.demo');
  console.log('  Agent 2:   agent2@deskflow.demo');
  console.log('  Customer:  customer@deskflow.demo');
  console.log('  Customer2: customer2@deskflow.demo');
  console.log('  Customer3: customer3@deskflow.demo');

  void admin;
  await disconnectDB();
  console.log('\n[seed] done.');
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
