import { MockWhatsAppClient } from '../../src/adapters/whatsappAdapter';

describe('WhatsAppAdapter', () => {
  describe('MockWhatsAppClient', () => {
    let client: MockWhatsAppClient;
    let qrReceived: string | null;
    let connectionInfo: any;
    let disconnectReason: any;

    beforeEach(() => {
      client = new MockWhatsAppClient('test-session');
      qrReceived = null;
      connectionInfo = null;
      disconnectReason = null;

      client.onQR((qr) => { qrReceived = qr; });
      client.onConnected((info) => { connectionInfo = info; });
      client.onDisconnected((reason) => { disconnectReason = reason; });
    });

    it('should emit QR code when connecting without auth', async () => {
      expect(client.getConnectionState()).toBe('closed');
      
      const connectPromise = client.connect();
      expect(client.getConnectionState()).toBe('connecting');
      
      // Wait for QR to be emitted
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(qrReceived).toBe('mock-qr-code-data-for-testing');
      
      await connectPromise;
    });

    it('should emit connected event when connection opens', async () => {
      await client.connect();
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      expect(client.getConnectionState()).toBe('open');
      expect(connectionInfo).toEqual({
        phoneNumber: '1234567890',
        name: 'Test User'
      });
    });

    it('should handle disconnection', async () => {
      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      await client.disconnect();
      
      expect(client.getConnectionState()).toBe('closed');
      expect(disconnectReason).toEqual({ reason: 'Manual disconnect' });
    });

    it('should track connection state correctly', async () => {
      expect(client.getConnectionState()).toBe('closed');
      
      client.connect();
      expect(client.getConnectionState()).toBe('connecting');
      
      await new Promise(resolve => setTimeout(resolve, 2100));
      expect(client.getConnectionState()).toBe('open');
      
      await client.disconnect();
      expect(client.getConnectionState()).toBe('closed');
    });
  });
});