import axios from 'axios';
import { config } from '../utils/config';
import { WebhookEvent } from '../models/Event';
import { storeWebhookEvent } from '../controllers/eventsController';

export class WebhookAdapter {
  private webhookUrl: string;
  private enabled: boolean;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.webhookUrl = config.WEBHOOK_URL;
    this.enabled = config.ENABLE_WEBHOOK;
    this.retryAttempts = config.WEBHOOK_RETRY_ATTEMPTS;
    this.retryDelay = config.WEBHOOK_RETRY_DELAY;
  }

  async sendEvent(event: WebhookEvent): Promise<void> {
    // Always store event for display in test interface
    storeWebhookEvent(event.sessionId, event.eventType, event.data);
    
    if (!this.enabled || !this.webhookUrl) {
      console.log('Webhook disabled or URL not configured');
      return;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await axios.post(this.webhookUrl, event, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event.eventType
          },
          timeout: 10000
        });
        
        console.log(`Webhook delivered: ${event.eventType} for session ${event.sessionId}`);
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`Webhook delivery attempt ${attempt} failed:`, (error as any).message);
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    
    console.error('Webhook delivery failed after all attempts:', lastError);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const webhookAdapter = new WebhookAdapter();