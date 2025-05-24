# Task 3: Session HTTP Endpoints

## Objective
Create RESTful HTTP endpoints for session management, connecting the HTTP layer to the session manager service.

## Requirements

### 1. Sessions Controller
Create `src/controllers/sessionsController.ts`:

**Endpoints to implement:**
- `POST /sessions` - Create new session
- `GET /sessions` - List all sessions
- `GET /sessions/:id` - Get specific session
- `DELETE /sessions/:id` - Delete session

### 2. Request/Response Models
Create TypeScript interfaces in `src/models/api.ts`:

```typescript
// Request bodies
interface CreateSessionRequest {
  sessionId?: string;  // Optional custom session ID
}

// Response bodies
interface SessionResponse {
  id: string;
  status: string;
  phoneNumber?: string;
  name?: string;
  createdAt: string;
  connectedAt?: string;
  qrCode?: string;
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
```

### 3. Controller Implementation

**POST /sessions**
```typescript
router.post('/sessions', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = sessionManager.createSession(sessionId);
    res.status(201).json(mapSessionToResponse(session));
  } catch (error) {
    // Handle SessionAlreadyExistsError -> 409
    // Handle other errors -> 500
  }
});
```

**GET /sessions**
```typescript
router.get('/sessions', async (req, res) => {
  const sessions = sessionManager.getAllSessions();
  res.json(sessions.map(mapSessionToResponse));
});
```

**GET /sessions/:id**
```typescript
router.get('/sessions/:id', async (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(mapSessionToResponse(session));
});
```

**DELETE /sessions/:id**
```typescript
router.delete('/sessions/:id', async (req, res) => {
  const deleted = sessionManager.deleteSession(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.status(204).send();
});
```

### 4. Error Handling Middleware
Create `src/middleware/errorHandler.ts`:
- Catch and format errors consistently
- Map domain errors to HTTP status codes
- Log errors appropriately

### 5. Router Setup
Update `src/index.ts`:
- Mount sessions router at `/sessions`
- Add error handling middleware

### 6. Integration Tests
Create `test/integration/sessions.test.ts`:

```typescript
describe('Sessions API', () => {
  describe('POST /sessions', () => {
    it('should create session with auto-generated ID');
    it('should create session with custom ID');
    it('should return 409 for duplicate session ID');
  });

  describe('GET /sessions', () => {
    it('should return empty array when no sessions');
    it('should return all sessions');
  });

  describe('GET /sessions/:id', () => {
    it('should return session details');
    it('should return 404 for non-existent session');
  });

  describe('DELETE /sessions/:id', () => {
    it('should delete existing session');
    it('should return 404 for non-existent session');
  });
});
```

## Testing Approach
```typescript
import request from 'supertest';
import { app } from '../../src/app';  // Export app separately from server

beforeEach(() => {
  // Clear sessions between tests
});

it('should create session', async () => {
  const response = await request(app)
    .post('/sessions')
    .send({ sessionId: 'test-123' });
    
  expect(response.status).toBe(201);
  expect(response.body.id).toBe('test-123');
  expect(response.body.status).toBe('initializing');
});
```

## Success Criteria
- [ ] All endpoints implemented and working
- [ ] Proper HTTP status codes returned
- [ ] Request validation in place
- [ ] Integration tests passing
- [ ] Error responses follow consistent format
- [ ] TypeScript types for all requests/responses

## Notes
- Keep controllers thin - business logic stays in services
- Use async/await for consistency
- Validate request bodies but keep validation simple for now
- QR code will be populated in Task 4 when Baileys is integrated