import { Router, Request, Response } from 'express';
import { whatsappService } from '../services/whatsappService';
import { validateSendMessageRequest } from '../utils/messageValidator';
import { SendMessageRequest } from '../models/Message';
import { SessionNotFoundError } from '../models/errors';

const router = Router();

// POST /sessions/:sessionId/messages - Send message
router.post('/sessions/:sessionId/messages', async (req: Request<{sessionId: string}, {}, SendMessageRequest>, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const message = validateSendMessageRequest(req.body);
    
    const result = await whatsappService.sendMessage(sessionId, message);
    res.json(result);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      res.status(404).json({ 
        error: 'Session Not Found',
        message: error.message,
        statusCode: 404
      });
      return;
    }
    if (error instanceof Error) {
      if (error.message.includes('not connected')) {
        res.status(400).json({ 
          error: 'Session Not Connected',
          message: error.message,
          statusCode: 400
        });
        return;
      }
      if (error.message.includes('required')) {
        res.status(400).json({ 
          error: 'Validation Error',
          message: error.message,
          statusCode: 400
        });
        return;
      }
    }
    console.error('Failed to send message:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to send message',
      statusCode: 500
    });
  }
});

export const messagesController = router;