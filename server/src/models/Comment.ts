import { Schema, model, Document, Types } from 'mongoose';
import { COMMENT_VISIBILITY, CommentVisibility } from '../types/enums';

export interface IComment extends Document {
  _id: Types.ObjectId;
  ticket: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
  visibility: CommentVisibility;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    ticket: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },
    visibility: {
      type: String,
      enum: COMMENT_VISIBILITY,
      default: 'public',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

// Compound index: fetching a ticket's comments filtered by visibility is the hot path,
// and this is also what makes the customer-safe query (ticket + visibility=public) fast.
commentSchema.index({ ticket: 1, visibility: 1, createdAt: 1 });

export const Comment = model<IComment>('Comment', commentSchema);
