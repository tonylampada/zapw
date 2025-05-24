# Task 5: Message Sending

## Objective
Implement message sending functionality supporting all message types (text, image, video, audio, document, location, contact). This includes the HTTP endpoint, service logic, and Baileys adapter methods.

## Requirements

### 1. Message Models
Create `src/models/Message.ts`:

```typescript
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';

export interface BaseMessage {
  to: string;  // Phone number or WhatsApp ID
  type: MessageType;
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  text: string;
}

export interface MediaMessage extends BaseMessage {
  type: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  mediaBase64?: string;
  caption?: string;
  fileName?: string;  // For documents
}

export interface LocationMessage extends BaseMessage {
  type: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactMessage extends BaseMessage {
  type: 'contact';
  contactName: string;
  contactNumber: string;
}

export type Message = TextMessage | MediaMessage | LocationMessage | ContactMessage;

export interface SendMessageRequest {
  to: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  mediaBase64?: string;
  caption?: string;
  fileName?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  contactName?: string;
  contactNumber?: string;
}

export interface SendMessageResponse {
  messageId: string;
  timestamp: number;
  status: 'sent' | 'failed';
}
```

### 2. Extend WhatsApp Adapter
Update `src/adapters/whatsappAdapter.ts`:

```typescript
export interface IWhatsAppClient {
  // ... existing methods
  sendMessage(message: Message): Promise<string>; // Returns message ID
}

class BaileysClient implements IWhatsAppClient {
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
      case 'document':
        const media = message as MediaMessage;
        const buffer = await this.getMediaBuffer(media);
        content = {
          [message.type]: buffer,
          caption: media.caption,
          fileName: media.fileName
        };
        break;
        
      case 'location':
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
        
      case 'contact':
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
    
    const result = await this.socket.sendMessage(jid, content);
    return result.key.id;
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
      return Buffer.from(await response.arrayBuffer());
    }
    throw new Error('No media source provided');
  }
}
```

### 3. WhatsApp Service Methods
Update `src/services/whatsappService.ts`:

```typescript
export class WhatsAppService {
  async sendMessage(sessionId: string, message: Message): Promise<SendMessageResponse> {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new SessionNotFoundError();
    
    if (session.status !== 'connected') {
      throw new Error('Session not connected');
    }
    
    const client = this.clients.get(sessionId);
    if (!client) throw new Error('Client not initialized');
    
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
```

### 4. Message Validation
Create `src/utils/messageValidator.ts`:

```typescript
export function validateSendMessageRequest(req: SendMessageRequest): Message {
  if (!req.to) throw new Error('Recipient "to" is required');
  if (!req.type) throw new Error('Message type is required');
  
  switch (req.type) {
    case 'text':
      if (!req.text) throw new Error('Text is required for text messages');
      return { to: req.to, type: 'text', text: req.text };
      
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
      if (!req.mediaUrl && !req.mediaBase64) {
        throw new Error('Media URL or base64 is required');
      }
      return {
        to: req.to,
        type: req.type,
        mediaUrl: req.mediaUrl,
        mediaBase64: req.mediaBase64,
        caption: req.caption,
        fileName: req.fileName
      };
      
    // ... other types
    
    default:
      throw new Error(`Unknown message type: ${req.type}`);
  }
}
```

### 5. Messages Controller
Create `src/controllers/messagesController.ts`:

```typescript
router.post('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const message = validateSendMessageRequest(req.body);
    
    const result = await whatsappService.sendMessage(sessionId, message);
    res.json(result);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (error.message.includes('not connected')) {
      return res.status(400).json({ error: 'Session not connected' });
    }
    if (error.message.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});
```

### 6. Integration Tests
Create `test/integration/messages.test.ts`:

```typescript
describe('Messages API', () => {
  let sessionId: string;
  
  beforeEach(async () => {
    // Create and mock a connected session
    const response = await request(app).post('/sessions');
    sessionId = response.body.id;
    
    // Mock session as connected
    sessionManager.updateSession(sessionId, {
      status: 'connected',
      phoneNumber: '1234567890'
    });
  });
  
  describe('POST /sessions/:id/messages', () => {
    it('should send text message');
    it('should send image with caption');
    it('should send document with filename');
    it('should send location');
    it('should return 400 for missing required fields');
    it('should return 404 for non-existent session');
    it('should return 400 for disconnected session');
  });
});
```

### 7. Unit Tests
Create `test/unit/messageValidator.test.ts`:

```typescript
describe('Message Validator', () => {
  it('should validate text message');
  it('should validate media message with URL');
  it('should validate media message with base64');
  it('should reject message without recipient');
  it('should reject unknown message type');
  it('should reject media message without content');
});
```

## Success Criteria
- [ ] All message types can be sent successfully
- [ ] Proper validation for each message type
- [ ] Media can be sent via URL or base64
- [ ] Phone numbers are properly formatted
- [ ] Error messages are clear and helpful
- [ ] Integration tests cover all message types
- [ ] Unit tests validate all edge cases

## Notes
- Keep message validation separate from sending logic
- Support both international and local phone number formats
- Handle large media files appropriately (consider size limits)
- Return meaningful error messages for debugging
- Consider adding message queuing in future iterations