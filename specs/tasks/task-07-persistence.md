# Task 7: Session Persistence

## Objective
Add file-based persistence for session data, ensuring sessions survive application restarts. This includes saving session metadata and implementing session restoration on startup.

## Requirements

### 1. Persistence Adapter
Create `src/adapters/persistenceAdapter.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';

export interface SessionData {
  id: string;
  phoneNumber?: string;
  name?: string;
  createdAt: string;
  connectedAt?: string;
  lastDisconnectedAt?: string;
}

export class PersistenceAdapter {
  private sessionsDir: string;
  private metadataFile: string;

  constructor(dataPath: string = 'sessions_data') {
    this.sessionsDir = path.resolve(dataPath);
    this.metadataFile = path.join(this.sessionsDir, 'sessions-metadata.json');
  }

  async initialize(): Promise<void> {
    // Ensure sessions directory exists
    await fs.mkdir(this.sessionsDir, { recursive: true });
    
    // Initialize metadata file if it doesn't exist
    try {
      await fs.access(this.metadataFile);
    } catch {
      await this.saveMetadata({});
    }
  }

  async saveSessionMetadata(session: SessionData): Promise<void> {
    const metadata = await this.loadMetadata();
    metadata[session.id] = session;
    await this.saveMetadata(metadata);
  }

  async removeSessionMetadata(sessionId: string): Promise<void> {
    const metadata = await this.loadMetadata();
    delete metadata[sessionId];
    await this.saveMetadata(metadata);
  }

  async getAllSessions(): Promise<SessionData[]> {
    const metadata = await this.loadMetadata();
    return Object.values(metadata);
  }

  async sessionAuthExists(sessionId: string): Promise<boolean> {
    try {
      const authPath = path.join(this.sessionsDir, sessionId);
      await fs.access(authPath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteSessionAuth(sessionId: string): Promise<void> {
    const authPath = path.join(this.sessionsDir, sessionId);
    try {
      await fs.rm(authPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to delete auth for ${sessionId}:`, error);
    }
  }

  private async loadMetadata(): Promise<Record<string, SessionData>> {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async saveMetadata(metadata: Record<string, SessionData>): Promise<void> {
    await fs.writeFile(
      this.metadataFile,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );
  }
}

export const persistenceAdapter = new PersistenceAdapter(
  process.env.SESSIONS_DATA_PATH || 'sessions_data'
);
```

### 2. Update Session Manager
Update `src/services/sessionManager.ts`:

```typescript
import { persistenceAdapter } from '../adapters/persistenceAdapter';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private persistenceAdapter = persistenceAdapter;

  async initialize(): Promise<void> {
    await this.persistenceAdapter.initialize();
    await this.loadPersistedSessions();
  }

  async createSession(sessionId?: string): Promise<Session> {
    const id = sessionId || crypto.randomUUID();
    
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
```

### 3. Update WhatsApp Service
Update `src/services/whatsappService.ts`:

```typescript
export class WhatsAppService {
  async initialize(): Promise<void> {
    // Restore WhatsApp connections for persisted sessions
    const sessions = sessionManager.getAllSessions();
    
    for (const session of sessions) {
      if (session.status === 'disconnected') {
        try {
          console.log(`Attempting to restore WhatsApp connection for ${session.id}`);
          await this.initializeSession(session.id);
        } catch (error) {
          console.error(`Failed to restore session ${session.id}:`, error);
        }
      }
    }
  }
  
  async initializeSession(sessionId: string): Promise<void> {
    // ... existing code
    
    // Update session status during initialization
    sessionManager.updateSession(sessionId, {
      status: 'connecting'
    });
    
    // ... rest of existing code
  }
}
```

### 4. Update Application Startup
Update `src/index.ts`:

```typescript
import { sessionManager } from './services/sessionManager';
import { whatsappService } from './services/whatsappService';

async function startServer() {
  try {
    // Initialize persistence and restore sessions
    console.log('Initializing session manager...');
    await sessionManager.initialize();
    
    console.log('Restoring WhatsApp connections...');
    await whatsappService.initialize();
    
    // Start Express server
    app.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
      console.log(`${sessionManager.getAllSessions().length} sessions restored`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Disconnect all WhatsApp sessions
  const sessions = sessionManager.getAllSessions();
  for (const session of sessions) {
    await whatsappService.terminateSession(session.id);
  }
  
  process.exit(0);
});

startServer();
```

### 5. Unit Tests
Create `test/unit/persistenceAdapter.test.ts`:

```typescript
describe('PersistenceAdapter', () => {
  const testDataPath = 'test-sessions-data';
  let adapter: PersistenceAdapter;
  
  beforeEach(async () => {
    adapter = new PersistenceAdapter(testDataPath);
    await adapter.initialize();
  });
  
  afterEach(async () => {
    // Clean up test data
    await fs.rm(testDataPath, { recursive: true, force: true });
  });
  
  it('should save and load session metadata');
  it('should remove session metadata');
  it('should check auth existence');
  it('should handle missing metadata file');
  it('should delete session auth directory');
});
```

### 6. Integration Tests
Update existing integration tests to account for persistence:

```typescript
describe('Session Persistence', () => {
  it('should persist session metadata to disk');
  it('should restore sessions on startup');
  it('should clean up deleted sessions from disk');
  it('should handle corrupted metadata gracefully');
});
```

## Success Criteria
- [ ] Session metadata saved to disk on create/update
- [ ] Sessions restored from disk on startup
- [ ] WhatsApp connections auto-restored for existing sessions
- [ ] Deleted sessions cleaned from disk
- [ ] Graceful handling of corrupted data
- [ ] Sessions directory created automatically
- [ ] Tests verify persistence behavior

## File Structure
```
sessions_data/
├── sessions-metadata.json     # Session metadata
├── session-123/              # Baileys auth for session-123
│   ├── creds.json
│   └── app-state-sync-key-*.json
└── session-456/              # Baileys auth for session-456
    ├── creds.json
    └── app-state-sync-key-*.json
```

## Notes
- Ensure sessions_data is in .gitignore
- Consider encryption for sensitive auth data in production
- Handle file system errors gracefully
- Add file locking if needed for concurrent access
- Document backup/restore procedures for production