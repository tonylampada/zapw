import request from 'supertest';
import express from 'express';

describe('Webhook Integration', () => {
  let app: express.Application;
  let webhookServer: any;
  let webhookReceived: any[] = [];
  const webhookPort = 4567;
  let sessionManager: any;
  let whatsappService: any;
  let MockWhatsAppClient: any;
  
  beforeAll((done) => {
    // Set up environment for testing
    process.env.USE_MOCK_WHATSAPP = 'true';
    process.env.NODE_ENV = 'test';
    
    // Clear any existing modules
    jest.resetModules();
    
    // Start a test webhook server
    webhookServer = express();
    webhookServer.use(express.json());
    webhookServer.post('/webhook', (req: any, res: any) => {
      webhookReceived.push(req.body);
      res.json({ ok: true });
    });
    const server = webhookServer.listen(webhookPort, done);
    webhookServer._server = server; // Store server reference
    
    // Import modules after setting env vars
    const { createApp } = require('../../src/app');
    sessionManager = require('../../src/services/sessionManager').sessionManager;
    whatsappService = require('../../src/services/whatsappService').whatsappService;
    MockWhatsAppClient = require('../../src/adapters/whatsappAdapter').MockWhatsAppClient;
    
    app = createApp();
  });
  
  afterAll((done) => {
    if (webhookServer._server) {
      webhookServer._server.close(done);
    } else {
      done();
    }
  });
  
  beforeEach(() => {
    webhookReceived = [];
    process.env.WEBHOOK_URL = `http://localhost:${webhookPort}/webhook`;
    process.env.ENABLE_WEBHOOK = 'true';
    
    // Clear any existing sessions
    sessionManager['sessions'].clear();
  });
  
  describe('incoming message webhooks', () => {
    it('should forward incoming message to webhook', async () => {
      // Create and initialize a session
      const sessionData = { name: 'Test Session' };
      const createResponse = await request(app)
        .post('/sessions')
        .send(sessionData)
        .expect(201);
      
      const sessionId = createResponse.body.sessionId;
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Get the mock client and simulate incoming message
      const client = whatsappService.getClient(sessionId) as any;
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(MockWhatsAppClient);
      
      const incomingMessage = {
        from: '15551234567',
        to: '1234567890',
        messageId: 'MSG123',
        timestamp: Date.now(),
        type: 'text',
        text: 'Hello from WhatsApp!',
        isGroup: false
      };
      
      client.simulateIncomingMessage(incomingMessage);
      
      // Wait for webhook to be delivered
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify webhook was received
      expect(webhookReceived.length).toBeGreaterThanOrEqual(2); // Connected event + message event
      
      const messageEvent = webhookReceived.find(e => e.eventType === 'message.received');
      expect(messageEvent).toBeDefined();
      expect(messageEvent.sessionId).toBe(sessionId);
      expect(messageEvent.eventType).toBe('message.received');
      expect(messageEvent.data).toMatchObject(incomingMessage);
    });
    
    it('should include session info in webhook payload', async () => {
      // Create and initialize a session
      const createResponse = await request(app)
        .post('/sessions')
        .send({ name: 'Test Session' })
        .expect(201);
      
      const sessionId = createResponse.body.sessionId;
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Check connected event
      const connectedEvent = webhookReceived.find(e => e.eventType === 'session.connected');
      expect(connectedEvent).toBeDefined();
      expect(connectedEvent.sessionId).toBe(sessionId);
      expect(connectedEvent.origin).toBe('1234567890');
      expect(connectedEvent.data).toMatchObject({
        phoneNumber: '1234567890',
        name: 'Test User'
      });
    });
    
    it('should forward different message types correctly', async () => {
      // Create and initialize a session
      const createResponse = await request(app)
        .post('/sessions')
        .send({ name: 'Test Session' })
        .expect(201);
      
      const sessionId = createResponse.body.sessionId;
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const client = whatsappService.getClient(sessionId) as any;
      
      // Test different message types
      const messageTypes = [
        {
          type: 'image',
          caption: 'Check this out!',
          hasMedia: true
        },
        {
          type: 'location',
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            name: 'San Francisco'
          }
        },
        {
          type: 'contact',
          contact: {
            name: 'John Doe',
            number: '+1234567890'
          }
        }
      ];
      
      for (const msgData of messageTypes) {
        webhookReceived = [];
        
        const message = {
          from: '15551234567',
          to: '1234567890',
          messageId: `MSG-${msgData.type}`,
          timestamp: Date.now(),
          isGroup: false,
          ...msgData
        };
        
        client.simulateIncomingMessage(message);
        
        // Wait for webhook
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const event = webhookReceived.find(e => e.eventType === 'message.received');
        expect(event).toBeDefined();
        expect(event.data.type).toBe(msgData.type);
      }
    });
  });
  
  describe('webhook retry mechanism', () => {
    it('should retry failed webhook deliveries', async () => {
      // Temporarily close webhook server to simulate failure
      if (webhookServer._server) {
        await new Promise((resolve) => webhookServer._server.close(resolve));
      }
      
      process.env.WEBHOOK_RETRY_ATTEMPTS = '2';
      process.env.WEBHOOK_RETRY_DELAY = '50';
      
      // Create session
      await request(app)
        .post('/sessions')
        .send({ name: 'Test Session' })
        .expect(201);
      
      // Restart webhook server after a delay
      setTimeout(() => {
        webhookServer = express();
        webhookServer.use(express.json());
        webhookServer.post('/webhook', (req: any, res: any) => {
          webhookReceived.push(req.body);
          res.json({ ok: true });
        });
        const server = webhookServer.listen(webhookPort);
        webhookServer._server = server;
      }, 100);
      
      // Wait for connection and retry attempts
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify at least one webhook was eventually delivered
      const connectedEvents = webhookReceived.filter(e => e.eventType === 'session.connected');
      expect(connectedEvents.length).toBeGreaterThan(0);
    });
  });
  
  describe('webhook configuration', () => {
    it('should not send webhooks when disabled', async () => {
      process.env.ENABLE_WEBHOOK = 'false';
      webhookReceived = [];
      
      // Create and initialize a session
      await request(app)
        .post('/sessions')
        .send({ name: 'Test Session' })
        .expect(201);
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Verify no webhooks were sent
      expect(webhookReceived.length).toBe(0);
    });
  });
});