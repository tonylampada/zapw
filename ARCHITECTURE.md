# ZAPW Architecture Documentation

## System Overview

ZAPW is designed as a microservice that bridges WhatsApp Web functionality with HTTP REST APIs. It runs alongside other services in a Docker Compose environment.

## Docker Compose Architecture

```mermaid
graph TB
    subgraph "Docker Network"
        ZAPW[ZAPW Service<br/>tonylampada/zapw:latest]
        PG[(PostgreSQL<br/>Database)]
        REDIS[(Redis<br/>Cache/Queue)]
        APP[Your Application<br/>Service]
    end
    
    WA[WhatsApp Web<br/>Servers]
    WEBHOOK[Webhook<br/>Endpoint]
    CLIENT[HTTP Clients]
    
    CLIENT -->|REST API| ZAPW
    ZAPW <-->|Baileys Protocol| WA
    ZAPW -->|Events| WEBHOOK
    APP <-->|Query/Store| PG
    APP <-->|Cache/Queue| REDIS
    APP -->|Send Messages| ZAPW
    WEBHOOK -->|Process Events| APP
```

### Example Docker Compose Configuration

```yaml
version: '3.8'

services:
  # WhatsApp API Service
  zapw:
    image: tonylampada/zapw:latest
    ports:
      - "3000:3000"
    environment:
      - WEBHOOK_URL=http://app:8080/webhook
      - LOG_LEVEL=info
    volumes:
      - zapw-sessions:/app/sessions_data
    networks:
      - app-network
    restart: unless-stopped

  # Your Application
  app:
    image: your-app:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/dbname
      - REDIS_URL=redis://redis:6379
      - ZAPW_URL=http://zapw:3000
    depends_on:
      - postgres
      - redis
      - zapw
    networks:
      - app-network

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=dbname
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    networks:
      - app-network

volumes:
  zapw-sessions:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

## ZAPW Internal Architecture

### Component Structure

```mermaid
graph LR
    subgraph "HTTP Layer"
        ROUTES[Express Routes]
        MW[Middleware]
    end
    
    subgraph "Controllers"
        SC[Sessions Controller]
        MC[Messages Controller]
        EC[Events Controller]
    end
    
    subgraph "Services"
        SM[Session Manager]
        WS[WhatsApp Service]
    end
    
    subgraph "Adapters"
        BA[Baileys Adapter]
        WHA[Webhook Adapter]
        PA[Persistence Adapter]
    end
    
    subgraph "External"
        WA[WhatsApp Web]
        FS[(File System)]
        WH[Webhook URL]
    end
    
    ROUTES --> MW
    MW --> SC
    MW --> MC
    MW --> EC
    
    SC --> SM
    MC --> WS
    EC --> WS
    
    SM --> WS
    WS --> BA
    WS --> WHA
    SM --> PA
    
    BA <--> WA
    PA <--> FS
    WHA --> WH
```

### Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant SessionManager
    participant WhatsAppService
    participant BaileysAdapter
    participant WhatsApp
    participant Webhook
    
    Client->>API: POST /sessions
    API->>SessionManager: createSession()
    SessionManager->>WhatsAppService: initializeSession()
    WhatsAppService->>BaileysAdapter: connect()
    BaileysAdapter-->>WhatsApp: WebSocket Connect
    BaileysAdapter-->>WhatsAppService: QR Code
    WhatsAppService-->>API: Session + QR
    API-->>Client: 200 OK + QR Code
    
    Note over Client: User scans QR
    
    WhatsApp-->>BaileysAdapter: Auth Success
    BaileysAdapter-->>WhatsAppService: Connected
    WhatsAppService-->>Webhook: session.connected event
    
    Client->>API: POST /sessions/{id}/messages
    API->>WhatsAppService: sendMessage()
    WhatsAppService->>BaileysAdapter: sendMessage()
    BaileysAdapter-->>WhatsApp: Send via WebSocket
    WhatsApp-->>BaileysAdapter: Message Sent
    BaileysAdapter-->>WhatsAppService: Success
    WhatsAppService-->>Webhook: message.sent event
    WhatsAppService-->>API: Message ID
    API-->>Client: 200 OK
```

