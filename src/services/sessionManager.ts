import { randomUUID } from 'crypto';
import { Session } from '../models/Session';
import { SessionNotFoundError, SessionAlreadyExistsError } from '../models/errors';
import { persistenceAdapter, SessionData } from '../adapters/persistenceAdapter';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private persistenceAdapter = persistenceAdapter;

  async initialize(): Promise<void> {
    await this.persistenceAdapter.initialize();
    await this.loadPersistedSessions();
  }

  async createSession(sessionId?: string): Promise<Session> {
    const id = sessionId || randomUUID();
    
    if (this.sessions.has(id)) {
      throw new SessionAlreadyExistsError(`Session ${id} already exists`);
    }

    const session: Session = {
      id,
      status: 'initializing',
      createdAt: new Date()
    };

    this.sessions.set(id, session);
    
    // Persist metadata
    await this.persistSessionMetadata(session);
    
    return session;
  }

  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session ${sessionId} not found`);
    }

    const updatedSession = { ...session, ...updates };
    this.sessions.set(sessionId, updatedSession);
    
    // Persist updated metadata
    await this.persistSessionMetadata(updatedSession);
    
    return updatedSession;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const exists = this.sessions.has(sessionId);
    if (exists) {
      this.sessions.delete(sessionId);
      await this.persistenceAdapter.removeSessionMetadata(sessionId);
      await this.persistenceAdapter.deleteSessionAuth(sessionId);
    }
    return exists;
  }

  sessionExists(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }

  private async loadPersistedSessions(): Promise<void> {
    const persistedSessions = await this.persistenceAdapter.getAllSessions();
    
    for (const sessionData of persistedSessions) {
      // Check if auth files exist
      const hasAuth = await this.persistenceAdapter.sessionAuthExists(sessionData.id);
      
      if (hasAuth) {
        // Restore session to memory
        const session: Session = {
          id: sessionData.id,
          status: 'disconnected', // Will be updated when WhatsApp connects
          phoneNumber: sessionData.phoneNumber,
          name: sessionData.name,
          createdAt: new Date(sessionData.createdAt),
          connectedAt: sessionData.connectedAt ? new Date(sessionData.connectedAt) : undefined
        };
        
        this.sessions.set(session.id, session);
        console.log(`Restored session ${session.id} from persistence`);
      } else {
        // Clean up metadata for sessions without auth
        await this.persistenceAdapter.removeSessionMetadata(sessionData.id);
      }
    }
  }

  private async persistSessionMetadata(session: Session): Promise<void> {
    const sessionData: SessionData = {
      id: session.id,
      phoneNumber: session.phoneNumber,
      name: session.name,
      createdAt: session.createdAt.toISOString(),
      connectedAt: session.connectedAt?.toISOString(),
      lastDisconnectedAt: session.status === 'disconnected' 
        ? new Date().toISOString() 
        : undefined
    };
    
    await this.persistenceAdapter.saveSessionMetadata(sessionData);
  }
}

export const sessionManager = new SessionManager();