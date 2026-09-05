import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { Role } from '../types/enums';

/**
 * Verifies the JWT on the request (Authorization: Bearer <token>) and attaches
 * req.user = { id, role }. This is the single source of truth for "who is calling" -
 * the frontend hiding buttons is a UX nicety only, never the security boundary.
 */
export function authenticate() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        throw ApiError.unauthorized('Authentication token missing');
      }
      const token = header.slice('Bearer '.length).trim();
      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        throw ApiError.unauthorized('Invalid or expired token');
      }

      const user = await User.findById(payload.sub).select('_id role isActive').lean();
      if (!user) {
        throw ApiError.unauthorized('User no longer exists');
      }
      if (!user.isActive) {
        throw ApiError.forbidden('Account has been deactivated');
      }

      req.user = { id: String(user._id), role: user.role };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Role guard - always runs server-side, independent of anything the client sends or hides. */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Role '${req.user.role}' is not permitted to perform this action`));
    }
    next();
  };
}
