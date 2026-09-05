import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as authService from '../services/authService';
import { ApiError } from '../utils/ApiError';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  res.status(200).json({ success: true, data: result });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  // JWTs are stateless; logout is a client-side action (discard the token).
  // Endpoint exists so the frontend has a clean, explicit contract to call.
  res.status(200).json({ success: true, message: 'Logged out' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ success: true, data: user });
});
