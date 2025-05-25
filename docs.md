# ZAPW API Documentation

ZAPW is a WhatsApp API service that provides RESTful endpoints for managing WhatsApp sessions and sending/receiving messages through the Baileys library.

## Usage Flow

The typical workflow for using ZAPW:

1. **Create a Session** - POST to `/sessions` to initialize a new WhatsApp connection
2. **Scan QR Code** - The response includes a QR code image (base64 PNG) that must be scanned with WhatsApp mobile app
3. **Monitor Session Status** - Poll `/sessions/{id}` to check when status changes from `qr_waiting` to `connected`
4. **Configure Webhook** - Set `WEBHOOK_URL` environment variable to receive all incoming events (messages, status changes, etc.)
5. **Send Messages** - Once connected, use `/sessions/{id}/messages` to send text, images, audio, video, documents, locations, or contacts
6. **Handle Incoming Events** - Your webhook endpoint will receive all WhatsApp events in real-time

### Quick Example

```bash
# 1. Create session (with optional API key)
curl -X POST http://localhost:3000/sessions \
  -H "Authorization: Bearer your-api-key"

# 2. Response includes QR code to scan
{
  "status": "success",
  "data": {
    "id": "abc123",
    "status": "qr_waiting",
    "qrCode": "data:image/png;base64,iVBORw0...",
    "qrExpiresAt": "2025-05-25T12:00:00.000Z"
  }
}

# 3. Check connection status
curl http://localhost:3000/sessions/abc123 \
  -H "Authorization: Bearer your-api-key"

# 4. Send a message (after connected)
curl -X POST http://localhost:3000/sessions/abc123/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "to": "5511999999999@s.whatsapp.net",
    "type": "text",
    "text": "Hello from ZAPW!"
  }'
```

## Base URL

```
http://localhost:3000
```

## Authentication

API authentication is optional but recommended for production use.

### Configuration

Set the `API_KEY` environment variable to enable authentication:
```bash
API_KEY=your-secret-api-key-here
```

### Usage

When `API_KEY` is configured, include it in your requests using one of these methods:

1. **Authorization Header** (recommended):
```bash
curl -H "Authorization: Bearer your-secret-api-key-here" \
  http://localhost:3000/sessions
```

2. **X-API-Key Header**:
```bash
curl -H "X-API-Key: your-secret-api-key-here" \
  http://localhost:3000/sessions
```

### Excluded Endpoints

The following endpoints do not require authentication:
- `GET /health` - Health check
- `GET /` - Service info/homepage

### Error Response

Requests without a valid API key will receive:
```json
{
  "error": "Unauthorized",
  "message": "API key is required"
}
```

## Response Format

All responses follow a consistent JSON format:

```json
{
  "status": "success|error",
  "data": {},
  "error": "error message (if applicable)"
}
```

## Error Handling

Standard HTTP status codes are used:
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

---

# Health Check

## GET /health

Check service health status.

### Response

```json
{
  "status": "ok",
  "timestamp": "2025-05-25T00:00:00.000Z",
  "service": "zapw",
  "uptime": 123.456
}
```

---

# Session Management

## POST /sessions

Create a new WhatsApp session. This endpoint blocks until a QR code is generated (up to 30 seconds).

### Request Body

```json
{
  "sessionId": "my-session-123" // Optional: auto-generated if not provided
}
```

### Response (201)

```json
{
  "status": "success",
  "data": {
    "id": "my-session-123",
    "status": "qr_waiting",
    "createdAt": "2025-05-25T00:00:00.000Z",
    "qrCode": "2@abc123...",
    "qrExpiresAt": "2025-05-25T00:01:00.000Z"
  }
}
```

### Example

```bash
# Create session with auto-generated ID
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{}'

# Create session with custom ID
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-whatsapp-bot"}'
```

**Note**: The QR code is returned immediately and expires after 60 seconds. Use `GET /sessions/{id}` to refresh expired QR codes.

## GET /sessions

List all active sessions.

### Response (200)

```json
{
  "status": "success",
  "data": [
    {
      "id": "session-1",
      "status": "connected",
      "createdAt": "2025-05-25T00:00:00.000Z",
      "phoneNumber": "1234567890",
      "connectedAt": "2025-05-25T00:01:30.000Z"
    },
    {
      "id": "session-2", 
      "status": "qr_waiting",
      "createdAt": "2025-05-25T00:01:00.000Z",
      "qrCode": "2@abc123...",
      "qrExpiresAt": "2025-05-25T00:02:00.000Z"
    }
  ]
}
```

### Session Status Values

- `initializing` - Session being created
- `connecting` - Attempting to connect
- `qr_waiting` - Waiting for QR code scan
- `connected` - Active and ready
- `disconnected` - Offline or failed

