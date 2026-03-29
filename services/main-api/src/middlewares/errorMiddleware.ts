import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { UnauthorizedError } from 'express-oauth2-jwt-bearer';
import { AppError } from '../types';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler: ErrorRequestHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof UnauthorizedError) {
    res.status(401).json({
      error: 'Unauthorized',
      message: err.message,
      code: err.status,
    });
    return;
  }

  const statusCode = err.status || (res.statusCode === 200 ? 500 : res.statusCode);

  res.status(statusCode).json({
    error: err instanceof Error ? err.name : 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
    code: err.code || 'server_error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    timestamp: new Date().toISOString(),
  });
<<<<<<< HEAD
};
=======
};

export const errorMiddleware = errorHandler;
>>>>>>> copilot-worktree-2026-03-29T13-10-03
