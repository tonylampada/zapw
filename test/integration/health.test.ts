import request from 'supertest';
import { createApp } from '../../src/app';

describe('Health Check Endpoint', () => {
  const app = createApp();

  it('should return 200 with status ok', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('zapw');
    expect(response.body.timestamp).toBeDefined();
    expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
  });

  it('should include uptime in seconds', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body.uptime).toBeDefined();
    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should have correct content type', async () => {
    const response = await request(app).get('/health');
    
    expect(response.headers['content-type']).toContain('application/json');
  });
});