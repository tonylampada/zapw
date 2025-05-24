export interface WebhookEvent {
  sessionId: string;
  origin: string;  // Phone number of the WhatsApp account
  eventType: 'message.received' | 'message.sent' | 'message.delivered' | 'message.read' | 'session.connected' | 'session.disconnected';
  timestamp: number;
  data: any;
}

export interface MessageReceivedEvent extends WebhookEvent {
  eventType: 'message.received';
  data: {
    from: string;
    to: string;
    messageId: string;
    timestamp: number;
    type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';
    text?: string;
    caption?: string;
    mediaType?: string;
    fileName?: string;
    hasMedia?: boolean;
    location?: {
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };
    contact?: {
      name: string;
      number: string;
    };
    isGroup: boolean;
    groupId?: string;
    groupName?: string;
  };
}