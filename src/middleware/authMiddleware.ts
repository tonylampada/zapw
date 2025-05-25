import { Request, Response, NextFunction } from 'express';

const EXCLUDED_PATHS = ['/health', '/'];

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip authentication if API_KEY is not configured
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return next();
  }

  // Skip authentication for excluded paths
  if (EXCLUDED_PATHS.includes(req.path)) {
    return next();
  }

  // Check for API key in headers
  const authHeader = req.headers.authorization;
  const xApiKey = req.headers['x-api-key'];

  let providedKey: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  } else if (xApiKey) {
    providedKey = xApiKey as string;
  }

  if (!providedKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required'
    });
  }

  if (providedKey !== apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  next();
};