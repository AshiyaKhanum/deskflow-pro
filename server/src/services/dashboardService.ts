import { Ticket } from '../models/Ticket';
import { User } from '../models/User';
import { Types } from 'mongoose';

const DUE_SOON_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * Everything here is computed with MongoDB aggregation pipelines against the live
 * collections - nothing is hard-coded and nothing downloads the full ticket set into
 * Node to sum it up in JS. Each function is one focused aggregate() call.
 */
export async function getTicketStatusCounts() {
  const rows = await Ticket.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const counts: Record<string, number> = {
    open: 0,
    in_progress: 0,
    pending: 0,
    resolved: 0,
    closed: 0,
  };
  let total = 0;
  for (const row of rows) {
    counts[row._id] = row.count;
    total += row.count;
  }
  return { total, ...counts };
}

export async function getPriorityBreakdown() {
  const rows = await Ticket.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$priority', count: { $sum: 1 } } },
  ]);
  const counts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

export async function getSlaSummary() {
  const now = new Date();
  const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

  const [breachedOpen, dueSoonOpen, totalOpenAgg, resolvedStats] = await Promise.all([
    // Breached & still open (not resolved/closed): due date already passed.
    Ticket.countDocuments({ status: { $nin: ['resolved', 'closed'] }, slaDueAt: { $lt: now } }),
    // Due soon: within the window, not yet breached, still open.
    Ticket.countDocuments({
      status: { $nin: ['resolved', 'closed'] },
      slaDueAt: { $gte: now, $lte: dueSoonCutoff },
    }),
    Ticket.countDocuments({ status: { $nin: ['resolved', 'closed'] } }),
    // SLA compliance among tickets that have actually resolved: did resolvedAt beat slaDueAt?
    Ticket.aggregate<{ _id: null; resolvedCount: number; metCount: number }>([
      { $match: { resolvedAt: { $ne: null } } },
      {
        $group: {
          _id: null,
          resolvedCount: { $sum: 1 },
          metCount: { $sum: { $cond: [{ $lte: ['$resolvedAt', '$slaDueAt'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const resolved = resolvedStats[0] ?? { resolvedCount: 0, metCount: 0 };
  const slaComplianceRate =
    resolved.resolvedCount > 0 ? Math.round((resolved.metCount / resolved.resolvedCount) * 1000) / 10 : null;

  return {
    breachedOpenCount: breachedOpen,
    dueSoonCount: dueSoonOpen,
    totalOpenCount: totalOpenAgg,
    slaComplianceRate, // percentage, or null if nothing has resolved yet
    resolvedWithinSlaCount: resolved.metCount,
    resolvedCount: resolved.resolvedCount,
  };
}

export async function getPerformanceStats(rangeDays = 30) {
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const [createdInRange, resolvedInRange, avgResolutionAgg, currentlyOpen] = await Promise.all([
    Ticket.countDocuments({ createdAt: { $gte: since } }),
    Ticket.countDocuments({ resolvedAt: { $gte: since } }),
    Ticket.aggregate<{ _id: null; avgHours: number }>([
      { $match: { resolvedAt: { $ne: null } } },
      {
        $project: {
          resolutionHours: {
            $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
          },
        },
      },
      { $group: { _id: null, avgHours: { $avg: '$resolutionHours' } } },
    ]),
    Ticket.countDocuments({ status: { $nin: ['resolved', 'closed'] } }),
  ]);

  return {
    ticketsCreated: createdInRange,
    ticketsResolved: resolvedInRange,
    ticketsCurrentlyOpen: currentlyOpen,
    averageResolutionHours: avgResolutionAgg[0]?.avgHours
      ? Math.round(avgResolutionAgg[0].avgHours * 10) / 10
      : null,
    rangeDays,
  };
}

export async function getAgentWorkload() {
  const agents = await User.find({ role: 'agent' }).select('_id name email isActive').lean();

  const rows = await Ticket.aggregate<{
    _id: Types.ObjectId;
    assigned: number;
    open: number;
    resolved: number;
    breached: number;
  }>([
    { $match: { assignedAgent: { $ne: null } } },
    {
      $group: {
        _id: '$assignedAgent',
        assigned: { $sum: 1 },
        open: { $sum: { $cond: [{ $not: [{ $in: ['$status', ['resolved', 'closed']] }] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        breached: { $sum: { $cond: ['$slaBreached', 1, 0] } },
      },
    },
  ]);

  const byAgent = new Map(rows.map((r) => [String(r._id), r]));
  return agents.map((agent) => {
    const stats = byAgent.get(String(agent._id));
    return {
      agentId: String(agent._id),
      name: agent.name,
      email: agent.email,
      isActive: agent.isActive,
      assignedCount: stats?.assigned ?? 0,
      openCount: stats?.open ?? 0,
      resolvedCount: stats?.resolved ?? 0,
      breachedCount: stats?.breached ?? 0,
    };
  });
}

export async function getRecentActivity(limit = 10) {
  return Ticket.find()
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate('customer', 'name email')
    .populate('assignedAgent', 'name email role')
    .select('ticketNumber title status priority updatedAt createdAt customer assignedAgent');
}

export async function getDashboardStats() {
  const [statusCounts, priorityBreakdown, sla, performance, agentWorkload, recentActivity] = await Promise.all([
    getTicketStatusCounts(),
    getPriorityBreakdown(),
    getSlaSummary(),
    getPerformanceStats(),
    getAgentWorkload(),
    getRecentActivity(),
  ]);

  return { statusCounts, priorityBreakdown, sla, performance, agentWorkload, recentActivity };
}
