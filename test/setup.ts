// Test setup file
beforeEach(() => {
  jest.clearAllMocks();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';