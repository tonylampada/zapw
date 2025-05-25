import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import { Message, TextMessage, MediaMessage, LocationMessage, ContactMessage } from '../models/Message';
import * as QRCode from 'qrcode';

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
  sendMessage(message: Message): Promise<string>;
  onMessageReceived(callback: (message: any) => void): void;
  onMessageStatusUpdate(callback: (update: any) => void): void;
}

export class BaileysClient implements IWhatsAppClient {
  private socket?: WASocket;
  private qrCallback?: (qr: string) => void;
  private connectedCallback?: (info: ConnectionInfo) => void;
  private disconnectedCallback?: (reason: any) => void;
  private messageReceivedCallback?: (message: any) => void;
  private _messageStatusUpdateCallback?: (update: any) => void;
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
      defaultQueryTimeoutMs: 60000,
      browser: ['Chrome (Linux)', 'Chrome', '129.0.0.0'],
      syncFullHistory: false
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
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`Connection closed. Status code: ${statusCode}, Should reconnect: ${shouldReconnect}`);
        console.log('Disconnect reason:', lastDisconnect?.error);
        
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
    
    // Listen for incoming messages
    this.socket.ev.on('messages.upsert', async (upsert: any) => {
      const messages = upsert.messages;
      
      for (const msg of messages) {
        // Only process incoming messages (not our own)
        if (!msg.key.fromMe && upsert.type === 'notify') {
          this.handleIncomingMessage(msg);
        }
      }
    });
    
    // Listen for message status updates
    this.socket.ev.on('messages.update', (updates: any) => {
      for (const update of updates) {
        this.handleMessageStatusUpdate(update);
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

  async sendMessage(message: Message): Promise<string> {
    if (!this.socket) throw new Error('Not connected');
    
    const jid = this.formatJID(message.to);
    let content: any;
    
    switch (message.type) {
      case 'text':
        content = { text: (message as TextMessage).text };
        break;
        
      case 'image':
      case 'video':
      case 'audio':
      case 'document': {
        const media = message as MediaMessage;
        const buffer = await this.getMediaBuffer(media);
        content = {
          [message.type]: buffer,
          caption: media.caption,
          fileName: media.fileName
        };
        break;
      }
        
      case 'location': {
        const loc = message as LocationMessage;
        content = {
          location: {
            degreesLatitude: loc.latitude,
            degreesLongitude: loc.longitude,
            name: loc.name,
            address: loc.address
          }
        };
        break;
      }
        
      case 'contact': {
        const contact = message as ContactMessage;
        content = {
          contacts: {
            displayName: contact.contactName,
            contacts: [{
              vcard: this.generateVCard(contact)
            }]
          }
        };
        break;
      }
    }
    
    const result = await this.socket.sendMessage(jid, content);
    return result?.key?.id || '';
  }
  
  private formatJID(number: string): string {
    // Ensure proper WhatsApp JID format
    const cleaned = number.replace(/\D/g, '');
    return cleaned.includes('@') ? cleaned : `${cleaned}@s.whatsapp.net`;
  }
  
  private async getMediaBuffer(media: MediaMessage): Promise<Buffer> {
    if (media.mediaBase64) {
      return Buffer.from(media.mediaBase64, 'base64');
    } else if (media.mediaUrl) {
      // Download from URL
      const response = await fetch(media.mediaUrl);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    throw new Error('No media source provided');
  }
  
  private generateVCard(contact: ContactMessage): string {
    return `BEGIN:VCARD
VERSION:3.0
FN:${contact.contactName}
TEL;type=CELL;type=VOICE;waid=${contact.contactNumber.replace(/\D/g, '')}:${contact.contactNumber}
END:VCARD`;
  }
  
  private handleIncomingMessage(msg: any): void {
    if (!this.messageReceivedCallback) return;
    
    const messageData = this.parseMessage(msg);
    this.messageReceivedCallback(messageData);
  }
  
  private handleMessageStatusUpdate(update: any): void {
    if (!this._messageStatusUpdateCallback) return;
    this._messageStatusUpdateCallback(update);
  }
  
  private parseMessage(msg: any): any {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    
    const parsed: any = {
      from: msg.key.participant || from,
      to: this.socket!.user?.id,
      messageId: msg.key.id,
      timestamp: msg.messageTimestamp * 1000,
      isGroup,
      groupId: isGroup ? from : undefined
    };
    
    // Parse message content based on type
    if (msg.message?.conversation || msg.message?.extendedTextMessage) {
      parsed.type = 'text';
      parsed.text = msg.message.conversation || msg.message.extendedTextMessage.text;
    } else if (msg.message?.imageMessage) {
      parsed.type = 'image';
      parsed.caption = msg.message.imageMessage.caption;
      parsed.hasMedia = true;
    } else if (msg.message?.videoMessage) {
      parsed.type = 'video';
      parsed.caption = msg.message.videoMessage.caption;
      parsed.hasMedia = true;
    } else if (msg.message?.audioMessage) {
      parsed.type = 'audio';
      parsed.hasMedia = true;
    } else if (msg.message?.documentMessage) {
      parsed.type = 'document';
      parsed.fileName = msg.message.documentMessage.fileName;
      parsed.hasMedia = true;
    } else if (msg.message?.locationMessage) {
      parsed.type = 'location';
      parsed.location = {
        latitude: msg.message.locationMessage.degreesLatitude,
        longitude: msg.message.locationMessage.degreesLongitude,
        name: msg.message.locationMessage.name,
        address: msg.message.locationMessage.address
      };
    } else if (msg.message?.contactMessage) {
      parsed.type = 'contact';
      const vcard = msg.message.contactMessage.vcard;
      parsed.contact = {
        name: msg.message.contactMessage.displayName,
        number: this.extractPhoneFromVCard(vcard)
      };
    }
    
    return parsed;
  }
  
  private extractPhoneFromVCard(vcard: string): string {
    // Extract phone number from vCard
    const match = vcard.match(/TEL[^:]*:([+\d\s-]+)/i);
    return match ? match[1].trim() : '';
  }
  
  onMessageReceived(callback: (message: any) => void): void {
    this.messageReceivedCallback = callback;
  }
  
  onMessageStatusUpdate(callback: (update: any) => void): void {
    this._messageStatusUpdateCallback = callback;
  }
}

// Mock implementation for testing
export class MockWhatsAppClient implements IWhatsAppClient {
  private qrCallback?: (qr: string) => void;
  private connectedCallback?: (info: ConnectionInfo) => void;
  private disconnectedCallback?: (reason: any) => void;
  private messageReceivedCallback?: (message: any) => void;
  private _messageStatusUpdateCallback?: (update: any) => void;
  private connectionState: 'connecting' | 'open' | 'closed' = 'closed';

  constructor(public sessionId: string) {}

  async connect(): Promise<void> {
    this.connectionState = 'connecting';
    
    // Simulate QR generation after 100ms
    setTimeout(async () => {
      if (this.qrCallback) {
        // Generate a mock base64 QR code
        try {
          const mockQRData = `mock-qr-${this.sessionId}-${Date.now()}`;
          const qrCodeImage = await QRCode.toDataURL(mockQRData, {
            width: 256,
            margin: 2
          });
          this.qrCallback(qrCodeImage);
        } catch (error) {
          this.qrCallback('mock-qr-code-data-for-testing');
        }
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

  async sendMessage(message: Message): Promise<string> {
    if (this.connectionState !== 'open') {
      throw new Error('Not connected');
    }
    
    // Simulate message sending with a small delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate mock message ID
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    console.log(`[Mock] Sending ${message.type} message to ${message.to}`);
    
    return messageId;
  }
  
  onMessageReceived(callback: (message: any) => void): void {
    this.messageReceivedCallback = callback;
  }
  
  onMessageStatusUpdate(callback: (update: any) => void): void {
    this._messageStatusUpdateCallback = callback;
  }
  
  // Simulate message status update for testing
  simulateMessageStatusUpdate(update: any): void {
    if (this._messageStatusUpdateCallback) {
      this._messageStatusUpdateCallback(update);
    }
  }
  
  // Simulate receiving a message for testing
  simulateIncomingMessage(message: any): void {
    if (this.messageReceivedCallback) {
      this.messageReceivedCallback(message);
    }
  }
}