import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';

export interface ConnectionInfo {
  phoneNumber: string;
  name?: string;
}

export interface IWhatsAppClient {
  sessionId: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): 'connecting' | 'open' | 'closed';
  onQR(callback: (qr: string) => void): void;
  onConnected(callback: (info: ConnectionInfo) => void): void;
  onDisconnected(callback: (reason: any) => void): void;
}

export class BaileysClient implements IWhatsAppClient {
  private socket?: WASocket;
  private qrCallback?: (qr: string) => void;
  private connectedCallback?: (info: ConnectionInfo) => void;
  private disconnectedCallback?: (reason: any) => void;
  private connectionState: 'connecting' | 'open' | 'closed' = 'closed';

  constructor(public sessionId: string) {}

  async connect(): Promise<void> {
    const sessionsPath = process.env.SESSIONS_DATA_PATH || 'sessions_data';
    const authPath = path.join(sessionsPath, this.sessionId);
    
    // Ensure sessions directory exists
    if (!fs.existsSync(sessionsPath)) {
      fs.mkdirSync(sessionsPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      defaultQueryTimeoutMs: 60000
    });

    this.connectionState = 'connecting';

    this.socket.ev.on('creds.update', saveCreds);
    
    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr && this.qrCallback) {
        this.qrCallback(qr);
      }
      
      if (connection === 'close') {
        this.connectionState = 'closed';
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (this.disconnectedCallback) {
          this.disconnectedCallback({
            reason: lastDisconnect?.error,
            shouldReconnect
          });
        }
      }
      
      if (connection === 'open') {
        this.connectionState = 'open';
        const phoneNumber = this.socket!.user?.id.split(':')[0] || '';
        const name = this.socket!.user?.name || '';
        
        if (this.connectedCallback) {
          this.connectedCallback({ phoneNumber, name });
        }
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = undefined;
      this.connectionState = 'closed';
    }
  }

  getConnectionState(): 'connecting' | 'open' | 'closed' {
    return this.connectionState;
  }

  onQR(callback: (qr: string) => void): void {
    this.qrCallback = callback;
  }

  onConnected(callback: (info: ConnectionInfo) => void): void {
    this.connectedCallback = callback;
  }

  onDisconnected(callback: (reason: any) => void): void {
    this.disconnectedCallback = callback;
  }
}

// Mock implementation for testing
export class MockWhatsAppClient implements IWhatsAppClient {
  private qrCallback?: (qr: string) => void;
  private connectedCallback?: (info: ConnectionInfo) => void;
  private disconnectedCallback?: (reason: any) => void;
  private connectionState: 'connecting' | 'open' | 'closed' = 'closed';

  constructor(public sessionId: string) {}

  async connect(): Promise<void> {
    this.connectionState = 'connecting';
    
    // Simulate QR generation after 100ms
    setTimeout(() => {
      if (this.qrCallback) {
        this.qrCallback('mock-qr-code-data-for-testing');
      }
    }, 100);
    
    // Simulate connection after 2 seconds
    setTimeout(() => {
      this.connectionState = 'open';
      if (this.connectedCallback) {
        this.connectedCallback({
          phoneNumber: '1234567890',
          name: 'Test User'
        });
      }
    }, 2000);
  }

  async disconnect(): Promise<void> {
    this.connectionState = 'closed';
    if (this.disconnectedCallback) {
      this.disconnectedCallback({ reason: 'Manual disconnect' });
    }
  }

  getConnectionState(): 'connecting' | 'open' | 'closed' {
    return this.connectionState;
  }

  onQR(callback: (qr: string) => void): void {
    this.qrCallback = callback;
  }

  onConnected(callback: (info: ConnectionInfo) => void): void {
    this.connectedCallback = callback;
  }

  onDisconnected(callback: (reason: any) => void): void {
    this.disconnectedCallback = callback;
  }
}