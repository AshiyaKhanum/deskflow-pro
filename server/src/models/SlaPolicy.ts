import { Schema, model, Document, Types } from 'mongoose';
import { TICKET_PRIORITIES, TicketPriority } from '../types/enums';

export interface ISlaPolicy extends Document {
  _id: Types.ObjectId;
  priority: TicketPriority;
  responseTimeHours: number;
  resolutionTimeHours: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const slaPolicySchema = new Schema<ISlaPolicy>(
  {
    priority: {
      type: String,
      enum: TICKET_PRIORITIES,
      required: true,
      unique: true,
    },
    responseTimeHours: {
      type: Number,
      required: true,
      min: 0.25,
    },
    resolutionTimeHours: {
      type: Number,
      required: true,
      min: 0.5,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const SlaPolicy = model<ISlaPolicy>('SlaPolicy', slaPolicySchema);

/** Hard-coded fallback defaults, used only if no policy document exists for a priority. */
export const DEFAULT_SLA_HOURS: Record<TicketPriority, { response: number; resolution: number }> = {
  low: { response: 24, resolution: 72 },
  medium: { response: 8, resolution: 48 },
  high: { response: 4, resolution: 24 },
  urgent: { response: 1, resolution: 4 },
};
