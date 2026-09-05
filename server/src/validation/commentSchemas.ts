import { z } from 'zod';
import { COMMENT_VISIBILITY } from '../types/enums';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
  visibility: z.enum(COMMENT_VISIBILITY).default('public'),
});
