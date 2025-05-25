import request from 'supertest';
import { createApp } from '../../src/app';
import { sessionManager } from '../../src/services/sessionManager';

describe('API Authentication Integration', () => {
  let app: any;

  beforeEach(() => {
    // Clear environment variable
    delete process.env.API_KEY;
    
    // Mock session manager
    jest.spyOn(sessionManager, 'getAllSessions').mockReturnValue([]);
    
    // Create app after setting environment
    app = createApp();
  });

  afterEach(() => {
    delete process.env.API_KEY;
    jest.restoreAllMocks();
  });

  describe('when API_KEY is not set', () => {
    it('should allow access to all endpoints', async () => {
      await request(app).get('/sessions').expect(200);
      await request(app).get('/health').expect(200);
    });
  });

  describe('when API_KEY is set', () => {
    beforeEach(() => {
      process.env.API_KEY = 'test-key-123';
      app = createApp(); // Recreate app with new env
    });

    it('should allow access to health endpoint without auth', async () => {
      await request(app).get('/health').expect(200);
    });

    it('should allow access to root endpoint without auth', async () => {
      await request(app).get('/').expect(200);
    });

    it('should deny access to protected endpoints without API key', async () => {
      const response = await request(app).get('/sessions').expect(401);
      
      expect(response.body).toEqual({
        error: 'Unauthorized',
        message: 'API key is required'
      });
    });

    it('should deny access with invalid API key', async () => {
      const response = await request(app)
        .get('/sessions')
        .set('Authorization', 'Bearer wrong-key')
        .expect(401);
      
      expect(response.body).toEqual({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    });

    it('should allow access with valid API key in Authorization header', async () => {
      await request(app)
        .get('/sessions')
        .set('Authorization', 'Bearer test-key-123')
        .expect(200);
    });

    it('should allow access with valid API key in X-API-Key header', async () => {
      await request(app)
        .get('/sessions')
        .set('X-API-Key', 'test-key-123')
        .expect(200);
    });
  });
});