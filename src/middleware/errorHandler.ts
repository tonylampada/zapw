import { Request, Response, NextFunction } from 'express';
import { SessionNotFoundError, SessionAlreadyExistsError } from '../models/errors';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Error:', err.stack);

  if (err instanceof SessionNotFoundError) {
    res.status(404).json({
      error: 'Session Not Found',
      message: err.message,
      statusCode: 404
    });
    return;
  }

  if (err instanceof SessionAlreadyExistsError) {
    res.status(409).json({
      error: 'Session Already Exists',
      message: err.message,
      statusCode: 409
    });
    return;
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    statusCode: 500
  });
}