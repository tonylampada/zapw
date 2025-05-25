# ZAPW - WhatsApp API Service

A TypeScript-based HTTP service that exposes WhatsApp messaging capabilities through RESTful endpoints using the Baileys library. Supports multiple WhatsApp sessions, QR code authentication, persistent sessions, and forwards all incoming events to webhook URLs.

## Features

- 🔥 **Multi-session support** - Handle multiple WhatsApp accounts simultaneously
- 📱 **QR code authentication** - Easy session setup via QR scanning
- 💾 **Session persistence** - Sessions survive service restarts
- 🔄 **Webhook forwarding** - Real-time event delivery to external services
- 📎 **Rich messaging** - Support for text, images, videos, audio, documents, locations, and contacts
- 🛡️ **Type safety** - Full TypeScript implementation with strict typing
- 🧪 **Well tested** - Comprehensive unit and integration test suite

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd zapw
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Production

```bash
# Build the project
npm run build

# Start production server
npm start
```

## API Endpoints

### Session Management
- `POST /sessions` - Create new WhatsApp session (returns QR code)
- `GET /sessions` - List all active sessions  
- `GET /sessions/{id}` - Get session details
- `DELETE /sessions/{id}` - Terminate session

### Messaging
- `POST /sessions/{id}/messages` - Send message (all types supported)
- `GET /sessions/{id}/media/{messageId}` - Retrieve media content

### Health Check
- `GET /health` - Service health status

## Message Types

Send messages by specifying the `type` field:

```javascript
// Text message
{
  "type": "text",
  "text": "Hello World!"
}

// Image with caption
{
  "type": "image", 
  "image": "base64-encoded-image-data",
  "caption": "Check this out!"
}

// Location
{
  "type": "location",
  "latitude": 37.7749,
  "longitude": -122.4194
}

// Document
{
  "type": "document",
  "document": "base64-encoded-file-data", 
  "filename": "report.pdf"
}
```

## Webhook Events

Configure `WEBHOOK_URL` to receive real-time events:

```javascript
{
  "sessionId": "session123",
  "origin": "15551234567", 
  "eventType": "message.received",
  "timestamp": 1681300000000,
  "data": {
    "from": "15557654321",
    "type": "text",
    "text": "Hello!",
    "messageId": "ABCD1234"
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | 3000 |
| `WEBHOOK_URL` | External webhook endpoint | - |
| `ENABLE_WEBHOOK` | Enable webhook forwarding | true |
| `LOG_LEVEL` | Logging verbosity | info |
| `MAX_RECONNECT_ATTEMPTS` | Auto-reconnection attempts | 3 |
| `SESSIONS_DATA_PATH` | Session storage directory | ./sessions_data |

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch        # Watch mode for development

# Generate coverage report
npm test -- --coverage
```

## Architecture

The project follows clean architecture principles:

- **Controllers** (`src/controllers/`) - HTTP endpoints and request handling
- **Services** (`src/services/`) - Core business logic and orchestration  
- **Adapters** (`src/adapters/`) - External integrations (Baileys, webhooks, persistence)
- **Models** (`src/models/`) - TypeScript interfaces and data structures

## Development Commands

```bash
npm run dev          # Development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm run start        # Start production server
npm test             # Run test suite
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint code linting
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format code with Prettier
```

## Session Persistence

Sessions are automatically persisted to the `sessions_data/` directory:
- Session metadata stored in `sessions-metadata.json`
- WhatsApp auth data stored per session in separate files
- Sessions automatically restore on service restart

## Security Notes

- Add API authentication middleware for production use
- Store sensitive configuration in environment variables
- Consider rate limiting for public deployments
- Regularly rotate session auth data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the full test suite
5. Submit a pull request

## License

MIT License - see LICENSE file for details