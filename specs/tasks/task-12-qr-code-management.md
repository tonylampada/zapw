# Task 12: Enhanced QR Code Management

## Overview
Implement blocking QR code generation on session creation and automatic QR refresh to ensure QR codes never expire when accessed through the API.

## Requirements

### 1. Blocking Session Creation
- `POST /sessions` should block until a QR code is generated
- Response should include the initial QR code and expiration time
- Timeout after reasonable period (e.g., 30 seconds) if no QR is generated

### 2. QR Code Expiration Tracking
- Add `qrExpiresAt` field to Session model
- Calculate expiration based on QR generation time (typically 60 seconds)
- Include `qrExpiresAt` in all session responses

### 3. Automatic QR Refresh
- `GET /sessions/{id}` should check if current QR is expired
- If expired and session still in `qr_waiting` status, trigger QR regeneration
- Block until new QR is available (with timeout)
- Return fresh QR code with updated expiration

### 4. Implementation Details

#### Session Model Update
```typescript
interface Session {
  // ... existing fields
  qrCode?: string;
  qrExpiresAt?: Date;  // New field
}
```

#### Response Format
```json
{
  "id": "session-123",
  "status": "qr_waiting",
  "qrCode": "2@abc...",
  "qrExpiresAt": "2025-05-25T12:01:30.000Z",
  // ... other fields
}
```

#### QR Refresh Logic
1. Check if `qrExpiresAt` is in the past
2. If expired and status is `qr_waiting`:
   - Trigger reconnection to generate new QR
   - Wait for new QR event (with timeout)
   - Update session with new QR and expiration
3. Return updated session data

## Technical Considerations

### Baileys Integration
- Need to handle Baileys' QR generation events
- May need to force reconnection to trigger new QR
- Handle edge cases where device is already connecting

### Concurrency
- Handle multiple simultaneous requests for same session
- Prevent multiple QR regeneration attempts
- Use appropriate locking/queueing mechanism

### Timeouts
- QR generation timeout: 30 seconds
- QR expiration time: 60 seconds (or detect from Baileys)
- Refresh request timeout: 15 seconds

## Acceptance Criteria

1. **Blocking Creation**
   - [ ] `POST /sessions` returns QR code in initial response
   - [ ] Request blocks until QR is available or timeout
   - [ ] Appropriate error if QR generation fails

2. **Expiration Tracking**
   - [ ] `qrExpiresAt` field added to Session model
   - [ ] Expiration time calculated correctly (QR generation + 60s)
   - [ ] Field included in all session API responses

3. **Auto Refresh**
   - [ ] `GET /sessions/{id}` detects expired QR codes
   - [ ] Automatically triggers QR regeneration when needed
   - [ ] Returns fresh QR with updated expiration
   - [ ] Handles concurrent refresh requests gracefully

4. **Error Handling**
   - [ ] Timeout errors for QR generation
   - [ ] Appropriate status codes for different scenarios
   - [ ] Clear error messages for debugging

## Test Scenarios

1. **Basic Flow**
   - Create session → receive QR immediately
   - Get session after 55s → same QR
   - Get session after 65s → new QR

2. **Concurrent Access**
   - Multiple clients getting same expired session
   - Only one QR regeneration triggered

3. **Edge Cases**
   - Session connects while refreshing QR
   - Baileys disconnects during refresh
   - Multiple refresh attempts in quick succession

## Dependencies
- Requires understanding of Baileys QR lifecycle
- May need modifications to WhatsAppAdapter
- Session manager needs update for expiration tracking

## Estimated Effort
- Implementation: 4-6 hours
- Testing: 2-3 hours
- Total: 6-9 hours