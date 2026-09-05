import { Schema, model, Document, Types } from 'mongoose';
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '../types/enums';

export interface ITicketHistoryEntry {
  field: string;
  from?: string;
  to?: string;
  changedBy: Types.ObjectId;
  changedAt: Date;
  note?: string;
}

export interface ITicket extends Document {
  _id: Types.ObjectId;
  ticketNumber: number;
  title: string;
  description: string;
  customer: Types.ObjectId;
  createdBy: Types.ObjectId | null;
  assignedAgent: Types.ObjectId | null;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  slaPolicySnapshot: {
    priority: TicketPriority;
    responseTimeHours: number;
    resolutionTimeHours: number;
  };
  slaDueAt: Date;
  slaBreached: boolean;
  history: ITicketHistoryEntry[];
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const historyEntrySchema = new Schema<ITicketHistoryEntry>(
  {
    field: { type: String, required: true },
    from: { type: String },
    to: { type: String },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: () => new Date() },
    note: { type: String },
  },
  { _id: false },
);

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: {
      type: Number,
      unique: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: 10,
      maxlength: 10000,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Who actually performed the create action - the customer themselves when they
    // file their own ticket (same value as `customer`), or the agent when an agent
    // files a ticket on a customer's behalf (see ticketService.createTicket). Kept
    // separate from `customer` (who the ticket is ABOUT/owned by) so an agent who
    // files a ticket for someone else can still find it under "tickets I created",
    // even if they never assign it to themselves. Not `required` at the schema level
    // so existing tickets from before this field existed keep saving/updating fine;
    // every ticket created going forward always has it set.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedAgent: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITIES,
      required: true,
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: TICKET_STATUSES,
      required: true,
      default: 'open',
      index: true,
    },
    category: {
      type: String,
      enum: TICKET_CATEGORIES,
      required: true,
      default: 'general',
      index: true,
    },
    slaPolicySnapshot: {
      priority: { type: String, enum: TICKET_PRIORITIES, required: true },
      responseTimeHours: { type: Number, required: true },
      resolutionTimeHours: { type: Number, required: true },
    },
    slaDueAt: {
      type: Date,
      required: true,
      index: true,
    },
    slaBreached: {
      type: Boolean,
      default: false,
      index: true,
    },
    history: {
      type: [historyEntrySchema],
      default: [],
    },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Auto-increment a human-friendly ticket number (e.g. #1042) without extra collections.
ticketSchema.pre('save', async function assignTicketNumber(next) {
  if (this.isNew && this.ticketNumber === undefined) {
    const last = await Ticket.findOne({}, { ticketNumber: 1 }).sort({ ticketNumber: -1 }).lean();
    this.ticketNumber = last?.ticketNumber ? last.ticketNumber + 1 : 1001;
  }
  next();
});

// Support search by title, and common list/filter/sort combinations.
ticketSchema.index({ title: 'text', description: 'text' });
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });
ticketSchema.index({ customer: 1, createdAt: -1 });
ticketSchema.index({ assignedAgent: 1, status: 1 });

export const Ticket = model<ITicket>('Ticket', ticketSchema);
