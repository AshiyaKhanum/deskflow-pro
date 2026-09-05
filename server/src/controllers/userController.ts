import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as userService from '../services/userService';
import { toPublicUser } from '../services/authService';
import { ApiError } from '../utils/ApiError';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { users, pagination } = await userService.listUsers(req.query as Record<string, string>);
  res.status(200).json({ success: true, data: { users: users.map(toPublicUser), pagination } });
});

export const listAgents = asyncHandler(async (_req: Request, res: Response) => {
  const agents = await userService.listActiveAgents();
  res.status(200).json({ success: true, data: agents.map(toPublicUser) });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  res.status(200).json({ success: true, data: toPublicUser(user) });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUserByAdmin(req.body);
  res.status(201).json({ success: true, data: toPublicUser(user) });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await userService.updateUser(req.params.id, req.body, req.user.id);
  res.status(200).json({ success: true, data: toPublicUser(user) });
});
