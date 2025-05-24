# Task 6: Incoming Message Handling & Webhook

## Objective
Implement handling of incoming WhatsApp messages and events, forwarding them to a configured webhook URL. This completes the bidirectional communication flow.

## Requirements

### 1. Event Models
Create `src/models/Event.ts`:

```typescript
export interface WebhookEvent {
  sessionId: string;
  origin: string;  // Phone number of the WhatsApp account
  eventType: 'message.received' | 'message.sent' | 'message.delivered' | 'message.read' | 'session.connected' | 'session.disconnected';
  timestamp: number;
  data: any;
}

export interface MessageReceivedEvent extends WebhookEvent {
  eventType: 'message.received';
  data: {
    from: string;
    to: string;
    messageId: string;
    timestamp: number;
    type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';
    text?: string;
    caption?: string;
    mediaType?: string;
    fileName?: string;
    hasMedia?: boolean;
    location?: {
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };
    contact?: {
      name: string;
      number: string;
    };
    isGroup: boolean;
    groupId?: string;
    groupName?: string;
  };
}
```

### 2. Webhook Adapter
Create `src/adapters/webhookAdapter.ts`:

```typescript
import axios from 'axios';
import { config } from '../utils/config';

export class WebhookAdapter {
  private webhookUrl: string;
  private enabled: boolean;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.webhookUrl = config.WEBHOOK_URL;
    this.enabled = config.ENABLE_WEBHOOK;
  }

  async sendEvent(event: WebhookEvent): Promise<void> {
    if (!this.enabled || !this.webhookUrl) {
      console.log('Webhook disabled or URL not configured');
      return;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await axios.post(this.webhookUrl, event, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event.eventType
          },
          timeout: 10000
        });
        
        console.log(`Webhook delivered: ${event.eventType} for session ${event.sessionId}`);
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`Webhook delivery attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    
    console.error('Webhook delivery failed after all attempts:', lastError);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const webhookAdapter = new WebhookAdapter();
```

### 3. Update WhatsApp Adapter for Events
Update `src/adapters/whatsappAdapter.ts`:

```typescript
export interface IWhatsAppClient {
  // ... existing methods
  onMessageReceived(callback: (message: any) => void): void;
  onMessageStatusUpdate(callback: (update: any) => void): void;
}

class BaileysClient implements IWhatsAppClient {
  private messageReceivedCallback?: (message: any) => void;
  
  async connect(): Promise<void> {
    // ... existing connection code
    
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
  
  private handleIncomingMessage(msg: any): void {
    if (!this.messageReceivedCallback) return;
    
    const messageData = this.parseMessage(msg);
    this.messageReceivedCallback(messageData);
  }
  
  private parseMessage(msg: any): any {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    
    let parsed: any = {
      from: msg.key.participant || from,
      to: this.socket.user.id,
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
      parsed.contact = {
        name: msg.message.contactMessage.displayName,
        number: msg.message.contactMessage.vcard // Parse vCard if needed
      };
    }
    
    return parsed;
  }
  
  onMessageReceived(callback: (message: any) => void): void {
    this.messageReceivedCallback = callback;
  }
}
```

### 4. Update WhatsApp Service
Update `src/services/whatsappService.ts`:

```typescript
export class WhatsAppService {
  constructor() {
    // Initialize webhook adapter
    this.webhookAdapter = webhookAdapter;
  }
  
  async initializeSession(sessionId: string): Promise<void> {
    // ... existing code
    
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
      
      await this.webhookAdapter.sendEvent(event);
    });
    
    // Also send session status events
    client.onConnected(async (info) => {
      // ... existing session update code
      
      await this.webhookAdapter.sendEvent({
        sessionId,
        origin: info.phoneNumber,
        eventType: 'session.connected',
        timestamp: Date.now(),
        data: { phoneNumber: info.phoneNumber, name: info.name }
      });
    });
    
    client.onDisconnected(async (reason) => {
      // ... existing session update code
      
      await this.webhookAdapter.sendEvent({
        sessionId,
        origin: session.phoneNumber || sessionId,
        eventType: 'session.disconnected',
        timestamp: Date.now(),
        data: { reason }
      });
    });
  }
}
```

### 5. Update Configuration
Update `src/utils/config.ts`:

```typescript
export const config = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  ENABLE_WEBHOOK: process.env.ENABLE_WEBHOOK === 'true',
  WEBHOOK_RETRY_ATTEMPTS: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3'),
  WEBHOOK_RETRY_DELAY: parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000')
};
```

### 6. Test Webhook Endpoint
Create `src/controllers/testWebhookController.ts` (for development):

```typescript
router.post('/webhook-test', (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));
  res.json({ received: true });
});
```

### 7. Integration Tests
Create `test/integration/webhook.test.ts`:

```typescript
describe('Webhook Integration', () => {
  let webhookServer: any;
  let webhookReceived: any[] = [];
  
  beforeAll((done) => {
    // Start a test webhook server
    webhookServer = express();
    webhookServer.use(express.json());
    webhookServer.post('/webhook', (req, res) => {
      webhookReceived.push(req.body);
      res.json({ ok: true });
    });
    webhookServer.listen(4000, done);
  });
  
  beforeEach(() => {
    webhookReceived = [];
    process.env.WEBHOOK_URL = 'http://localhost:4000/webhook';
    process.env.ENABLE_WEBHOOK = 'true';
  });
  
  it('should forward incoming message to webhook');
  it('should include session info in webhook payload');
  it('should retry failed webhook deliveries');
  it('should not send webhooks when disabled');
});
```

### 8. Unit Tests
Create `test/unit/webhookAdapter.test.ts`:

```typescript
describe('WebhookAdapter', () => {
  it('should send event to configured URL');
  it('should retry on failure');
  it('should respect enabled flag');
  it('should include proper headers');
});
```

## Success Criteria
- [ ] Incoming messages trigger webhook calls
- [ ] All message types are properly parsed
- [ ] Webhook includes session identification
- [ ] Failed webhooks are retried
- [ ] Webhook can be disabled via config
- [ ] Group messages are properly identified
- [ ] Session status events are sent
- [ ] Test webhook endpoint works for development

## Notes
- Keep webhook payloads consistent and well-documented
- Don't include large media in webhooks (use media endpoint)
- Consider webhook authentication in future iterations
- Log all webhook attempts for debugging
- Handle webhook timeouts gracefully