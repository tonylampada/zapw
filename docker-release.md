# Docker Hub Release Instructions

## Prerequisites
1. Docker Hub account (username: `yourusername`)
2. Docker CLI logged in: `docker login`

## Build and Push Commands

```bash
# 1. Build the image with proper tags
docker build -t zapw:latest .
docker tag zapw:latest yourusername/zapw:latest
docker tag zapw:latest yourusername/zapw:1.0.0

# 2. Push to Docker Hub
docker push yourusername/zapw:latest
docker push yourusername/zapw:1.0.0
```

## Recommended Docker Hub Description

**Short Description:**
WhatsApp API service with multi-session support, QR authentication, webhooks, and full media capabilities.

**Full Description:**
```markdown
# ZAPW - WhatsApp API Service

A production-ready WhatsApp API service built with TypeScript and Baileys library.

## Features
- 🔥 Multi-session support
- 📱 QR code authentication  
- 💾 Persistent sessions
- 🔄 Webhook forwarding
- 📎 Full media support (images, videos, audio, documents)
- 🛡️ Type-safe with TypeScript

## Quick Start

```bash
docker run -d \
  -p 3000:3000 \
  -v zapw-sessions:/app/sessions_data \
  -e WEBHOOK_URL=https://your-webhook.com \
  yourusername/zapw:latest
```

## Environment Variables

- `PORT` - HTTP port (default: 3000)
- `WEBHOOK_URL` - Your webhook endpoint
- `ENABLE_WEBHOOK` - Enable/disable webhooks (default: true)
- `LOG_LEVEL` - Logging level (default: info)

## API Documentation

See full documentation at: https://github.com/yourusername/zapw

## Volume

Mount `/app/sessions_data` to persist WhatsApp sessions between restarts.
```

## Docker Compose Example

```yaml
version: '3.8'
services:
  zapw:
    image: yourusername/zapw:latest
    ports:
      - "3000:3000"
    volumes:
      - zapw-sessions:/app/sessions_data
    environment:
      - WEBHOOK_URL=https://your-webhook.com
      - LOG_LEVEL=info
    restart: unless-stopped

volumes:
  zapw-sessions:
```