# Task 1: Project Setup + Basic Server

## Objective
Set up the TypeScript project with Express and create a basic HTTP server with a health check endpoint. This establishes the foundation for the WhatsApp API service.

## Requirements

### 1. Initialize Node.js Project
- Create `package.json` with appropriate metadata
- Install dependencies:
  - **Production**: express, dotenv, cors, helmet
  - **Development**: typescript, @types/node, @types/express, @types/cors, ts-node, nodemon, jest, @types/jest, supertest, @types/supertest

### 2. TypeScript Configuration
- Create `tsconfig.json` with:
  - Target ES2020 or later
  - Module resolution for Node
  - Strict type checking enabled
  - Output directory set to `dist/`
  - Include `src/**/*` and exclude `node_modules`, `dist`

### 3. Project Structure
Create the following directory structure:
```
src/
├── controllers/
├── services/
├── adapters/
├── models/
├── utils/
│   └── config.ts
└── index.ts
test/
├── unit/
└── integration/
    └── health.test.ts
```

### 4. Configuration Module
Create `src/utils/config.ts`:
- Load environment variables using dotenv
- Export configuration object with:
  - `PORT` (default: 3000)
  - `NODE_ENV` (default: 'development')
  - Add placeholders for future configs (WEBHOOK_URL, etc.)

### 5. Basic Express Server
Create `src/index.ts`:
- Initialize Express application
- Add middleware: cors, helmet, express.json()
- Add `/health` GET endpoint that returns:
  ```json
  {
    "status": "ok",
    "timestamp": "2024-01-20T10:30:00.000Z",
    "service": "zapw"
  }
  ```
- Start server listening on configured PORT
- Add graceful shutdown handling

### 6. NPM Scripts
Add to `package.json`:
```json
{
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "typecheck": "tsc --noEmit"
  }
}
```

### 7. Development Configuration
Create configuration files:
- `.env.example` with sample environment variables
- `nodemon.json` to watch TypeScript files and run with ts-node
- `.gitignore` including node_modules, dist, .env, sessions_data

## Tests

### Integration Test (`test/integration/health.test.ts`)
```typescript
describe('Health Check Endpoint', () => {
  it('should return 200 with status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('zapw');
  });
});
```

## Success Criteria
- [ ] Server starts successfully with `npm run dev`
- [ ] TypeScript compiles without errors
- [ ] `/health` endpoint responds with correct JSON
- [ ] Integration test passes
- [ ] Hot reload works in development

## Notes
- Use ES modules syntax (import/export)
- Ensure all TypeScript types are properly defined
- Keep the server initialization separate from the app creation (for testing)