## GET /sessions/:sessionId

Get details for a specific session. If the session has an expired QR code, this endpoint automatically refreshes it.

### Response (200)

```json
{
  "status": "success",
  "data": {
    "id": "my-session-123",
    "status": "connected",
    "createdAt": "2025-05-25T00:00:00.000Z",
    "phoneNumber": "1234567890",
    "name": "My WhatsApp Account",
    "connectedAt": "2025-05-25T00:01:30.000Z"
  }
}
```

**QR Code Refresh**: When status is `qr_waiting` and `qrExpiresAt` is in the past, the endpoint automatically generates a fresh QR code:

```json
{
  "status": "success",
  "data": {
    "id": "my-session-123",
    "status": "qr_waiting",
    "createdAt": "2025-05-25T00:00:00.000Z",
    "qrCode": "2@newQrCode...",
    "qrExpiresAt": "2025-05-25T00:03:00.000Z"
  }
}
```

### Response (404)

```json
{
  "error": "Session not found",
  "message": "Session with ID 'invalid-session' does not exist"
}
```

## DELETE /sessions/:sessionId

Terminate and delete a session.

### Response (204)

No content - session successfully deleted.

### Response (404)

```json
{
  "error": "Session not found",
  "message": "Session with ID 'invalid-session' does not exist"
}
```

---

# Message Sending

## POST /sessions/:sessionId/messages

Send a message through the specified session.

### Common Request Headers

```
Content-Type: application/json
```

### Message Types

All messages require a `type` field and a `to` field (recipient phone number).

#### Phone Number Format

Use international format without `+` or spaces:
- ✅ `1234567890` 
- ✅ `551234567890`
- ❌ `+55 12 34567890`
- ❌ `(55) 12 34567890`

---

## Text Messages

### Request Body

```json
{
  "type": "text",
  "to": "1234567890",
  "text": "Hello from ZAPW! 👋"
}
```

### Example

```bash
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "to": "1234567890", 
    "text": "Hello! This is a test message from my bot."
  }'
```

### Response (200)

```json
{
  "messageId": "ABCD1234567890",
  "status": "sent",
  "timestamp": "2025-05-25T00:00:00.000Z"
}
```

---

## Image Messages

Send images with optional captions.

### Base64 Method

```json
{
  "type": "image",
  "to": "1234567890",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
  "caption": "Check out this image! 📸"
}
```

### URL Method

```json
{
  "type": "image", 
  "to": "1234567890",
  "image": "https://example.com/image.jpg",
  "caption": "Image from URL"
}
```

### Example

```bash
# Send image from URL
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "to": "1234567890",
    "image": "https://picsum.photos/800/600",
    "caption": "Random beautiful image! 🖼️"
  }'

# Send base64 image
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "to": "1234567890",
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    "caption": "Small test image"
  }'
```

---

## Audio Messages

Send audio files (supports MP3, AAC, OGG, WAV).

### Base64 Method

```json
{
  "type": "audio",
  "to": "1234567890", 
  "audio": "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAA..."
}
```

### URL Method

```json
{
  "type": "audio",
  "to": "1234567890",
  "audio": "https://example.com/audio.mp3"
}
```

### Example

```bash
# Send audio from URL
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "audio",
    "to": "1234567890",
    "audio": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
  }'

# Send base64 audio
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "audio", 
    "to": "1234567890",
    "audio": "data:audio/mp3;base64,AUDIO_BASE64_DATA_HERE"
  }'
```

---

## Video Messages

Send video files with optional captions.

### Request Body

```json
{
  "type": "video",
  "to": "1234567890",
  "video": "https://example.com/video.mp4",
  "caption": "Check out this video! 🎥"
}
```

### Example

```bash
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "video",
    "to": "1234567890", 
    "video": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
    "caption": "Sample video from our service 🎬"
  }'
```

---

## Document Messages

Send documents (PDF, DOC, XLS, etc.) with filenames.

### Request Body

```json
{
  "type": "document",
  "to": "1234567890",
  "document": "data:application/pdf;base64,JVBERi0xLjQKJeL...",
  "filename": "invoice-2025.pdf"
}
```

### Example

```bash
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "document",
    "to": "1234567890",
    "document": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "filename": "sample-document.pdf"
  }'
```

---

## Location Messages

Send GPS coordinates with optional details.

### Request Body

```json
{
  "type": "location",
  "to": "1234567890",
  "latitude": -23.5505199,
  "longitude": -46.6333094,
  "name": "São Paulo Cathedral",
  "address": "Praça da Sé, São Paulo, Brazil"
}
```

### Example

