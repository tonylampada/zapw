import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { sessionsController } from './controllers/sessionsController';
import { messagesController } from './controllers/messagesController';
import { errorHandler } from './middleware/errorHandler';

export const createApp = (): Application => {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'zapw'
    });
  });

  // Routes
  app.use('/sessions', sessionsController);
  app.use('/', messagesController);

  // Error handling middleware
  app.use(errorHandler);

  return app;
};