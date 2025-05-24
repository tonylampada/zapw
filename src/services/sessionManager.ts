import { randomUUID } from 'crypto';
import { Session } from '../models/Session';
import { SessionNotFoundError, SessionAlreadyExistsError } from '../models/errors';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  createSession(sessionId?: string): Session {
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
    return session;
  }

  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  updateSession(sessionId: string, updates: Partial<Session>): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session ${sessionId} not found`);
    }

    const updatedSession = { ...session, ...updates };
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  sessionExists(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }
}

export const sessionManager = new SessionManager();