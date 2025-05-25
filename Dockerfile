# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Baileys (chromium for puppeteer)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chromium. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files first (for better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Create directory for session data
RUN mkdir -p /app/sessions_data

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S zapw -u 1001

# Change ownership of app directory and sessions data
RUN chown -R zapw:nodejs /app
USER zapw

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]