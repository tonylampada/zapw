import request from 'supertest';
import { createApp } from '../../src/app';
import { sessionManager } from '../../src/services/sessionManager';
import { whatsappService } from '../../src/services/whatsappService';

// Mock WhatsApp service
jest.mock('../../src/services/whatsappService', () => ({
  whatsappService: {
    initializeSession: jest.fn().mockResolvedValue(undefined),
    terminateSession: jest.fn().mockResolvedValue(undefined),
    waitForQRCode: jest.fn().mockImplementation(async (sessionId: string) => {
      // Simulate QR code generation
      const session = require('../../src/services/sessionManager').sessionManager.getSession(sessionId);
      if (session) {
        await require('../../src/services/sessionManager').sessionManager.updateSession(sessionId, {
          qrCode: '2@mock-qr-code',
          qrExpiresAt: new Date(Date.now() + 60000),
          status: 'qr_waiting'
        });
      }
    }),
    refreshQRCode: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('Sessions API', () => {
  const app = createApp();

  beforeEach(() => {
    // Clear all sessions before each test
    sessionManager.clear();
    // Clear mock calls
    jest.clearAllMocks();
  });

  describe('POST /sessions', () => {
    it('should create session with auto-generated ID', async () => {
      const response = await request(app)
        .post('/sessions')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('qr_waiting');
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.phoneNumber).toBeUndefined();
      expect(response.body.data.qrCode).toBe('2@mock-qr-code');
      expect(response.body.data.qrExpiresAt).toBeDefined();
    });

    it('should create session with custom ID', async () => {
      const response = await request(app)
        .post('/sessions')
        .send({ sessionId: 'custom-123' });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe('custom-123');
      expect(response.body.data.status).toBe('qr_waiting');
      expect(response.body.data.qrCode).toBe('2@mock-qr-code');
      expect(response.body.data.qrExpiresAt).toBeDefined();
    });

    it('should return 409 for duplicate session ID', async () => {
      await request(app)
        .post('/sessions')
        .send({ sessionId: 'duplicate-123' });

      const response = await request(app)
        .post('/sessions')
        .send({ sessionId: 'duplicate-123' });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should initialize WhatsApp connection', async () => {
      const response = await request(app)
        .post('/sessions')
        .send({ sessionId: 'test-whatsapp' });

      expect(response.status).toBe(201);
      expect(whatsappService.initializeSession).toHaveBeenCalledWith('test-whatsapp');
      expect(whatsappService.waitForQRCode).toHaveBeenCalledWith('test-whatsapp');
    });
  });

  describe('GET /sessions', () => {
    it('should return empty array when no sessions', async () => {
      const response = await request(app).get('/sessions');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual([]);
    });

    it('should return all sessions', async () => {
      // Create multiple sessions
      await request(app).post('/sessions').send({ sessionId: 'session-1' });
      await request(app).post('/sessions').send({ sessionId: 'session-2' });
      await request(app).post('/sessions').send({ sessionId: 'session-3' });

      const response = await request(app).get('/sessions');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.map((s: any) => s.id)).toEqual(['session-1', 'session-2', 'session-3']);
    });
  });

  describe('GET /sessions/:id', () => {
    it('should return session details', async () => {
      await request(app).post('/sessions').send({ sessionId: 'test-session' });

      const response = await request(app).get('/sessions/test-session');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.id).toBe('test-session');
      expect(response.body.data.status).toBe('qr_waiting');
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.qrCode).toBe('2@mock-qr-code');
      expect(response.body.data.qrExpiresAt).toBeDefined();
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app).get('/sessions/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /sessions/:id', () => {
    it('should delete existing session', async () => {
      await request(app).post('/sessions').send({ sessionId: 'to-delete' });

      const deleteResponse = await request(app).delete('/sessions/to-delete');
      expect(deleteResponse.status).toBe(204);
      expect(deleteResponse.body).toEqual({});

      // Verify WhatsApp termination was called
      expect(whatsappService.terminateSession).toHaveBeenCalledWith('to-delete');

      // Verify session is deleted
      const getResponse = await request(app).get('/sessions/to-delete');
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app).delete('/sessions/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });
});