import { Router, Request, Response } from 'express';
import { whatsappService } from '../services/whatsappService';
import { validateSendMessageRequest } from '../utils/messageValidator';
import { SendMessageRequest } from '../models/Message';
import { SessionNotFoundError } from '../models/errors';

const router = Router();

// POST /sessions/:sessionId/messages - Send message
router.post('/sessions/:sessionId/messages', async (req: Request<{sessionId: string}, Record<string, never>, SendMessageRequest>, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const message = validateSendMessageRequest(req.body);
    
    const result = await whatsappService.sendMessage(sessionId, message);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      res.status(404).json({ 
        status: 'error',
        error: error.message
      });
      return;
    }
    if (error instanceof Error) {
      if (error.message.includes('not connected')) {
        res.status(400).json({ 
          status: 'error',
          error: error.message
        });
        return;
      }
      if (error.message.includes('required')) {
        res.status(400).json({ 
          status: 'error',
          error: error.message
        });
        return;
      }
    }
    console.error('Failed to send message:', error);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to send message'
    });
  }
});

export const messagesController = router;