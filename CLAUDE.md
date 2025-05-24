# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZAPW is a TypeScript-based HTTP service that exposes WhatsApp messaging capabilities through RESTful endpoints using the Baileys library. It supports multiple WhatsApp sessions (multi-device), QR code authentication, persistent sessions, and forwards all incoming events to a webhook URL.

## Architecture

The project follows clean architecture principles with three distinct layers:

1. **Surface Layer (Controllers)** - HTTP endpoints and request/response handling
2. **Service Layer** - Core business logic and orchestration
3. **Adapter Layer** - External integrations (Baileys, webhooks, persistence)

Key architectural principles:
- Separation of "plumbing" (infrastructure/IO) from "intelligence" (business logic)
- High cohesion, low coupling between modules
- Each module has a single clear responsibility

## Project Structure

```
zapw/
├── src/
│   ├── controllers/          # HTTP endpoints
│   │   ├── sessionsController.ts
│   │   └── messagesController.ts
│   ├── services/            # Business logic
│   │   ├── whatsappService.ts
│   │   └── sessionManager.ts
│   ├── adapters/           # External integrations
│   │   ├── whatsappAdapter.ts    # Baileys wrapper
│   │   ├── webhookAdapter.ts     # Webhook delivery
│   │   ├── persistenceAdapter.ts # Session storage
│   │   └── mediaAdapter.ts       # Media handling
│   ├── models/             # TypeScript interfaces
│   │   ├── Message.ts
│   │   ├── Session.ts
│   │   └── Event.ts
│   ├── utils/              # Helpers
│   │   ├── logger.ts
│   │   ├── config.ts
│   │   └── qrUtil.ts
│   └── index.ts           # Entry point
├── test/
│   ├── unit/
│   └── integration/
├── sessions_data/         # Session auth files (Docker volume)
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/
        └── ci-cd.yml
```

## Development Commands

### Initial Setup
```bash
npm install                 # Install dependencies
npm run build              # Compile TypeScript
npm run dev                # Run with hot reload (nodemon + ts-node)
```

### Testing
```bash
npm test                   # Run all tests
npm run test:unit         # Run unit tests only
npm run test:integration  # Run integration tests
npm run test:watch        # Run tests in watch mode
```

### Code Quality
```bash
npm run lint              # Run ESLint
npm run lint:fix         # Fix linting issues
npm run typecheck        # Run TypeScript type checking
npm run format           # Format code with Prettier
```

### Docker Operations
```bash
docker build -t zapw .    # Build Docker image
docker-compose up         # Run with docker-compose
```

## Key Implementation Details

### Session Management
- Each WhatsApp account corresponds to one Baileys socket instance
- Sessions are stored in `sessions_data/` directory as JSON files
- Session IDs can be auto-generated or client-provided
- Auth state persists using Baileys' `useSingleFileAuthState()`

### API Endpoints

**Session Management:**
- `POST /sessions` - Create new session (returns QR code)
- `GET /sessions` - List all active sessions
- `GET /sessions/{id}` - Get session details
- `DELETE /sessions/{id}` - Terminate session

**Messaging:**
- `POST /sessions/{id}/messages` - Send message (supports all types: text, image, video, audio, document, location, contact)
- `GET /sessions/{id}/media/{messageId}` - Retrieve media content

### Message Types
All message sending goes through a unified endpoint with a `type` field:
- `text`: Plain text message
- `image`: Image with optional caption
- `video`: Video with optional caption
- `audio`: Audio message
- `document`: File attachment with filename
- `location`: GPS coordinates
- `contact`: vCard data

### Webhook Events
All incoming events are forwarded to the configured `WEBHOOK_URL` with this structure:
```json
{
  "sessionId": "session123",
  "origin": "15551234567",
  "eventType": "message.received",
  "data": {
    "from": "15557654321",
    "to": "15551234567",
    "timestamp": 1681300000000,
    "type": "text",
    "text": "Hello",
    "messageId": "ABCD1234"
  }
}
```

### Environment Variables
- `PORT` - HTTP server port (default: 3000)
- `WEBHOOK_URL` - External webhook endpoint
- `ENABLE_WEBHOOK` - Enable/disable webhook forwarding
- `LOG_LEVEL` - Logging verbosity
- `MAX_RECONNECT_ATTEMPTS` - Auto-reconnection attempts
- `SESSIONS_DATA_PATH` - Path for session storage

### Error Handling
- HTTP 400 for client errors (invalid input, unknown session)
- HTTP 404 for not found resources
- HTTP 500 for server errors
- Baileys errors are caught and transformed into meaningful HTTP responses
- Automatic reconnection on temporary disconnects

### Testing Strategy
- Unit tests mock external dependencies (Baileys, HTTP clients)
- Integration tests use a full Express server instance
- Use Jest for test runner and assertions
- Supertest for HTTP endpoint testing
- Mock webhook receiver for integration tests

## Important Notes

1. **Multi-device Sessions**: Each WhatsApp number requires its own session and QR scan
2. **Persistence**: Session auth files must be preserved between restarts (use Docker volumes)
3. **Media Handling**: Large media files are not included in webhook payloads - use the media retrieval endpoint
4. **QR Code Display**: In development, QR codes are logged to console; production may return them in API response
5. **Security**: Add API authentication middleware for production use
6. **Scalability**: This service is designed for moderate number of sessions, not hundreds

## CI/CD Pipeline

GitHub Actions workflow (`ci-cd.yml`) performs:
1. On every push: Build and run tests
2. On merge to main: Build Docker image and push to Docker Hub
3. Tagged releases trigger production deployments

## Development Guidance

- Always commit and push frequently whenever you reach a good state
- Always keep a log of you tasks progress at spec/tasks. that should also be committed