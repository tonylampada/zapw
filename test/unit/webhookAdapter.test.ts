import { WebhookEvent } from '../../src/models/Event';

// Mock axios module
const mockPost = jest.fn();
jest.mock('axios', () => ({
  default: { post: mockPost },
  post: mockPost
}));

describe('WebhookAdapter', () => {
  let WebhookAdapter: any;
  let webhookAdapter: any;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('when webhook is enabled', () => {
    beforeEach(() => {
      process.env.WEBHOOK_URL = 'http://localhost:4000/webhook';
      process.env.ENABLE_WEBHOOK = 'true';
      process.env.WEBHOOK_RETRY_ATTEMPTS = '3';
      process.env.WEBHOOK_RETRY_DELAY = '100';
      
      // Import after setting env vars
      const module = require('../../src/adapters/webhookAdapter');
      WebhookAdapter = module.WebhookAdapter;
      webhookAdapter = new WebhookAdapter();
    });

    it('should send event to configured URL', async () => {
      mockPost.mockResolvedValueOnce({ data: { ok: true } });

      const event: WebhookEvent = {
        sessionId: 'session123',
        origin: '1234567890',
        eventType: 'message.received',
        timestamp: Date.now(),
        data: { test: 'data' }
      };

      await webhookAdapter.sendEvent(event);

      expect(mockPost).toHaveBeenCalledWith(
        'http://localhost:4000/webhook',
        event,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'message.received'
          },
          timeout: 10000
        }
      );
    });

    it('should retry on failure', async () => {
      mockPost
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ data: { ok: true } });

      const event: WebhookEvent = {
        sessionId: 'session123',
        origin: '1234567890',
        eventType: 'session.connected',
        timestamp: Date.now(),
        data: {}
      };

      await webhookAdapter.sendEvent(event);

      expect(mockPost).toHaveBeenCalledTimes(3);
    });

    it('should log error after all retry attempts fail', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPost.mockRejectedValue(new Error('Persistent error'));

      const event: WebhookEvent = {
        sessionId: 'session123',
        origin: '1234567890',
        eventType: 'message.sent',
        timestamp: Date.now(),
        data: {}
      };

      await webhookAdapter.sendEvent(event);

      expect(mockPost).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Webhook delivery failed after all attempts:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should include proper headers', async () => {
      mockPost.mockResolvedValueOnce({ data: { ok: true } });

      const event: WebhookEvent = {
        sessionId: 'session123',
        origin: '1234567890',
        eventType: 'message.delivered',
        timestamp: Date.now(),
        data: { messageId: 'msg123' }
      };

      await webhookAdapter.sendEvent(event);

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'message.delivered'
          })
        })
      );
    });
  });

  describe('when webhook is disabled', () => {
    beforeEach(() => {
      process.env.WEBHOOK_URL = 'http://localhost:4000/webhook';
      process.env.ENABLE_WEBHOOK = 'false';
      
      // Import after setting env vars
      const module = require('../../src/adapters/webhookAdapter');
      WebhookAdapter = module.WebhookAdapter;
      webhookAdapter = new WebhookAdapter();
    });

    it('should not send webhooks when disabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const event: WebhookEvent = {
        sessionId: 'session123',
        origin: '1234567890',
        eventType: 'message.received',
        timestamp: Date.now(),
        data: {}
      };

      await webhookAdapter.sendEvent(event);

      expect(mockPost).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Webhook disabled or URL not configured');

      consoleSpy.mockRestore();
    });
  });

  describe('when webhook URL is not configured', () => {
    beforeEach(() => {
      process.env.WEBHOOK_URL = '';
      process.env.ENABLE_WEBHOOK = 'true';
      
      // Import after setting env vars
      const module = require('../../src/adapters/webhookAdapter');
      WebhookAdapter = module.WebhookAdapter;
      webhookAdapter = new WebhookAdapter();
    });

    it('should not send webhooks without URL', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const event: WebhookEvent = {
        sessionId: 'session123',
        origin: '1234567890',
        eventType: 'session.disconnected',
        timestamp: Date.now(),
        data: { reason: 'Network error' }
      };

      await webhookAdapter.sendEvent(event);

      expect(mockPost).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Webhook disabled or URL not configured');

      consoleSpy.mockRestore();
    });
  });
});