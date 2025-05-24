import { SessionManager } from '../../src/services/sessionManager';
import { SessionAlreadyExistsError, SessionNotFoundError } from '../../src/models/errors';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('createSession', () => {
    it('should create session with auto-generated ID', () => {
      const session = sessionManager.createSession();
      
      expect(session.id).toBeDefined();
      expect(session.status).toBe('initializing');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.phoneNumber).toBeUndefined();
      expect(session.name).toBeUndefined();
      expect(session.connectedAt).toBeUndefined();
      expect(session.qrCode).toBeUndefined();
    });

    it('should create session with provided ID', () => {
      const customId = 'custom-session-123';
      const session = sessionManager.createSession(customId);
      
      expect(session.id).toBe(customId);
      expect(session.status).toBe('initializing');
    });

    it('should throw error if session ID already exists', () => {
      const sessionId = 'duplicate-session';
      sessionManager.createSession(sessionId);
      
      expect(() => sessionManager.createSession(sessionId))
        .toThrow(SessionAlreadyExistsError);
      expect(() => sessionManager.createSession(sessionId))
        .toThrow(`Session ${sessionId} already exists`);
    });
  });

  describe('getSession', () => {
    it('should return existing session', () => {
      const session = sessionManager.createSession('test-session');
      const retrieved = sessionManager.getSession('test-session');
      
      expect(retrieved).toEqual(session);
    });

    it('should return null for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent');
      
      expect(retrieved).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update session status', () => {
      const session = sessionManager.createSession('test-session');
      const updated = sessionManager.updateSession('test-session', {
        status: 'connected',
        phoneNumber: '1234567890',
        connectedAt: new Date()
      });
      
      expect(updated.status).toBe('connected');
      expect(updated.phoneNumber).toBe('1234567890');
      expect(updated.connectedAt).toBeInstanceOf(Date);
      expect(updated.id).toBe(session.id);
      expect(updated.createdAt).toEqual(session.createdAt);
    });

    it('should throw error for non-existent session', () => {
      expect(() => sessionManager.updateSession('non-existent', { status: 'connected' }))
        .toThrow(SessionNotFoundError);
      expect(() => sessionManager.updateSession('non-existent', { status: 'connected' }))
        .toThrow('Session non-existent not found');
    });

    it('should preserve non-updated fields', () => {
      const originalCreatedAt = new Date('2024-01-01');
      sessionManager.createSession('test-session');
      sessionManager.updateSession('test-session', {
        phoneNumber: '1234567890',
        createdAt: originalCreatedAt
      });
      
      const updated = sessionManager.updateSession('test-session', {
        status: 'connected'
      });
      
      expect(updated.phoneNumber).toBe('1234567890');
      expect(updated.createdAt).toEqual(originalCreatedAt);
      expect(updated.status).toBe('connected');
    });
  });

  describe('deleteSession', () => {
    it('should remove existing session', () => {
      sessionManager.createSession('test-session');
      const deleted = sessionManager.deleteSession('test-session');
      
      expect(deleted).toBe(true);
      expect(sessionManager.getSession('test-session')).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const deleted = sessionManager.deleteSession('non-existent');
      
      expect(deleted).toBe(false);
    });
  });

  describe('getAllSessions', () => {
    it('should return empty array when no sessions', () => {
      const sessions = sessionManager.getAllSessions();
      
      expect(sessions).toEqual([]);
    });

    it('should return all active sessions', () => {
      const session1 = sessionManager.createSession('session-1');
      const session2 = sessionManager.createSession('session-2');
      const session3 = sessionManager.createSession('session-3');
      
      const sessions = sessionManager.getAllSessions();
      
      expect(sessions).toHaveLength(3);
      expect(sessions).toContainEqual(session1);
      expect(sessions).toContainEqual(session2);
      expect(sessions).toContainEqual(session3);
    });
  });

  describe('sessionExists', () => {
    it('should return true for existing session', () => {
      sessionManager.createSession('test-session');
      
      expect(sessionManager.sessionExists('test-session')).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(sessionManager.sessionExists('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all sessions', () => {
      sessionManager.createSession('session-1');
      sessionManager.createSession('session-2');
      sessionManager.createSession('session-3');
      
      sessionManager.clear();
      
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });
  });
});