export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';

export interface BaseMessage {
  to: string;  // Phone number or WhatsApp ID
  type: MessageType;
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  text: string;
}

export interface MediaMessage extends BaseMessage {
  type: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  mediaBase64?: string;
  caption?: string;
  fileName?: string;  // For documents
}

export interface LocationMessage extends BaseMessage {
  type: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactMessage extends BaseMessage {
  type: 'contact';
  contactName: string;
  contactNumber: string;
}

export type Message = TextMessage | MediaMessage | LocationMessage | ContactMessage;

export interface SendMessageRequest {
  to: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  mediaBase64?: string;
  caption?: string;
  fileName?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  contactName?: string;
  contactNumber?: string;
}

export interface SendMessageResponse {
  messageId: string;
  timestamp: number;
  status: 'sent' | 'failed';
}