## Front-End Architecture

### Web Interface Components

```mermaid
graph TB
    subgraph "Browser"
        HTML[index.html<br/>Test Interface]
        JS[JavaScript<br/>Event Handlers]
        UI[UI Components]
    end
    
    subgraph "UI Components"
        AUTH[Authentication<br/>Panel]
        SESSIONS[Sessions<br/>List]
        MSG[Message<br/>Sender]
        EVENTS[Events<br/>Monitor]
    end
    
    subgraph "API Interactions"
        FETCH[Fetch API]
        WS[WebSocket<br/>Future]
    end
    
    HTML --> JS
    JS --> UI
    UI --> AUTH
    UI --> SESSIONS
    UI --> MSG
    UI --> EVENTS
    
    JS --> FETCH
    FETCH -->|REST| API[ZAPW API]
    
    AUTH -->|POST /sessions| API
    SESSIONS -->|GET /sessions| API
    MSG -->|POST /messages| API
    EVENTS -->|GET /events| API
```

### Front-End Services Architecture

```mermaid
classDiagram
    class APIService {
        +baseURL: string
        +createSession()
        +getSessions()
        +getSession(id)
        +deleteSession(id)
        +sendMessage(sessionId, message)
        +getEvents(sessionId)
    }
    
    class SessionService {
        -api: APIService
        -sessions: Map
        +create()
        +list()
        +get(id)
        +delete(id)
        +refreshQR(id)
    }
    
    class MessageService {
        -api: APIService
        +sendText(sessionId, to, text)
        +sendImage(sessionId, to, image, caption)
        +sendAudio(sessionId, to, audio)
        +sendDocument(sessionId, to, doc, filename)
    }
    
    class EventService {
        -api: APIService
        -events: Array
        +getRecent(limit)
        +clear()
        +subscribe(callback)
    }
    
    class UIController {
        -sessionService: SessionService
        -messageService: MessageService
        -eventService: EventService
        +init()
        +render()
        +handleEvents()
    }
    
    APIService <-- SessionService
    APIService <-- MessageService
    APIService <-- EventService
    SessionService <-- UIController
    MessageService <-- UIController
    EventService <-- UIController
```

## Message Storage Strategy

When integrating ZAPW with your application, consider these storage patterns:

### Recommended Database Schema

```sql
-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    whatsapp_id VARCHAR(255) UNIQUE,
    direction VARCHAR(10) CHECK (direction IN ('sent', 'received')),
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    type VARCHAR(20),
    content JSONB,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Events table for webhook processing
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY,
    session_id VARCHAR(255),
    event_type VARCHAR(50),
    payload JSONB,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_whatsapp_id ON messages(whatsapp_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
```

### Message Processing Flow

```mermaid
graph LR
    WEBHOOK[Webhook<br/>Endpoint]
    QUEUE[Redis Queue]
    PROCESSOR[Message<br/>Processor]
    DB[(PostgreSQL)]
    CACHE[(Redis Cache)]
    
    WEBHOOK -->|Enqueue| QUEUE
    QUEUE -->|Dequeue| PROCESSOR
    PROCESSOR -->|Store| DB
    PROCESSOR -->|Cache| CACHE
    PROCESSOR -->|Business Logic| APP[Your App Logic]
```

## Deployment Considerations

### Production Setup

1. **Load Balancing**: Run multiple ZAPW instances behind a load balancer for high availability
2. **Session Affinity**: Ensure requests for the same WhatsApp session go to the same ZAPW instance
3. **Monitoring**: Set up health checks and metrics collection
4. **Backup**: Regular backups of the sessions_data volume
5. **Security**: Use HTTPS, API authentication, and network isolation

### Scaling Strategy

```mermaid
graph TB
    LB[Load Balancer]
    
    subgraph "ZAPW Cluster"
        ZAPW1[ZAPW-1<br/>Sessions: A-M]
        ZAPW2[ZAPW-2<br/>Sessions: N-Z]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Primary)]
        PG_R[(PostgreSQL<br/>Replica)]
        REDIS1[(Redis<br/>Primary)]
        REDIS2[(Redis<br/>Replica)]
    end
    
    LB --> ZAPW1
    LB --> ZAPW2
    
    ZAPW1 --> PG
    ZAPW2 --> PG
    
    PG -.-> PG_R
    REDIS1 -.-> REDIS2
```

