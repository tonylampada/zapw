import { sessionManager } from './sessionManager';
import { IWhatsAppClient, BaileysClient, MockWhatsAppClient } from '../adapters/whatsappAdapter';
import { SessionNotFoundError } from '../models/errors';
import { printQRToConsole } from '../utils/qrUtil';
import { Message, SendMessageResponse } from '../models/Message';

export class WhatsAppService {
  private clients: Map<string, IWhatsAppClient> = new Map();
  private useMock: boolean;

  constructor(useMock: boolean = process.env.USE_MOCK_WHATSAPP === 'true') {
    this.useMock = useMock;
  }

  async initializeSession(sessionId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session ${sessionId} not found`);
    }

    // Create client based on mock setting
    const client = this.useMock 
      ? new MockWhatsAppClient(sessionId)
      : new BaileysClient(sessionId);

    // Set up event handlers
    client.onQR((qr) => {
      console.log(`QR code received for session ${sessionId}`);
      
      // Print QR to console in development
      if (process.env.NODE_ENV === 'development') {
        printQRToConsole(qr);
      }
      
      sessionManager.updateSession(sessionId, {
        qrCode: qr,
        status: 'qr_waiting'
      });
    });

    client.onConnected((info) => {
      console.log(`Session ${sessionId} connected: ${info.phoneNumber}`);
      sessionManager.updateSession(sessionId, {
        phoneNumber: info.phoneNumber,
        name: info.name,
        status: 'connected',
        connectedAt: new Date(),
        qrCode: undefined // Clear QR code after connection
      });
    });

    client.onDisconnected((reason) => {
      console.log(`Session ${sessionId} disconnected:`, reason);
      sessionManager.updateSession(sessionId, {
        status: 'disconnected'
      });
      
      // Remove client from map on disconnect
      this.clients.delete(sessionId);
    });

    try {
      await client.connect();
      this.clients.set(sessionId, client);
    } catch (error) {
      console.error(`Failed to initialize WhatsApp for session ${sessionId}:`, error);
      throw error;
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId);
    if (client) {
      await client.disconnect();
      this.clients.delete(sessionId);
    }
  }

  getClient(sessionId: string): IWhatsAppClient | undefined {
    return this.clients.get(sessionId);
  }

  isSessionConnected(sessionId: string): boolean {
    const client = this.clients.get(sessionId);
    return client?.getConnectionState() === 'open';
  }

  async sendMessage(sessionId: string, message: Message): Promise<SendMessageResponse> {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session ${sessionId} not found`);
    }
    
    if (session.status !== 'connected') {
      throw new Error('Session not connected');
    }
    
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error('Client not initialized');
    }
    
    try {
      const messageId = await client.sendMessage(message);
      return {
        messageId,
        timestamp: Date.now(),
        status: 'sent'
      };
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error('Failed to send message');
    }
  }
}

export const whatsappService = new WhatsAppService();