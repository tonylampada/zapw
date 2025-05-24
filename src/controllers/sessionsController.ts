import { Router, Request, Response } from 'express';
import { sessionManager } from '../services/sessionManager';
import { SessionAlreadyExistsError } from '../models/errors';
import { CreateSessionRequest, SessionResponse } from '../models/api';
import { Session } from '../models/Session';

const router = Router();

function mapSessionToResponse(session: Session): SessionResponse {
  return {
    id: session.id,
    status: session.status,
    phoneNumber: session.phoneNumber,
    name: session.name,
    createdAt: session.createdAt.toISOString(),
    connectedAt: session.connectedAt?.toISOString(),
    qrCode: session.qrCode
  };
}

// POST /sessions - Create new session
router.post('/', async (req: Request<{}, {}, CreateSessionRequest>, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;
    const session = sessionManager.createSession(sessionId);
    res.status(201).json(mapSessionToResponse(session));
  } catch (error) {
    if (error instanceof SessionAlreadyExistsError) {
      res.status(409).json({
        error: 'Session Already Exists',
        message: error.message,
        statusCode: 409
      });
      return;
    }
    console.error('Error creating session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create session',
      statusCode: 500
    });
  }
});

// GET /sessions - List all sessions
router.get('/', async (_req: Request, res: Response) => {
  try {
    const sessions = sessionManager.getAllSessions();
    res.json(sessions.map(mapSessionToResponse));
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list sessions',
      statusCode: 500
    });
  }
});

// GET /sessions/:id - Get specific session
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = sessionManager.getSession(req.params.id);
    if (!session) {
      res.status(404).json({
        error: 'Session Not Found',
        message: `Session ${req.params.id} not found`,
        statusCode: 404
      });
      return;
    }
    res.json(mapSessionToResponse(session));
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get session',
      statusCode: 500
    });
  }
});

// DELETE /sessions/:id - Delete session
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = sessionManager.deleteSession(req.params.id);
    if (!deleted) {
      res.status(404).json({
        error: 'Session Not Found',
        message: `Session ${req.params.id} not found`,
        statusCode: 404
      });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete session',
      statusCode: 500
    });
  }
});

export const sessionsController = router;