```bash
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "location",
    "to": "1234567890",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "name": "San Francisco",
    "address": "San Francisco, CA, USA"
  }'
```

---

## Contact Messages

Send contact information as vCard.

### Request Body

```json
{
  "type": "contact",
  "to": "1234567890",
  "contactName": "John Doe",
  "contactNumber": "9876543210",
  "organization": "ACME Corp",
  "email": "john@acme.com"
}
```

### Example

```bash
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "contact",
    "to": "1234567890",
    "contactName": "Support Team",
    "contactNumber": "5551234567",
    "organization": "ZAPW Support",
    "email": "support@zapw.com"
  }'
```

---

# Media Retrieval

## GET /sessions/:sessionId/media/:messageId

Retrieve media content from received messages.

### Response

Returns the media file with appropriate `Content-Type` header.

### Example

```bash
# Download received image
curl -o received_image.jpg \
  http://localhost:3000/sessions/my-session/media/MESSAGE_ID_HERE

# Download received audio
curl -o received_audio.mp3 \
  http://localhost:3000/sessions/my-session/media/AUDIO_MESSAGE_ID
```

---

# Webhook Events

Configure `WEBHOOK_URL` environment variable to receive real-time events.

## Event Types

- `message.received` - Incoming message
- `message.sent` - Message sent successfully
- `message.delivered` - Message delivered to recipient
- `message.read` - Message read by recipient
- `session.connected` - Session connected to WhatsApp
- `session.disconnected` - Session disconnected

## Event Payload

```json
{
  "sessionId": "my-session-123",
  "origin": "1234567890",
  "eventType": "message.received",
  "timestamp": 1681300000000,
  "data": {
    "from": "9876543210",
    "to": "1234567890", 
    "messageId": "ABCD1234567890",
    "type": "text",
    "text": "Hello there!",
    "timestamp": 1681300000000,
    "isGroup": false
  }
}
```

## Incoming Message Examples

### Text Message

```json
{
  "sessionId": "my-session-123",
  "origin": "1234567890",
  "eventType": "message.received", 
  "timestamp": 1681300000000,
  "data": {
    "from": "9876543210",
    "to": "1234567890",
    "messageId": "ABCD1234567890", 
    "type": "text",
    "text": "Hi! How can I help you today?",
    "timestamp": 1681300000000,
    "isGroup": false
  }
}
```

### Image Message

```json
{
  "sessionId": "my-session-123",
  "origin": "1234567890",
  "eventType": "message.received",
  "timestamp": 1681300000000,
  "data": {
    "from": "9876543210",
    "to": "1234567890",
    "messageId": "IMG_1234567890",
    "type": "image",
    "caption": "Check this out!",
    "mediaUrl": "/sessions/my-session-123/media/IMG_1234567890",
    "timestamp": 1681300000000,
    "isGroup": false
  }
}
```

### Audio Message

```json
{
  "sessionId": "my-session-123", 
  "origin": "1234567890",
  "eventType": "message.received",
  "timestamp": 1681300000000,
  "data": {
    "from": "9876543210",
    "to": "1234567890",
    "messageId": "AUD_1234567890",
    "type": "audio",
    "duration": 15,
    "mediaUrl": "/sessions/my-session-123/media/AUD_1234567890",
    "timestamp": 1681300000000,
    "isGroup": false
  }
}
```

### Location Message

```json
{
  "sessionId": "my-session-123",
  "origin": "1234567890", 
  "eventType": "message.received",
  "timestamp": 1681300000000,
  "data": {
    "from": "9876543210",
    "to": "1234567890",
    "messageId": "LOC_1234567890",
    "type": "location",
    "latitude": -23.5505199,
    "longitude": -46.6333094,
    "name": "São Paulo Cathedral",
    "address": "Praça da Sé, São Paulo, Brazil",
    "timestamp": 1681300000000,
    "isGroup": false
  }
}
```

## Session Events

### Connection Established

```json
{
  "sessionId": "my-session-123",
  "origin": "1234567890",
  "eventType": "session.connected",
  "timestamp": 1681300000000,
  "data": {
    "phoneNumber": "1234567890",
    "name": "My WhatsApp Account"
  }
}
```

### Connection Lost

```json
{
  "sessionId": "my-session-123",
  "origin": "1234567890", 
  "eventType": "session.disconnected",
  "timestamp": 1681300000000,
  "data": {
    "reason": "connection_lost",
    "lastSeen": 1681299900000
  }
}
```

---

# Complete Examples

## Bot Conversation Flow

