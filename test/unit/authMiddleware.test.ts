import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../src/middleware/authMiddleware';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  
  beforeEach(() => {
    mockReq = {
      headers: {},
      get path() { return '/'; }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    
    // Clear environment variable
    delete process.env.API_KEY;
  });

  afterEach(() => {
    // Clear environment variable
    delete process.env.API_KEY;
  });

  describe('when API key is configured', () => {
    beforeEach(() => {
      process.env.API_KEY = 'test-api-key-123';
    });

    it('should pass through with valid API key in Authorization header', () => {
      mockReq.headers = {
        authorization: 'Bearer test-api-key-123'
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should pass through with valid API key in X-API-Key header', () => {
      mockReq.headers = {
        'x-api-key': 'test-api-key-123'
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 without API key', () => {
      mockReq = {
        headers: {},
        get path() { return '/sessions'; }
      };
      
      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'API key is required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with invalid API key', () => {
      mockReq = {
        headers: {
          authorization: 'Bearer wrong-key'
        },
        get path() { return '/sessions'; }
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should skip authentication for health check endpoint', () => {
      mockReq = {
        headers: {},
        get path() { return '/health'; }
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should skip authentication for root path', () => {
      mockReq = {
        headers: {},
        get path() { return '/'; }
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('when API key is not configured', () => {
    it('should pass through all requests', () => {
      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});