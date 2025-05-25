# Docker Hub Description for tonylampada/zapw

## Short Description (100 char limit)
WhatsApp API service with multi-session support, QR authentication, webhooks & full media capabilities

## Full Description

# ZAPW - WhatsApp API Service

Production-ready WhatsApp API service built with TypeScript, Baileys library, and Express.js. Provides a clean REST API for WhatsApp automation with enterprise-grade features.

## 🚀 Features

- **Multi-session Support** - Manage multiple WhatsApp accounts simultaneously
- **QR Code Authentication** - Easy setup with base64 PNG QR codes
- **Session Persistence** - Sessions survive container restarts
- **Real-time Webhooks** - Receive all WhatsApp events instantly
- **Rich Media Support** - Send/receive images, videos, audio, documents, locations, and contacts
- **Auto-reconnection** - Handles disconnections gracefully
- **Health Checks** - Built-in health monitoring
- **TypeScript** - Fully typed for reliability

## 📦 Quick Start

```bash
docker run -d \
  --name zapw \
  -p 3000:3000 \
  -v zapw-sessions:/app/sessions_data \
  -e WEBHOOK_URL=https://your-webhook.com/webhook \
  tonylampada/zapw:latest
```

## 🐳 Docker Compose

```yaml
version: '3.8'
services:
  zapw:
    image: tonylampada/zapw:latest
    ports:
      - "3000:3000"
    volumes:
      - zapw-sessions:/app/sessions_data
    environment:
      - WEBHOOK_URL=https://your-webhook.com/webhook
      - LOG_LEVEL=info
    restart: unless-stopped

volumes:
  zapw-sessions:
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3000` |
| `WEBHOOK_URL` | Webhook endpoint for events | - |
| `ENABLE_WEBHOOK` | Enable/disable webhooks | `true` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `MAX_RECONNECT_ATTEMPTS` | Reconnection attempts | `3` |
| `SESSIONS_DATA_PATH` | Session storage path | `/app/sessions_data` |

## 📡 API Endpoints

### Session Management
- `POST /sessions` - Create session (returns QR code)
- `GET /sessions` - List all sessions
- `GET /sessions/:id` - Get session details
- `DELETE /sessions/:id` - Terminate session

### Messaging
- `POST /sessions/:id/messages` - Send message
- `GET /sessions/:id/media/:messageId` - Retrieve media

### Health
- `GET /health` - Service health check

## 💬 Sending Messages

```bash
# Text message
curl -X POST http://localhost:3000/sessions/{id}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999@s.whatsapp.net",
    "type": "text",
    "text": "Hello from ZAPW!"
  }'

# Image with caption
curl -X POST http://localhost:3000/sessions/{id}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999@s.whatsapp.net",
    "type": "image",
    "mediaBase64": "data:image/png;base64,iVBORw0...",
    "caption": "Check this out!"
  }'
```

## 🔄 Webhook Events

Configure `WEBHOOK_URL` to receive events:

```json
{
  "sessionId": "abc123",
  "origin": "5511999999999",
  "eventType": "message.received",
  "data": {
    "from": "5511888888888@s.whatsapp.net",
    "type": "text",
    "text": "Hello!",
    "messageId": "ABC123"
  }
}
```

## 📂 Volume Mount

Mount `/app/sessions_data` to persist WhatsApp sessions between container restarts:

```bash
-v zapw-sessions:/app/sessions_data
```

## 🏷️ Tags

- `latest` - Most recent stable version
- `1.0.0` - Initial production release

## 📚 Documentation

- **GitHub Repository**: https://github.com/tonylampada/zapw
- **API Documentation**: https://github.com/tonylampada/zapw/blob/master/docs.md
- **Usage Examples**: https://github.com/tonylampada/zapw#quick-start

## 🐛 Support

Report issues at: https://github.com/tonylampada/zapw/issues

## 📄 License

MIT License

---

Built with ❤️ using TypeScript, Express.js, and Baileys