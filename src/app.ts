import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { sessionsController } from './controllers/sessionsController';
import { messagesController } from './controllers/messagesController';
import { eventsController } from './controllers/eventsController';
import testWebhookController from './controllers/testWebhookController';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/authMiddleware';

export const createApp = (): Application => {
  const app = express();

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        upgradeInsecureRequests: null,  // Don't force HTTPS
      },
    },
    hsts: false,  // Disable HSTS for HTTP-only deployments
  }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static files
  app.use(express.static(path.join(__dirname, 'public')));

  // Apply authentication middleware
  app.use(authMiddleware);

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'zapw',
      uptime: process.uptime()
    });
  });

  // Routes
  app.use('/sessions', sessionsController);
  app.use('/events', eventsController);
  app.use('/', messagesController);
  
  // Test webhook endpoint (only in development)
  if (process.env.NODE_ENV === 'development') {
    app.use('/', testWebhookController);
  }

  // Error handling middleware
  app.use(errorHandler);

  return app;
};