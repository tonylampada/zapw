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