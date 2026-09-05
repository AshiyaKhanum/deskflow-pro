import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as slaAdminService from '../services/slaPolicyAdminService';

export const listSlaPolicies = asyncHandler(async (_req: Request, res: Response) => {
  const policies = await slaAdminService.listSlaPolicies();
  res.status(200).json({ success: true, data: policies });
});

export const createSlaPolicy = asyncHandler(async (req: Request, res: Response) => {
  const policy = await slaAdminService.upsertSlaPolicy(req.body);
  res.status(201).json({ success: true, data: policy });
});

export const updateSlaPolicy = asyncHandler(async (req: Request, res: Response) => {
  const policy = await slaAdminService.updateSlaPolicy(req.params.id, req.body);
  res.status(200).json({ success: true, data: policy });
});
