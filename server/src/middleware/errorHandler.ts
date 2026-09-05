import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err && typeof err === 'object' && 'name' in err) {
    const anyErr = err as { name: string; message?: string; code?: number; keyValue?: unknown };
    if (anyErr.name === 'ValidationError') {
      statusCode = 422;
      message = anyErr.message ?? 'Validation failed';
    } else if (anyErr.name === 'CastError') {
      statusCode = 400;
      message = 'Invalid identifier supplied';
    } else if (anyErr.code === 11000) {
      statusCode = 409;
      message = 'Duplicate value violates a unique constraint';
      details = anyErr.keyValue;
    }
  }

  if (statusCode === 500) {
    // Never leak internal error details/stack traces to clients.
    // eslint-disable-next-line no-console
    console.error('[error]', err);
    message = env.nodeEnv === 'production' ? 'Internal server error' : message || 'Internal server error';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details !== undefined ? { details } : {}),
  });
}
