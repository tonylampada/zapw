# Task 2: Session Manager (In-Memory)

## Objective
Implement a session manager service that handles WhatsApp session lifecycle in memory. This provides the core session management logic without the complexity of Baileys integration.

## Requirements

### 1. Session Model
Create `src/models/Session.ts`:
```typescript
interface Session {
  id: string;
  status: 'initializing' | 'qr_waiting' | 'connected' | 'disconnected';
  phoneNumber?: string;  // Will be populated after connection
  name?: string;         // WhatsApp account name
  createdAt: Date;
  connectedAt?: Date;
  qrCode?: string;       // Temporary QR code data
}
```

### 2. Session Manager Service
Create `src/services/sessionManager.ts`:

**Core Methods:**
- `createSession(sessionId?: string): Session` - Creates new session with auto-generated or provided ID
- `getSession(sessionId: string): Session | null` - Retrieve session by ID
- `getAllSessions(): Session[]` - List all sessions
- `updateSession(sessionId: string, updates: Partial<Session>): Session` - Update session properties
- `deleteSession(sessionId: string): boolean` - Remove session
- `sessionExists(sessionId: string): boolean` - Check if session exists

**Implementation Details:**
- Use a Map<string, Session> for in-memory storage
- Generate session IDs using crypto.randomUUID() if not provided
- Validate that session IDs don't already exist when creating
- Throw meaningful errors for invalid operations

### 3. Error Handling
Create custom errors in `src/models/errors.ts`:
```typescript
class SessionNotFoundError extends Error {}
class SessionAlreadyExistsError extends Error {}
```

### 4. Session Manager Tests
Create `test/unit/sessionManager.test.ts`:

**Test Cases:**
```typescript
describe('SessionManager', () => {
  beforeEach(() => {
    // Clear all sessions before each test
  });

  describe('createSession', () => {
    it('should create session with auto-generated ID');
    it('should create session with provided ID');
    it('should throw error if session ID already exists');
  });

  describe('getSession', () => {
    it('should return existing session');
    it('should return null for non-existent session');
  });

  describe('updateSession', () => {
    it('should update session status');
    it('should throw error for non-existent session');
    it('should preserve non-updated fields');
  });

  describe('deleteSession', () => {
    it('should remove existing session');
    it('should return false for non-existent session');
  });

  describe('getAllSessions', () => {
    it('should return empty array when no sessions');
    it('should return all active sessions');
  });
});
```

## Implementation Example

```typescript
// src/services/sessionManager.ts
export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  createSession(sessionId?: string): Session {
    const id = sessionId || crypto.randomUUID();
    
    if (this.sessions.has(id)) {
      throw new SessionAlreadyExistsError(`Session ${id} already exists`);
    }

    const session: Session = {
      id,
      status: 'initializing',
      createdAt: new Date()
    };

    this.sessions.set(id, session);
    return session;
  }

  // ... other methods
}

// Export singleton instance
export const sessionManager = new SessionManager();
```

## Success Criteria
- [ ] All session manager methods implemented
- [ ] Unit tests pass with 100% coverage
- [ ] Proper TypeScript types for all methods
- [ ] Error cases handled appropriately
- [ ] Session state transitions work correctly

## Notes
- This is purely in-memory; persistence will be added in Task 7
- Keep the implementation simple and focused on session logic
- The actual WhatsApp connection will be added in Task 4