## Security Architecture

### Network Isolation

```mermaid
graph TB
    subgraph "Public Network"
        INTERNET[Internet]
        LB[Load Balancer<br/>SSL Termination]
    end
    
    subgraph "DMZ"
        WAF[Web Application<br/>Firewall]
        PROXY[API Gateway]
    end
    
    subgraph "Private Network"
        ZAPW[ZAPW Service]
        APP[Application]
        DB[(Database)]
    end
    
    INTERNET --> LB
    LB --> WAF
    WAF --> PROXY
    PROXY --> ZAPW
    ZAPW <--> APP
    APP <--> DB
```

## Development Workflow

### Local Development Setup

```bash
# Clone and setup
git clone https://github.com/tonylampada/zapw
cd zapw
npm install

# Run services
docker-compose -f docker-compose.dev.yml up -d postgres redis
npm run dev

# Run tests
npm test
```

### CI/CD Pipeline

```mermaid
graph LR
    GIT[Git Push]
    CI[GitHub Actions]
    TEST[Run Tests]
    BUILD[Build Docker]
    PUSH[Push to Registry]
    DEPLOY[Deploy]
    
    GIT --> CI
    CI --> TEST
    TEST -->|Pass| BUILD
    BUILD --> PUSH
    PUSH --> DEPLOY
```

## Integration Patterns

### Webhook Processing

```javascript
// Example webhook processor
app.post('/webhook', async (req, res) => {
  const event = req.body;
  
  // Acknowledge immediately
  res.status(200).send('OK');
  
  // Process asynchronously
  await queue.add('process-webhook', event);
});

// Queue processor
queue.process('process-webhook', async (job) => {
  const { eventType, data, sessionId } = job.data;
  
  switch (eventType) {
    case 'message.received':
      await processIncomingMessage(data);
      break;
    case 'message.sent':
      await updateMessageStatus(data);
      break;
    case 'session.connected':
      await onSessionConnected(sessionId);
      break;
  }
});
```

### Message Sending Pattern

```javascript
// Centralized message sender
class WhatsAppClient {
  constructor(zapwUrl) {
    this.baseUrl = zapwUrl;
  }
  
  async sendMessage(sessionId, to, message) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, ...message })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      
      // Store in database
      await db.messages.create({
        whatsapp_id: result.data.messageId,
        session_id: sessionId,
        direction: 'sent',
        to_number: to,
        type: message.type,
        content: message,
        status: 'sent'
      });
      
      return result.data;
    } catch (error) {
      // Handle errors, retry logic, etc.
      await this.handleError(error, sessionId, to, message);
    }
  }
}
```

## Monitoring & Observability

### Key Metrics to Track

1. **Session Metrics**
   - Active sessions count
   - Session connection rate
   - QR code scan success rate
   - Session uptime

2. **Message Metrics**
   - Messages sent/received per minute
   - Message delivery success rate
   - Message types distribution
   - Average response time

3. **System Metrics**
   - API response times
   - Webhook delivery success rate
   - Error rates by endpoint
   - Resource utilization

### Example Monitoring Stack

```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    
  loki:
    image: grafana/loki
    
  promtail:
    image: grafana/promtail
    volumes:
      - /var/log:/var/log
      - ./promtail.yml:/etc/promtail/config.yml
```

## Troubleshooting Guide

### Common Issues

1. **Session Won't Connect**
   - Check network connectivity
   - Verify WhatsApp account is active
   - Check for rate limiting

2. **Messages Not Sending**
   - Verify session is connected
   - Check recipient number format
   - Validate message content

3. **Webhook Not Receiving Events**
   - Check WEBHOOK_URL configuration
   - Verify webhook endpoint is accessible
   - Check for SSL certificate issues

### Debug Mode

Enable detailed logging:
```bash
docker run -e LOG_LEVEL=debug tonylampada/zapw:latest
```