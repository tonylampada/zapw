import request from 'supertest';
import { createApp } from '../../src/app';
import { sessionManager } from '../../src/services/sessionManager';

describe('Sessions API', () => {
  const app = createApp();

  beforeEach(() => {
    // Clear all sessions before each test
    sessionManager.clear();
  });

  describe('POST /sessions', () => {
    it('should create session with auto-generated ID', async () => {
      const response = await request(app)
        .post('/sessions')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.status).toBe('initializing');
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.phoneNumber).toBeUndefined();
    });

    it('should create session with custom ID', async () => {
      const response = await request(app)
        .post('/sessions')
        .send({ sessionId: 'custom-123' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('custom-123');
      expect(response.body.status).toBe('initializing');
    });

    it('should return 409 for duplicate session ID', async () => {
      await request(app)
        .post('/sessions')
        .send({ sessionId: 'duplicate-123' });

      const response = await request(app)
        .post('/sessions')
        .send({ sessionId: 'duplicate-123' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Session Already Exists');
      expect(response.body.message).toContain('duplicate-123');
    });
  });

  describe('GET /sessions', () => {
    it('should return empty array when no sessions', async () => {
      const response = await request(app).get('/sessions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all sessions', async () => {
      // Create multiple sessions
      await request(app).post('/sessions').send({ sessionId: 'session-1' });
      await request(app).post('/sessions').send({ sessionId: 'session-2' });
      await request(app).post('/sessions').send({ sessionId: 'session-3' });

      const response = await request(app).get('/sessions');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body.map((s: any) => s.id)).toEqual(['session-1', 'session-2', 'session-3']);
    });
  });

  describe('GET /sessions/:id', () => {
    it('should return session details', async () => {
      await request(app).post('/sessions').send({ sessionId: 'test-session' });

      const response = await request(app).get('/sessions/test-session');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-session');
      expect(response.body.status).toBe('initializing');
      expect(response.body.createdAt).toBeDefined();
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app).get('/sessions/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Session Not Found');
      expect(response.body.message).toContain('non-existent');
    });
  });

  describe('DELETE /sessions/:id', () => {
    it('should delete existing session', async () => {
      await request(app).post('/sessions').send({ sessionId: 'to-delete' });

      const deleteResponse = await request(app).delete('/sessions/to-delete');
      expect(deleteResponse.status).toBe(204);
      expect(deleteResponse.body).toEqual({});

      // Verify session is deleted
      const getResponse = await request(app).get('/sessions/to-delete');
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app).delete('/sessions/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Session Not Found');
    });
  });
});