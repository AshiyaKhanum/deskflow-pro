import { Badge } from './ui/Badge';
import { SlaStatus, TicketPriority, TicketStatus } from '../types';
import {
  PRIORITY_LABELS,
  SLA_LABELS,
  STATUS_LABELS,
  priorityBadgeVariant,
  slaBadgeVariant,
  statusBadgeVariant,
} from '../utils/format';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={statusBadgeVariant(status)}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge variant={priorityBadgeVariant(priority)}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function SlaBadge({ sla }: { sla: SlaStatus }) {
  return <Badge variant={slaBadgeVariant(sla)}>{SLA_LABELS[sla]}</Badge>;
}
