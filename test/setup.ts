import * as fs from 'fs';
import * as path from 'path';

// Test setup file
beforeEach(() => {
  jest.clearAllMocks();
});

// Ensure sessions_data directory exists for tests
beforeAll(() => {
  const sessionsDir = path.join(process.cwd(), 'sessions_data');
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';