// Generic API response wrapper
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
}

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