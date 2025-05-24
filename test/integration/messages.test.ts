import request from 'supertest';
import { createApp } from '../../src/app';
import { sessionManager } from '../../src/services/sessionManager';
import { whatsappService } from '../../src/services/whatsappService';

// Mock WhatsApp service
jest.mock('../../src/services/whatsappService', () => {
  const { SessionNotFoundError } = require('../../src/models/errors');
  return {
    whatsappService: {
      initializeSession: jest.fn().mockResolvedValue(undefined),
      terminateSession: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockImplementation((sessionId: string) => {
        if (sessionId === 'non-existent') {
          throw new SessionNotFoundError('Session non-existent not found');
        }
        return Promise.resolve({
          messageId: 'test-message-id',
          timestamp: Date.now(),
          status: 'sent'
        });
      })
    }
  };
});

describe('Messages API', () => {
  const app = createApp();
  let sessionId: string;
  
  beforeEach(async () => {
    // Clear all sessions and mocks
    sessionManager.clear();
    jest.clearAllMocks();
    
    // Create and mock a connected session
    const session = sessionManager.createSession('test-session');
    sessionId = session.id;
    
    // Mock session as connected
    sessionManager.updateSession(sessionId, {
      status: 'connected',
      phoneNumber: '1234567890'
    });
  });
  
  describe('POST /sessions/:id/messages', () => {
    it('should send text message', async () => {
      const response = await request(app)
        .post(`/sessions/${sessionId}/messages`)
        .send({
          to: '9876543210',
          type: 'text',
          text: 'Hello World'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.messageId).toBe('test-message-id');
      expect(response.body.status).toBe('sent');
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(sessionId, {
        to: '9876543210',
        type: 'text',
        text: 'Hello World'
      });
    });

    it('should send image with caption', async () => {
      const response = await request(app)
        .post(`/sessions/${sessionId}/messages`)
        .send({
          to: '9876543210',
          type: 'image',
          mediaUrl: 'https://example.com/image.jpg',
          caption: 'Test image'
        });
      
      expect(response.status).toBe(200);
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(sessionId, {
        to: '9876543210',
        type: 'image',
        mediaUrl: 'https://example.com/image.jpg',
        caption: 'Test image',
        mediaBase64: undefined,
        fileName: undefined
      });
    });

    it('should send document with filename', async () => {
      const response = await request(app)
        .post(`/sessions/${sessionId}/messages`)
        .send({
          to: '9876543210',
          type: 'document',
          mediaUrl: 'https://example.com/doc.pdf',
          fileName: 'document.pdf'
        });
      
      expect(response.status).toBe(200);
      expect(whatsappService.sendMessage).toHaveBeenCalled();
    });

    it('should send location', async () => {
      const response = await request(app)
        .post(`/sessions/${sessionId}/messages`)
        .send({
          to: '9876543210',
          type: 'location',
          latitude: 40.7128,
          longitude: -74.0060,
          name: 'New York City'
        });
      
      expect(response.status).toBe(200);
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(sessionId, {
        to: '9876543210',
        type: 'location',
        latitude: 40.7128,
        longitude: -74.0060,
        name: 'New York City',
        address: undefined
      });
    });

    it('should send contact', async () => {
      const response = await request(app)
        .post(`/sessions/${sessionId}/messages`)
        .send({
          to: '9876543210',
          type: 'contact',
          contactName: 'John Doe',
          contactNumber: '+1234567890'
        });
      
      expect(response.status).toBe(200);
      expect(whatsappService.sendMessage).toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post(`/sessions/${sessionId}/messages`)
        .send({
          type: 'text'
          // missing 'to' and 'text'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('required');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/sessions/non-existent/messages')
        .send({
          to: '9876543210',
          type: 'text',
          text: 'Hello'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Session Not Found');
    });

    it('should return 400 for disconnected session', async () => {
      // Mock service to throw not connected error
      (whatsappService.sendMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Session not connected')
      );
      
      const response = await request(app)
        .post(`/sessions/${sessionId}/messages`)
        .send({
          to: '9876543210',
          type: 'text',
          text: 'Hello'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session Not Connected');
    });

    it('should handle all message types', async () => {
      const messageTypes = [
        { type: 'text', text: 'Hello' },
        { type: 'image', mediaUrl: 'https://example.com/img.jpg' },
        { type: 'video', mediaBase64: 'base64data' },
        { type: 'audio', mediaUrl: 'https://example.com/audio.mp3' },
        { type: 'document', mediaUrl: 'https://example.com/doc.pdf', fileName: 'doc.pdf' },
        { type: 'location', latitude: 0, longitude: 0 },
        { type: 'contact', contactName: 'Test', contactNumber: '123' }
      ];

      for (const msgData of messageTypes) {
        const response = await request(app)
          .post(`/sessions/${sessionId}/messages`)
          .send({ to: '9876543210', ...msgData });
        
        expect(response.status).toBe(200);
      }
      
      expect(whatsappService.sendMessage).toHaveBeenCalledTimes(messageTypes.length);
    });
  });
});