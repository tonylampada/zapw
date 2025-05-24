# Task 4: Baileys Adapter (Connection Only)

## Objective
Integrate Baileys library for WhatsApp connectivity, focusing on QR code generation and session establishment. This creates the bridge between our session manager and actual WhatsApp connections.

## Requirements

### 1. Install Baileys
Add to package.json:
```bash
npm install @whiskeysockets/baileys
npm install --save-dev @types/ws  # Baileys dependency
```

### 2. WhatsApp Adapter Interface
Create `src/adapters/whatsappAdapter.ts`:

```typescript
export interface IWhatsAppClient {
  sessionId: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): 'connecting' | 'open' | 'closed';
  onQR(callback: (qr: string) => void): void;
  onConnected(callback: (info: ConnectionInfo) => void): void;
  onDisconnected(callback: (reason: any) => void): void;
}

interface ConnectionInfo {
  phoneNumber: string;
  name?: string;
}
```

### 3. Baileys Implementation
```typescript
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState 
} from '@whiskeysockets/baileys';

export class BaileysClient implements IWhatsAppClient {
  private socket?: any;
  private qrCallback?: (qr: string) => void;
  
  constructor(public sessionId: string) {}

  async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(
      `sessions_data/${this.sessionId}`
    );

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false
    });

    this.socket.ev.on('creds.update', saveCreds);
    
    this.socket.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr && this.qrCallback) {
        this.qrCallback(qr);
      }
      
      if (connection === 'close') {
        // Handle disconnection
      }
      
      if (connection === 'open') {
        // Handle successful connection
      }
    });
  }
}
```

### 4. WhatsApp Service Integration
Create `src/services/whatsappService.ts`:

```typescript
export class WhatsAppService {
  private clients: Map<string, IWhatsAppClient> = new Map();
  
  async initializeSession(sessionId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    const client = new BaileysClient(sessionId);
    
    // Set up event handlers
    client.onQR((qr) => {
      sessionManager.updateSession(sessionId, {
        qrCode: qr,
        status: 'qr_waiting'
      });
    });
    
    client.onConnected((info) => {
      sessionManager.updateSession(sessionId, {
        phoneNumber: info.phoneNumber,
        name: info.name,
        status: 'connected',
        connectedAt: new Date(),
        qrCode: undefined  // Clear QR
      });
    });
    
    client.onDisconnected((reason) => {
      sessionManager.updateSession(sessionId, {
        status: 'disconnected'
      });
    });
    
    await client.connect();
    this.clients.set(sessionId, client);
  }
  
  async terminateSession(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId);
    if (client) {
      await client.disconnect();
      this.clients.delete(sessionId);
    }
  }
}
```

### 5. Update Session Endpoints
Modify `src/controllers/sessionsController.ts`:

```typescript
// POST /sessions - now triggers Baileys connection
router.post('/sessions', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = sessionManager.createSession(sessionId);
    
    // Start WhatsApp connection
    whatsappService.initializeSession(session.id)
      .catch(err => console.error('Failed to initialize WhatsApp:', err));
    
    res.status(201).json(mapSessionToResponse(session));
  } catch (error) {
    // Error handling
  }
});

// DELETE /sessions/:id - now disconnects WhatsApp
router.delete('/sessions/:id', async (req, res) => {
  await whatsappService.terminateSession(req.params.id);
  const deleted = sessionManager.deleteSession(req.params.id);
  // ... rest of implementation
});
```

### 6. QR Code Utilities
Create `src/utils/qrUtil.ts`:
```typescript
import QRCode from 'qrcode';

export async function generateQRDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text);
}

export function printQRToConsole(text: string): void {
  QRCode.toString(text, { type: 'terminal' }, (err, qr) => {
    if (!err) console.log(qr);
  });
}
```

### 7. Unit Tests with Mocked Baileys
Create `test/unit/whatsappAdapter.test.ts`:

```typescript
jest.mock('@whiskeysockets/baileys');

describe('BaileysClient', () => {
  it('should emit QR code when connecting without auth');
  it('should emit connected event when connection opens');
  it('should handle disconnection');
  it('should reuse saved credentials');
});
```

### 8. Integration Test Updates
Update `test/integration/sessions.test.ts`:
- Mock the WhatsApp service for integration tests
- Test that creating a session triggers WhatsApp initialization
- Test that QR code appears in session data

## Success Criteria
- [ ] Baileys successfully integrated
- [ ] QR code generated for new sessions
- [ ] QR code visible in GET /sessions/:id response
- [ ] Session status updates through connection lifecycle
- [ ] Graceful handling of connection errors
- [ ] Unit tests pass with mocked Baileys
- [ ] Sessions can reconnect using saved auth

## Testing Without Real WhatsApp
For testing, create a mock implementation:
```typescript
export class MockWhatsAppClient implements IWhatsAppClient {
  async connect(): Promise<void> {
    // Simulate QR generation
    setTimeout(() => this.qrCallback?.('mock-qr-code'), 100);
    // Simulate connection after 2 seconds
    setTimeout(() => this.connectedCallback?.({
      phoneNumber: '1234567890',
      name: 'Test User'
    }), 2000);
  }
}
```

## Notes
- Keep Baileys-specific code isolated in the adapter
- Handle connection errors gracefully
- Don't expose Baileys types outside the adapter
- Sessions should auto-reconnect on temporary disconnects
- Clear QR code from memory once connected