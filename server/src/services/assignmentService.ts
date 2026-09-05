import { User } from '../models/User';
import { Ticket } from '../models/Ticket';
import { Types } from 'mongoose';

/**
 * Assignment strategy: least-loaded active agent.
 * Picks the active agent with the fewest currently-open (not resolved/closed) tickets,
 * so new tickets are spread evenly across the team instead of piling on one person.
 * Returns null (unassigned) if there are no active agents yet - the ticket lands in the
 * unassigned queue and any agent/admin can pick it up.
 */
export async function pickAgentForAssignment(): Promise<Types.ObjectId | null> {
  const agents = await User.find({ role: 'agent', isActive: true }).select('_id').lean();
  if (agents.length === 0) return null;

  const workloads = await Ticket.aggregate<{ _id: Types.ObjectId; openCount: number }>([
    { $match: { assignedAgent: { $in: agents.map((a) => a._id) }, status: { $nin: ['resolved', 'closed'] } } },
    { $group: { _id: '$assignedAgent', openCount: { $sum: 1 } } },
  ]);

  const loadByAgent = new Map<string, number>(agents.map((a) => [String(a._id), 0]));
  for (const w of workloads) {
    loadByAgent.set(String(w._id), w.openCount);
  }

  let chosen = agents[0]._id;
  let lowest = Infinity;
  for (const agent of agents) {
    const load = loadByAgent.get(String(agent._id)) ?? 0;
    if (load < lowest) {
      lowest = load;
      chosen = agent._id;
    }
  }
  return chosen;
}
