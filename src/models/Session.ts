export interface Session {
  id: string;
  status: 'initializing' | 'qr_waiting' | 'connected' | 'disconnected';
  phoneNumber?: string;
  name?: string;
  createdAt: Date;
  connectedAt?: Date;
  qrCode?: string;
}