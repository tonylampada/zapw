import { Router, Request, Response } from 'express';
import { ApiResponse } from '../models/api';

interface StoredEvent {
  id: string;
  sessionId: string;
  eventType: string;
  timestamp: number;
  data: any;
}

// In-memory event storage (last 10 events)
let events: StoredEvent[] = [];
let eventIdCounter = 0;

// Store webhook event
export function storeWebhookEvent(sessionId: string, eventType: string, data: any): void {
  const event: StoredEvent = {
    id: `evt_${++eventIdCounter}`,
    sessionId,
    eventType,
    timestamp: Date.now(),
    data
  };
  
  // Add to beginning of array
  events.unshift(event);
  
  // Keep only last 10 events
  if (events.length > 10) {
    events = events.slice(0, 10);
  }
}

const router = Router();

// GET /events - Get last 10 events
router.get('/', (_req: Request, res: Response<ApiResponse<StoredEvent[]>>) => {
  res.json({
    status: 'success',
    data: events
  });
});

// DELETE /events - Clear all events
router.delete('/', (_req: Request, res: Response<ApiResponse<void>>) => {
  events = [];
  res.json({
    status: 'success',
    data: undefined
  });
});

export const eventsController = router;