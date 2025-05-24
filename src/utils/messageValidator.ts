import { 
  Message, 
  SendMessageRequest, 
  TextMessage, 
  MediaMessage, 
  LocationMessage, 
  ContactMessage 
} from '../models/Message';

export function validateSendMessageRequest(req: SendMessageRequest): Message {
  if (!req.to) {
    throw new Error('Recipient "to" is required');
  }
  if (!req.type) {
    throw new Error('Message type is required');
  }
  
  switch (req.type) {
    case 'text':
      if (!req.text) {
        throw new Error('Text is required for text messages');
      }
      return {
        to: req.to,
        type: 'text',
        text: req.text
      } as TextMessage;
      
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
      if (!req.mediaUrl && !req.mediaBase64) {
        throw new Error('Media URL or base64 is required');
      }
      if (req.type === 'document' && !req.fileName) {
        throw new Error('File name is required for documents');
      }
      return {
        to: req.to,
        type: req.type,
        mediaUrl: req.mediaUrl,
        mediaBase64: req.mediaBase64,
        caption: req.caption,
        fileName: req.fileName
      } as MediaMessage;
      
    case 'location':
      if (req.latitude === undefined || req.longitude === undefined) {
        throw new Error('Latitude and longitude are required for location messages');
      }
      return {
        to: req.to,
        type: 'location',
        latitude: req.latitude,
        longitude: req.longitude,
        name: req.name,
        address: req.address
      } as LocationMessage;
      
    case 'contact':
      if (!req.contactName || !req.contactNumber) {
        throw new Error('Contact name and number are required for contact messages');
      }
      return {
        to: req.to,
        type: 'contact',
        contactName: req.contactName,
        contactNumber: req.contactNumber
      } as ContactMessage;
      
    default:
      throw new Error(`Unknown message type: ${req.type}`);
  }
}