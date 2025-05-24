// Request bodies
export interface CreateSessionRequest {
  sessionId?: string;
}

// Response bodies
export interface SessionResponse {
  id: string;
  status: string;
  phoneNumber?: string;
  name?: string;
  createdAt: string;
  connectedAt?: string;
  qrCode?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}