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
    qrCode: session.qrCode,
    qrExpiresAt: session.qrExpiresAt?.toISOString()
  };
}

// POST /sessions - Create new session
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;
    const session = await sessionManager.createSession(sessionId);
    
    try {
      // Start WhatsApp connection and wait for QR
      await whatsappService.initializeSession(session.id);
      await whatsappService.waitForQRCode(session.id);
      
      // Get updated session with QR code
      const updatedSession = sessionManager.getSession(session.id);
      if (!updatedSession) {
        throw new Error('Session lost after initialization');
      }
      
      res.status(201).json({
        status: 'success',
        data: mapSessionToResponse(updatedSession)
      });
    } catch (error) {
      // Clean up on failure
      await sessionManager.deleteSession(session.id);
      throw error;
    }
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
      error: error instanceof Error ? error.message : 'Failed to create session'
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
    const sessionId = req.params.id;
    let session = sessionManager.getSession(sessionId);
    if (!session) {
      res.status(404).json({
        status: 'error',
        error: `Session ${sessionId} not found`
      });
      return;
    }
    
    // Check if QR needs refresh
    if (session.status === 'qr_waiting' && session.qrExpiresAt) {
      const isExpired = new Date() >= session.qrExpiresAt;
      if (isExpired) {
        try {
          // Refresh QR code
          await whatsappService.refreshQRCode(sessionId);
          // Get updated session
          const refreshedSession = sessionManager.getSession(sessionId);
          if (refreshedSession) {
            session = refreshedSession;
          }
        } catch (error) {
          console.error('Failed to refresh QR code:', error);
          // Continue with expired QR rather than failing the request
        }
      }
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