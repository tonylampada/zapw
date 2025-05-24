import { validateSendMessageRequest } from '../../src/utils/messageValidator';
import { SendMessageRequest } from '../../src/models/Message';

describe('Message Validator', () => {
  describe('validateSendMessageRequest', () => {
    it('should validate text message', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'text',
        text: 'Hello World'
      };
      
      const result = validateSendMessageRequest(req);
      
      expect(result.type).toBe('text');
      expect(result.to).toBe('1234567890');
      expect((result as any).text).toBe('Hello World');
    });

    it('should validate media message with URL', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'image',
        mediaUrl: 'https://example.com/image.jpg',
        caption: 'Test image'
      };
      
      const result = validateSendMessageRequest(req);
      
      expect(result.type).toBe('image');
      expect((result as any).mediaUrl).toBe('https://example.com/image.jpg');
      expect((result as any).caption).toBe('Test image');
    });

    it('should validate media message with base64', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'video',
        mediaBase64: 'base64data',
        caption: 'Test video'
      };
      
      const result = validateSendMessageRequest(req);
      
      expect(result.type).toBe('video');
      expect((result as any).mediaBase64).toBe('base64data');
    });

    it('should validate document message with filename', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'document',
        mediaUrl: 'https://example.com/doc.pdf',
        fileName: 'document.pdf'
      };
      
      const result = validateSendMessageRequest(req);
      
      expect(result.type).toBe('document');
      expect((result as any).fileName).toBe('document.pdf');
    });

    it('should validate location message', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'location',
        latitude: 40.7128,
        longitude: -74.0060,
        name: 'New York City',
        address: 'NYC, USA'
      };
      
      const result = validateSendMessageRequest(req);
      
      expect(result.type).toBe('location');
      expect((result as any).latitude).toBe(40.7128);
      expect((result as any).longitude).toBe(-74.0060);
    });

    it('should validate contact message', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'contact',
        contactName: 'John Doe',
        contactNumber: '+1234567890'
      };
      
      const result = validateSendMessageRequest(req);
      
      expect(result.type).toBe('contact');
      expect((result as any).contactName).toBe('John Doe');
      expect((result as any).contactNumber).toBe('+1234567890');
    });

    it('should reject message without recipient', () => {
      const req: any = {
        type: 'text',
        text: 'Hello'
      };
      
      expect(() => validateSendMessageRequest(req))
        .toThrow('Recipient "to" is required');
    });

    it('should reject message without type', () => {
      const req: any = {
        to: '1234567890',
        text: 'Hello'
      };
      
      expect(() => validateSendMessageRequest(req))
        .toThrow('Message type is required');
    });

    it('should reject text message without text', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'text'
      };
      
      expect(() => validateSendMessageRequest(req))
        .toThrow('Text is required for text messages');
    });

    it('should reject media message without content', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'image'
      };
      
      expect(() => validateSendMessageRequest(req))
        .toThrow('Media URL or base64 is required');
    });

    it('should reject document without filename', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'document',
        mediaUrl: 'https://example.com/doc.pdf'
      };
      
      expect(() => validateSendMessageRequest(req))
        .toThrow('File name is required for documents');
    });

    it('should reject location without coordinates', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'location'
      };
      
      expect(() => validateSendMessageRequest(req))
        .toThrow('Latitude and longitude are required for location messages');
    });

    it('should reject contact without required fields', () => {
      const req: SendMessageRequest = {
        to: '1234567890',
        type: 'contact',
        contactName: 'John'
      };
      
      expect(() => validateSendMessageRequest(req))
        .toThrow('Contact name and number are required for contact messages');
    });

    it('should reject unknown message type', () => {
      const req: any = {
        to: '1234567890',
        type: 'unknown'
      };
      
      expect(() => validateSendMessageRequest(req))
        .toThrow('Unknown message type: unknown');
    });
  });
});