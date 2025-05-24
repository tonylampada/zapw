export interface Session {
  id: string;
  status: 'initializing' | 'connecting' | 'qr_waiting' | 'connected' | 'disconnected';
  phoneNumber?: string;
  name?: string;
  createdAt: Date;
  connectedAt?: Date;
  qrCode?: string;
}