```bash
# 1. Create session
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "customer-service-bot"}')

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.id')
echo "Created session: $SESSION_ID"

# 2. Wait for connection (monitor logs for QR code)
sleep 10

# 3. Send welcome message
curl -X POST http://localhost:3000/sessions/$SESSION_ID/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "to": "1234567890",
    "text": "Welcome to our customer service! How can I help you today? 😊"
  }'

# 4. Send menu with location
curl -X POST http://localhost:3000/sessions/$SESSION_ID/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "location",
    "to": "1234567890", 
    "latitude": 37.7749,
    "longitude": -122.4194,
    "name": "Our Store Location",
    "address": "123 Main St, San Francisco, CA"
  }'

# 5. Send product catalog image
curl -X POST http://localhost:3000/sessions/$SESSION_ID/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "to": "1234567890",
    "image": "https://example.com/catalog.jpg",
    "caption": "Here'\''s our latest product catalog! 📋"
  }'
```

## Media Handling Workflow

```bash
# 1. Set up webhook endpoint to receive media
# Your webhook should handle POST requests like:
# POST https://yourserver.com/webhook
# {
#   "sessionId": "my-session",
#   "eventType": "message.received",
#   "data": {
#     "type": "image",
#     "mediaUrl": "/sessions/my-session/media/IMG_123456"
#   }
# }

# 2. When you receive a media webhook, download the media:
curl -o received_media.jpg \
  http://localhost:3000/sessions/my-session/media/IMG_123456

# 3. Process and respond
curl -X POST http://localhost:3000/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "to": "9876543210",
    "text": "Thanks for the image! I'\''ve received it and it'\''s being processed. ✅"
  }'
```

---

# Error Responses

## Invalid Session

```json
{
  "error": "Session not found",
  "message": "Session with ID 'invalid-session' does not exist",
  "code": "SESSION_NOT_FOUND"
}
```

## Invalid Message Format

```json
{
  "error": "Validation failed",
  "message": "Missing required field: to",
  "code": "VALIDATION_ERROR"
}
```

## Session Not Connected

```json
{
  "error": "Session not ready", 
  "message": "Session 'my-session' is not connected to WhatsApp",
  "code": "SESSION_NOT_CONNECTED"
}
```

## Media Processing Error

```json
{
  "error": "Media processing failed",
  "message": "Could not process media from URL", 
  "code": "MEDIA_ERROR"
}
```

---

# Rate Limits & Best Practices

## Rate Limiting

- **WhatsApp limits**: ~1000 messages per day for new accounts
- **Recommended**: 1 message per second maximum
- **Burst limit**: Max 5 messages per 5 seconds

## Best Practices

### Message Formatting
- Keep text messages under 4096 characters
- Use international phone number format (no + or spaces)
- Include descriptive captions for media

### Media Guidelines
- **Images**: Max 16MB, JPEG/PNG recommended
- **Audio**: Max 16MB, MP3/AAC/OGG recommended  
- **Video**: Max 16MB, MP4 recommended
- **Documents**: Max 100MB, common formats

### Session Management
- Monitor session status regularly
- Implement automatic reconnection logic
- Handle QR code authentication flow
- Clean up disconnected sessions

### Error Handling
- Retry failed messages with exponential backoff
- Validate phone numbers before sending
- Handle webhook delivery failures gracefully
- Log all API interactions for debugging

### Security
- Use HTTPS in production
- Implement API key authentication
- Validate webhook signatures
- Sanitize incoming message content
- Rate limit per client/IP

---

# Environment Configuration

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Webhook Configuration  
WEBHOOK_URL=https://yourserver.com/webhook
ENABLE_WEBHOOK=true

# Session Management
MAX_RECONNECT_ATTEMPTS=3
SESSIONS_DATA_PATH=./sessions_data

# Logging
LOG_LEVEL=info
```

---

# Troubleshooting

## Common Issues

### Session Won't Connect
1. Check QR code in logs
2. Ensure phone number isn't already connected elsewhere
3. Try deleting and recreating session

### Messages Not Sending
1. Verify session status is "connected"
2. Check phone number format (international, no +)
3. Verify recipient number is valid WhatsApp account

### Webhook Not Receiving Events
1. Check WEBHOOK_URL environment variable
2. Verify webhook endpoint is accessible
3. Check webhook endpoint returns 200 OK
4. Review webhook adapter logs

### Media Downloads Failing
1. Check if message ID is valid
2. Verify session has permission to access media
3. Ensure media hasn't expired (WhatsApp 30-day limit)

### High Memory Usage
1. Clean up old session data regularly
2. Monitor sessions_data directory size
3. Restart service periodically in production
4. Implement session cleanup cron job

## Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug npm start
```

This will show:
- Detailed Baileys connection logs  
- Message processing steps
- Webhook delivery attempts
- Session state changes