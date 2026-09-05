import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as commentService from '../services/commentService';
import { ApiError } from '../utils/ApiError';

export const listComments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const comments = await commentService.listCommentsForTicket(req.params.id, req.user.id, req.user.role);
  res.status(200).json({ success: true, data: comments });
});

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const comment = await commentService.addComment(
    req.params.id,
    req.body.body,
    req.body.visibility,
    req.user.id,
    req.user.role,
  );
  res.status(201).json({ success: true, data: comment });
});
