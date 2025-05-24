import fs from 'fs/promises';
import path from 'path';
import { PersistenceAdapter, SessionData } from '../../src/adapters/persistenceAdapter';

describe('PersistenceAdapter', () => {
  const testDataPath = 'test-sessions-data';
  let adapter: PersistenceAdapter;
  
  beforeEach(async () => {
    adapter = new PersistenceAdapter(testDataPath);
    await adapter.initialize();
  });
  
  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(testDataPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
  });

  describe('initialization', () => {
    it('should create sessions directory if it does not exist', async () => {
      const newDataPath = 'test-new-sessions-data';
      const newAdapter = new PersistenceAdapter(newDataPath);
      
      await newAdapter.initialize();
      
      const dirExists = await fs.access(newDataPath).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
      
      // Clean up
      await fs.rm(newDataPath, { recursive: true, force: true });
    });

    it('should create metadata file if it does not exist', async () => {
      const metadataPath = path.join(testDataPath, 'sessions-metadata.json');
      const fileExists = await fs.access(metadataPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      const content = await fs.readFile(metadataPath, 'utf-8');
      expect(JSON.parse(content)).toEqual({});
    });
  });

  describe('session metadata operations', () => {
    const mockSession: SessionData = {
      id: 'test-session-123',
      phoneNumber: '1234567890',
      name: 'Test User',
      createdAt: new Date().toISOString(),
      connectedAt: new Date().toISOString()
    };

    it('should save and load session metadata', async () => {
      await adapter.saveSessionMetadata(mockSession);
      
      const sessions = await adapter.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toEqual(mockSession);
    });

    it('should update existing session metadata', async () => {
      await adapter.saveSessionMetadata(mockSession);
      
      const updatedSession = {
        ...mockSession,
        lastDisconnectedAt: new Date().toISOString()
      };
      
      await adapter.saveSessionMetadata(updatedSession);
      
      const sessions = await adapter.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toEqual(updatedSession);
    });

    it('should remove session metadata', async () => {
      await adapter.saveSessionMetadata(mockSession);
      await adapter.removeSessionMetadata(mockSession.id);
      
      const sessions = await adapter.getAllSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should handle multiple sessions', async () => {
      const session1 = { ...mockSession, id: 'session-1' };
      const session2 = { ...mockSession, id: 'session-2' };
      const session3 = { ...mockSession, id: 'session-3' };
      
      await adapter.saveSessionMetadata(session1);
      await adapter.saveSessionMetadata(session2);
      await adapter.saveSessionMetadata(session3);
      
      const sessions = await adapter.getAllSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions.map(s => s.id).sort()).toEqual(['session-1', 'session-2', 'session-3']);
    });
  });

  describe('auth existence checks', () => {
    it('should check auth existence correctly', async () => {
      const sessionId = 'test-session-auth';
      const authPath = path.join(testDataPath, sessionId);
      
      // Initially should not exist
      let exists = await adapter.sessionAuthExists(sessionId);
      expect(exists).toBe(false);
      
      // Create auth directory
      await fs.mkdir(authPath, { recursive: true });
      await fs.writeFile(path.join(authPath, 'creds.json'), '{}');
      
      // Now should exist
      exists = await adapter.sessionAuthExists(sessionId);
      expect(exists).toBe(true);
    });
  });

  describe('auth deletion', () => {
    it('should delete session auth directory', async () => {
      const sessionId = 'test-session-delete';
      const authPath = path.join(testDataPath, sessionId);
      
      // Create auth directory with files
      await fs.mkdir(authPath, { recursive: true });
      await fs.writeFile(path.join(authPath, 'creds.json'), '{}');
      await fs.writeFile(path.join(authPath, 'app-state.json'), '{}');
      
      // Delete auth
      await adapter.deleteSessionAuth(sessionId);
      
      // Should not exist anymore
      const exists = await adapter.sessionAuthExists(sessionId);
      expect(exists).toBe(false);
    });

    it('should handle deletion of non-existent auth gracefully', async () => {
      // Should not throw
      await expect(adapter.deleteSessionAuth('non-existent')).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle missing metadata file gracefully', async () => {
      const metadataPath = path.join(testDataPath, 'sessions-metadata.json');
      await fs.unlink(metadataPath);
      
      const sessions = await adapter.getAllSessions();
      expect(sessions).toEqual([]);
    });

    it('should handle corrupted metadata file', async () => {
      const metadataPath = path.join(testDataPath, 'sessions-metadata.json');
      await fs.writeFile(metadataPath, 'invalid json content');
      
      const sessions = await adapter.getAllSessions();
      expect(sessions).toEqual([]);
    });
  });
});