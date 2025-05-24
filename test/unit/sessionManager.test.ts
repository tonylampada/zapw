import { SessionManager } from '../../src/services/sessionManager';
import { SessionAlreadyExistsError, SessionNotFoundError } from '../../src/models/errors';

// Mock the persistence adapter
jest.mock('../../src/adapters/persistenceAdapter', () => ({
  persistenceAdapter: {
    initialize: jest.fn().mockResolvedValue(undefined),
    saveSessionMetadata: jest.fn().mockResolvedValue(undefined),
    removeSessionMetadata: jest.fn().mockResolvedValue(undefined),
    deleteSessionAuth: jest.fn().mockResolvedValue(undefined),
    getAllSessions: jest.fn().mockResolvedValue([]),
    sessionAuthExists: jest.fn().mockResolvedValue(false)
  },
  SessionData: {}
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(async () => {
    sessionManager = new SessionManager();
    await sessionManager.initialize();
  });

  describe('createSession', () => {
    it('should create session with auto-generated ID', async () => {
      const session = await sessionManager.createSession();
      
      expect(session.id).toBeDefined();
      expect(session.status).toBe('initializing');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.phoneNumber).toBeUndefined();
      expect(session.name).toBeUndefined();
      expect(session.connectedAt).toBeUndefined();
      expect(session.qrCode).toBeUndefined();
    });

    it('should create session with provided ID', async () => {
      const customId = 'custom-session-123';
      const session = await sessionManager.createSession(customId);
      
      expect(session.id).toBe(customId);
      expect(session.status).toBe('initializing');
    });

    it('should throw error if session ID already exists', async () => {
      const sessionId = 'duplicate-session';
      await sessionManager.createSession(sessionId);
      
      await expect(sessionManager.createSession(sessionId))
        .rejects.toThrow(SessionAlreadyExistsError);
      await expect(sessionManager.createSession(sessionId))
        .rejects.toThrow(`Session ${sessionId} already exists`);
    });
  });

  describe('getSession', () => {
    it('should return session if exists', async () => {
      const session = await sessionManager.createSession('test-session');
      const retrieved = sessionManager.getSession('test-session');
      
      expect(retrieved).toEqual(session);
    });

    it('should return null if session does not exist', () => {
      const retrieved = sessionManager.getSession('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllSessions', () => {
    it('should return empty array when no sessions', () => {
      const sessions = sessionManager.getAllSessions();
      expect(sessions).toEqual([]);
    });

    it('should return all sessions', async () => {
      await sessionManager.createSession('session1');
      await sessionManager.createSession('session2');
      await sessionManager.createSession('session3');
      
      const sessions = sessionManager.getAllSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions.map(s => s.id).sort()).toEqual(['session1', 'session2', 'session3']);
    });
  });

  describe('updateSession', () => {
    it('should update existing session', async () => {
      const session = await sessionManager.createSession('test-session');
      
      const updates = {
        status: 'connected' as const,
        phoneNumber: '1234567890',
        name: 'Test User',
        connectedAt: new Date()
      };
      
      const updated = await sessionManager.updateSession('test-session', updates);
      
      expect(updated.id).toBe(session.id);
      expect(updated.status).toBe('connected');
      expect(updated.phoneNumber).toBe('1234567890');
      expect(updated.name).toBe('Test User');
      expect(updated.connectedAt).toEqual(updates.connectedAt);
      expect(updated.createdAt).toEqual(session.createdAt);
    });

    it('should throw error if session does not exist', async () => {
      await expect(sessionManager.updateSession('non-existent', { status: 'connected' }))
        .rejects.toThrow(SessionNotFoundError);
      await expect(sessionManager.updateSession('non-existent', { status: 'connected' }))
        .rejects.toThrow('Session non-existent not found');
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', async () => {
      await sessionManager.createSession('test-session');
      
      const deleted = await sessionManager.deleteSession('test-session');
      expect(deleted).toBe(true);
      
      const retrieved = sessionManager.getSession('test-session');
      expect(retrieved).toBeNull();
    });

    it('should return false if session does not exist', async () => {
      const deleted = await sessionManager.deleteSession('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('sessionExists', () => {
    it('should return true if session exists', async () => {
      await sessionManager.createSession('test-session');
      expect(sessionManager.sessionExists('test-session')).toBe(true);
    });

    it('should return false if session does not exist', () => {
      expect(sessionManager.sessionExists('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all sessions', async () => {
      await sessionManager.createSession('session1');
      await sessionManager.createSession('session2');
      
      sessionManager.clear();
      
      expect(sessionManager.getAllSessions()).toEqual([]);
      expect(sessionManager.sessionExists('session1')).toBe(false);
      expect(sessionManager.sessionExists('session2')).toBe(false);
    });
  });
});