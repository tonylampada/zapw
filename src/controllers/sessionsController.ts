import { Router, Request, Response } from 'express';
import { sessionManager } from '../services/sessionManager';
import { whatsappService } from '../services/whatsappService';
import { SessionAlreadyExistsError } from '../models/errors';
import { SessionResponse } from '../models/api';
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
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;
    const session = await sessionManager.createSession(sessionId);
    
    // Start WhatsApp connection
    whatsappService.initializeSession(session.id)
      .catch(err => console.error('Failed to initialize WhatsApp:', err));
    
    res.status(201).json({
      status: 'success',
      data: mapSessionToResponse(session)
    });
  } catch (error) {
    if (error instanceof SessionAlreadyExistsError) {
      res.status(409).json({
        status: 'error',
        error: error.message
      });
      return;
    }
    console.error('Error creating session:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to create session'
    });
  }
});

// GET /sessions - List all sessions
router.get('/', async (_req: Request, res: Response) => {
  try {
    const sessions = sessionManager.getAllSessions();
    res.json({
      status: 'success',
      data: sessions.map(mapSessionToResponse)
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to list sessions'
    });
  }
});

// GET /sessions/:id - Get specific session
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = sessionManager.getSession(req.params.id);
    if (!session) {
      res.status(404).json({
        status: 'error',
        error: `Session ${req.params.id} not found`
      });
      return;
    }
    res.json({
      status: 'success',
      data: mapSessionToResponse(session)
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to get session'
    });
  }
});

// DELETE /sessions/:id - Delete session
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    // Terminate WhatsApp connection first
    await whatsappService.terminateSession(req.params.id);
    
    const deleted = await sessionManager.deleteSession(req.params.id);
    if (!deleted) {
      res.status(404).json({
        status: 'error',
        error: `Session ${req.params.id} not found`
      });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to delete session'
    });
  }
});

export const sessionsController = router;