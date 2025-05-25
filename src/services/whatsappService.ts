import { sessionManager } from './sessionManager';
import { IWhatsAppClient, BaileysClient, MockWhatsAppClient } from '../adapters/whatsappAdapter';
import { SessionNotFoundError } from '../models/errors';
import { printQRToConsole } from '../utils/qrUtil';
import { Message, SendMessageResponse } from '../models/Message';
import { webhookAdapter } from '../adapters/webhookAdapter';
import { MessageReceivedEvent, WebhookEvent } from '../models/Event';
import * as QRCode from 'qrcode';

export class WhatsAppService {
  private clients: Map<string, IWhatsAppClient> = new Map();
  private useMock: boolean;

  constructor(useMock: boolean = process.env.USE_MOCK_WHATSAPP === 'true') {
    this.useMock = useMock;
  }

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
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session ${sessionId} not found`);
    }

    // Create client based on mock setting
    const client = this.useMock 
      ? new MockWhatsAppClient(sessionId)
      : new BaileysClient(sessionId);

    // Set up event handlers
    client.onQR(async (qr) => {
      console.log(`QR code received for session ${sessionId}`);
      
      // Print QR to console in development
      if (process.env.NODE_ENV === 'development') {
        printQRToConsole(qr);
      }
      
      // Convert QR data to base64 image
      let qrCodeImage: string;
      try {
        qrCodeImage = await QRCode.toDataURL(qr, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      } catch (error) {
        console.error('Failed to generate QR code image:', error);
        qrCodeImage = qr; // Fallback to raw data
      }
      
      // QR codes expire after 60 seconds
      const qrExpiresAt = new Date(Date.now() + 60 * 1000);
      
      sessionManager.updateSession(sessionId, {
        qrCode: qrCodeImage,
        qrExpiresAt,
        status: 'qr_waiting'
      }).catch(err => console.error('Failed to update session:', err));
    });

    client.onConnected(async (info) => {
      console.log(`Session ${sessionId} connected: ${info.phoneNumber}`);
      await sessionManager.updateSession(sessionId, {
        phoneNumber: info.phoneNumber,
        name: info.name,
        status: 'connected',
        connectedAt: new Date(),
        qrCode: undefined, // Clear QR code after connection
        qrExpiresAt: undefined // Clear expiration after connection
      });
      
      // Send session connected event
      await webhookAdapter.sendEvent({
        sessionId,
        origin: info.phoneNumber,
        eventType: 'session.connected',
        timestamp: Date.now(),
        data: { phoneNumber: info.phoneNumber, name: info.name }
      });
    });

    client.onDisconnected(async (reason) => {
      console.log(`Session ${sessionId} disconnected:`, reason);
      await sessionManager.updateSession(sessionId, {
        status: 'disconnected'
      });
      
      const session = sessionManager.getSession(sessionId);
      if (session) {
        // Send session disconnected event
        await webhookAdapter.sendEvent({
          sessionId,
          origin: session.phoneNumber || sessionId,
          eventType: 'session.disconnected',
          timestamp: Date.now(),
          data: { reason }
        });
      }
      
      // Remove client from map on disconnect
      this.clients.delete(sessionId);
    });
    
    // Handle incoming messages
    client.onMessageReceived(async (message) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) return;
      
      const event: MessageReceivedEvent = {
        sessionId,
        origin: session.phoneNumber || sessionId,
        eventType: 'message.received',
        timestamp: Date.now(),
        data: message
      };
      
      await webhookAdapter.sendEvent(event);
    });
    
    // Handle message status updates
    client.onMessageStatusUpdate(async (update) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) return;
      
      // Determine event type based on update
      let eventType: 'message.delivered' | 'message.read' | 'message.sent' = 'message.sent';
      if (update.status === 3) eventType = 'message.delivered';
      if (update.status === 4) eventType = 'message.read';
      
      const event: WebhookEvent = {
        sessionId,
        origin: session.phoneNumber || sessionId,
        eventType,
        timestamp: Date.now(),
        data: {
          messageId: update.key?.id,
          status: update.status
        }
      };
      
      await webhookAdapter.sendEvent(event);
    });

    try {
      // Update session status during initialization
      await sessionManager.updateSession(sessionId, {
        status: 'connecting'
      });
      
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

  async waitForQRCode(sessionId: string, timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const session = sessionManager.getSession(sessionId);
      
      if (!session) {
        throw new SessionNotFoundError(`Session ${sessionId} not found`);
      }
      
      // If we have a QR code or session is already connected/failed
      if (session.qrCode || session.status === 'connected' || session.status === 'disconnected') {
        return;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for QR code');
  }

  async refreshQRCode(sessionId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session ${sessionId} not found`);
    }
    
    // Only refresh if in qr_waiting status
    if (session.status !== 'qr_waiting') {
      return;
    }
    
    // Check if QR is expired
    if (session.qrExpiresAt && new Date() < session.qrExpiresAt) {
      return; // QR is still valid
    }
    
    console.log(`Refreshing expired QR for session ${sessionId}`);
    
    // Disconnect and reconnect to get new QR
    const client = this.clients.get(sessionId);
    if (client) {
      await client.disconnect();
      this.clients.delete(sessionId);
    }
    
    // Reinitialize to get new QR
    await this.initializeSession(sessionId);
    
    // Wait for new QR
    await this.waitForQRCode(sessionId, 15000);
  }
}

export const whatsappService = new WhatsAppService();