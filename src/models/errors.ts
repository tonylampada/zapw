export class SessionNotFoundError extends Error {
  constructor(message?: string) {
    super(message || 'Session not found');
    this.name = 'SessionNotFoundError';
  }
}

export class SessionAlreadyExistsError extends Error {
  constructor(message?: string) {
    super(message || 'Session already exists');
    this.name = 'SessionAlreadyExistsError';
  }
}