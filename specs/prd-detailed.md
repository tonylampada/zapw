Implementation Plan: TypeScript WhatsApp Multi-Device HTTP Service

Overview and Objectives

This project aims to create a TypeScript-based HTTP service that exposes WhatsApp messaging capabilities (via the Baileys library) through RESTful endpoints. The service will support multiple WhatsApp numbers (multi-device sessions) with QR code authentication and persistent sessions stored on disk. It will handle sending and receiving all message types (text, images, videos, audio, documents, etc.), and forward all incoming events (e.g. new messages, status updates) to a common webhook URL. Key objectives include:
	•	Multiple Session Support: Manage multiple WhatsApp accounts in parallel, each identified by a session ID or phone number. Sessions persist across restarts by saving auth credentials to the filesystem (e.g. mounted Docker volume).
	•	Complete Messaging Features: Provide endpoints to send messages of various types (text, media, etc.) and properly handle incoming messages, media downloads, and read receipts.
	•	Unified Webhook for Events: Route all incoming events from any connected account to a single external webhook endpoint. Each event payload will include an identifier (e.g. the source phone number or session ID) to indicate which account it came from.
	•	Clean Architecture: Follow best practices for modular design and separation of concerns as described by Tony Lampada’s Good Architecture and Plumbing + Intelligence articles ￼ ￼. The service will be organized into layers (HTTP interface, core logic, external integrations) to ensure the code is easy to maintain, extend, and test.
	•	Developer-Friendly & Testable: Offer a straightforward local setup for development and testing (including configuration for local webhook testing, logging of QR codes for easy scanning, etc.). Provide a comprehensive testing strategy (unit and integration tests) to validate functionality.
	•	Dockerized Deployment: Include a Dockerfile and configuration to containerize the service. Persistent data (auth sessions) will be stored on a volume so that WhatsApp sessions aren’t lost between restarts.
	•	CI/CD Automation: Set up GitHub Actions workflows for continuous integration and delivery. On each push, the project will build and run tests. On merges to main or tag releases, the workflow will build the Docker image and push it to Docker Hub automatically.

By meeting these objectives, the result will be a robust WhatsApp API service that is easy to change and extend (a hallmark of good architecture ￼), and that can be confidently deployed and maintained.

Architectural Approach and Design Principles

Our design will adhere to clean architecture principles to maximize modularity and minimize interdependencies. In Tony Lampada’s terms, we will separate “plumbing” code (infrastructure, I/O, data flow) from “intelligence” code (business logic) ￼ ￼. The benefits of this separation include lower cognitive load when making changes (since each module has a well-defined responsibility ￼) and fewer bugs due to clear boundaries between components. Below are the key design principles and how they shape our architecture:
	•	Layered Architecture (Three-Layer Design): We organize the backend into three main layers, inspired by the Surface-Services-Adapters pattern ￼:
	•	1. Surface (Plumbing – Entry Points): The outermost layer consists of HTTP controllers (e.g. Express routes). This layer handles incoming HTTP requests, validates input, invokes the appropriate service method, and formats the HTTP response. It contains no business logic – it’s essentially routing and request handling logic ￼. For example, the route handler for “send message” will extract parameters from the request and call a service method to perform the send action, then return the result or error as JSON.
	•	2. Services (Intelligence – Business Logic): The middle layer implements the core logic of our application. Services coordinate between the domain entities and adapters. Here we’ll implement operations like “create a new WhatsApp session”, “send a message via a given session”, “forward an incoming message to the webhook”, etc. Each service method encapsulates a specific piece of logic, making decisions and orchestrating calls to adapters as needed ￼ ￼. Notably, the services will not deal with HTTP or Baileys internals directly – they work with abstracted interfaces. For instance, a WhatsAppService.sendMessage(sessionId, to, content) method would validate the input (perhaps ensure the session exists and content is not empty), then call a lower-level adapter method to actually send the message via Baileys.
	•	3. Adapters (Plumbing – External Integrations): The innermost layer consists of adapter modules that interface with external systems or libraries ￼. In our case, the primary adapters are:
	•	WhatsApp Adapter (Baileys layer): This module wraps the Baileys library. It knows how to initialize connections, listen for events, send messages, download media, etc., using Baileys. The rest of the system doesn’t directly call Baileys functions – it goes through this adapter’s interface (e.g. WhatsAppClient.sendMessage() etc.). This isolation means if we upgrade or switch out Baileys, we only adjust this adapter.
	•	Webhook Adapter: Responsible for delivering events out to the external webhook URL. This could simply use an HTTP client (like Axios or node-fetch) to POST event data to the configured URL. By treating it as an adapter, the service layer can “call” the webhook sender without concerning itself with HTTP details. It also allows easy replacement or simulation of the webhook target in tests.
	•	(Optional) Persistence Adapter: Although the plan is to use the filesystem for session data, we still encapsulate persistence behind an interface (for example, a simple file store module for saving/loading auth info). This could later be replaced with a database or Redis without impacting higher layers.
	•	Separation of Concerns: Each module and class in the system will have a single clear responsibility. This aligns with Tony Lampada’s advice that well-architected software is composed of pieces that are not heavily intertangled ￼. For example: the HTTP controller does not contain business decisions or Baileys logic, the service layer does not perform HTTP request parsing or JSON formatting, and the Baileys adapter does not know about HTTP or webhooks. This separation makes it easier to reason about and change one part of the system without unintended side effects ￼.
	•	Avoid Mixing Plumbing and Intelligence: We explicitly avoid putting high-level logic in the wrong place. As Tony Lampada notes, many software quality issues arise when plumbing and intelligence are mixed together ￼. By keeping our routing/IO code separate from our core logic, we improve maintainability and testability. For instance, the logic for retrying a message send on failure might live in the service (intelligence), but the low-level details of how to call the WhatsApp API are in the adapter (plumbing). This way, if we need to modify retry logic, we don’t risk breaking the underlying connection code, and vice versa.
	•	High Cohesion, Low Coupling: Components that belong together (e.g. Baileys event handling and WhatsApp sending) will reside in the same module, while components that serve different purposes will interact via clear interfaces. This reduces coupling. For example, the service layer might interact with the WhatsApp adapter through an interface that abstracts whether messages are sent via Baileys or any other library. The rest of the system doesn’t need to know. This design makes future changes or extensions (like adding support for another messaging platform or a different storage mechanism) much easier, embodying the idea that good architecture makes changes “inexpensive and painless” ￼.

In summary, the architecture will be modular and layered, with well-defined boundaries. This ensures the codebase remains easy to modify and extend without breaking existing functionality – the essence of good architecture ￼. It also aligns with the Plumbing + Intelligence mindset: infrastructure code (HTTP handlers, external API calls) is kept separate from core logic (the rules of how we manage WhatsApp sessions and messages), resulting in cleaner, more maintainable codebase ￼.

Proposed Project Structure

The following file/folder structure is proposed to organize the code. This structure reflects the layered architecture and separation of concerns described above:

project-root/
├── src/
│   ├── controllers/            # Layer 1: Surface (HTTP endpoints)
│   │   ├── sessionsController.ts    # Handles routes for session management (login, logout, list sessions)
│   │   ├── messagesController.ts    # Handles routes for sending messages (and possibly media upload/download)
│   │   └── ... (other controllers if needed, e.g., for webhook test endpoints)
│   ├── services/               # Layer 2: Service (core logic)
│   │   ├── whatsappService.ts       # Core service logic for WhatsApp operations (manages sessions, sending, event routing)
│   │   ├── sessionManager.ts        # Manages multiple session instances, session lifecycle, and persistence
│   │   └── ... (other service modules as needed)
│   ├── adapters/               # Layer 3: Adapters (external integrations)
│   │   ├── whatsappAdapter.ts       # Wraps Baileys library (init connections, send messages, handle Baileys events)
│   │   ├── webhookAdapter.ts        # Responsible for POSTing events to the external webhook URL
│   │   ├── persistenceAdapter.ts    # Handles reading/writing auth files to filesystem (could be simple functions)
│   │   └── mediaAdapter.ts (opt)    # Utility for media handling (e.g., downloading media via Baileys, storing temporarily)
│   ├── models/                 # Data models (Types/Interfaces for WhatsApp messages, events, etc.)
│   │   ├── Message.ts               # Defines TS interfaces/types for message structures (text, media, etc.)
│   │   ├── Session.ts               # Defines what a session object contains (id, status, phone number, etc.)
│   │   └── Event.ts                 # Defines structure for webhook event payloads
│   ├── utils/                  # Utility and helper modules
│   │   ├── logger.ts                # Configured logger (e.g., using Winston or Pino for structured logs)
│   │   ├── config.ts                # Configuration loader (reads env variables, sets defaults)
│   │   └── qrUtil.ts (opt)          # Utility to generate QR code images or ASCII from Baileys QR string (for dev convenience)
│   └── index.ts                # Application entry point (initializes server and modules, mounts controllers on Express app)
├── test/ or __tests__/         # Tests for the application
│   ├── unit/                        # Unit tests for individual modules
│   └── integration/                 # Integration tests (e.g., testing HTTP endpoints with a running server)
├── sessions_data/             # Directory to store session auth files (mounted as volume in Docker)
│   └── (e.g., session-<ID>.json files for each WhatsApp account’s auth state)
├── Dockerfile                 # Docker configuration to containerize the app
├── docker-compose.yml         # (Optional) Compose file for local dev (e.g., could include the app and a test webhook service)
├── package.json               # Node.js project manifest (lists dependencies like Baileys, Express, etc.)
├── tsconfig.json              # TypeScript compiler configuration
└── .github/
    └── workflows/
         ├── ci-cd.yml             # GitHub Actions workflow for CI/CD (build, test, and push Docker image)
         └── (other workflows if needed, e.g., linting)

Directory Explanations:
	•	src/controllers/: Contains HTTP controller modules, one per logical group of endpoints. For example, sessionsController.ts will define routes for session login/logout, and messagesController.ts will define routes for sending messages or retrieving media. Each controller uses an Express (or similar) router. They receive HTTP requests, validate/parse input (ensuring required fields like phone numbers or message content are present), call the appropriate service method, and return a JSON response. Controllers focus on request/response handling and do not implement business logic.
	•	src/services/: Contains the core service classes/functions implementing the business logic. The key service is WhatsAppService – it orchestrates operations such as creating a new session (triggering the QR generation via adapter, and storing the session info), sending a message (choosing the correct session adapter and handling any domain rules, e.g. maybe queueing or checking message type), and handling incoming events (tagging them with session info and invoking the webhook adapter). We also have a sessionManager.ts which keeps track of all active sessions in memory. It can load saved sessions from disk on startup and handles adding/removing sessions. Services are largely pure logic – they don’t deal with HTTP or the specifics of Baileys; they call adapter interfaces to do those parts.
	•	src/adapters/: Contains modules that abstract external interactions:
	•	whatsappAdapter.ts: Wraps the Baileys library. Likely implemented as a class (e.g. WhatsAppClient) with methods like connect(sessionId), sendMessage(sessionId, to, content), logout(sessionId), and events/callbacks for incoming WhatsApp events. Internally, it uses Baileys to manage WhatsApp WebSocket connections. It will utilize Baileys’ API such as makeWASocket() to create a connection, and sock.ev.on('messages.upsert', ...) to listen for new messages. This adapter will also handle QR code generation (Baileys provides a qr string in connection updates) – possibly by printing to console and/or exposing it via an event to the service layer. Each WhatsApp session (number) could correspond to one Baileys socket instance; the adapter manages these instances in a map keyed by session ID. To maintain sessions, it uses the Baileys auth state APIs to load/store credentials from sessions_data/ files.
	•	webhookAdapter.ts: Provides a function to deliver an event payload to the configured webhook URL. It will read the webhook URL from config and perform an HTTP POST with the event data (likely using a library like Axios for ease of JSON handling and promises). This adapter can incorporate retry logic or error handling (e.g., log errors if the webhook is unreachable). By abstracting this, we can easily replace the delivery mechanism or mock it during testing.
	•	persistenceAdapter.ts: Handles reading and writing session authentication files. For example, it might expose loadAuth(sessionId) and saveAuth(sessionId, data) that internally read/write JSON files in sessions_data/. Baileys’ useSingleFileAuthState(filePath) will actually return functions to load and save state; we can integrate that by pointing it to our desired file path per session. We keep this logic isolated so that if we decide to switch to a database or a more secure storage, we can change it here without affecting other parts.
	•	mediaAdapter.ts (optional): A helper for media handling. Baileys can download media content from messages (via functions like downloadMediaMessage). We might implement these calls here. For example, when an incoming message event contains an image, the service could call mediaAdapter.downloadImage(message) which uses Baileys to fetch the binary and then either saves it to a temp folder or returns a Buffer/Base64. Similarly, an endpoint for retrieving media could leverage this. Keeping media logic separate prevents cluttering the main service with buffer/stream handling.
	•	src/models/: TypeScript interfaces or types to represent key data structures. For instance, a Message type defining common fields (ID, from, to, timestamp, type of message, and content or media info), or an Event type for webhook payloads (including session ID, event type, and a payload object). These models help ensure consistent data shapes across the app. They also document what data to expect in API calls and webhook events.
	•	src/utils/: Miscellaneous utilities and helpers. This can include a logger.ts to initialize a logger (we might use Winston or Pino for logging). We configure it to log to console or files as needed, with appropriate log levels. Logging is important for debugging, especially for events and errors (e.g., logging when a message is received or if the webhook delivery fails). Another util could be config.ts which centralizes configuration (reading environment variables like webhook URL, port, etc., using dotenv to load a .env file in development). If needed, qrUtil.ts could generate a QR code image or ASCII string from the QR text that Baileys provides – for instance using the qrcode npm library. This can help display the QR code in a terminal or encode it for an API response.
	•	src/index.ts: The main entry script. This will initialize the Express server, set up middlewares (like JSON parsing, maybe request logging), initialize the service layer and adapters, and mount the routes. It likely will do something like: load config, instantiate a WhatsAppService (which in turn sets up the adapters), call a function to load existing sessions (so that reconnections happen on startup), and finally start listening on the configured port. This is the composition root where all pieces come together (the “plumbing” to wire up our components).
	•	sessions_data/: Directory for storing session state files. We will ensure each WhatsApp session has a unique file (e.g. session-<number>.json or similar). Baileys will use these files to load authentication credentials (so that re-scans of QR are not required each time). In Docker deployment, this folder will be a mounted volume so that it persists outside the container’s lifecycle. Each file contains sensitive info (tokens/keys), so we will document that it should be protected. Optionally, we might structure subfolders per session if a session generates multiple files (Baileys multi-file auth state, for example, uses two files: one for creds and one for keys). But using the single-file state is simpler.
	•	test/: Contains automated tests. We’ll have separate subfolders for unit tests of individual modules (controllers, services, adapters) and integration tests of the overall API. For example, unit tests might use Jest to mock dependencies: e.g., a controller test can inject a fake service to verify that correct service calls are made for given HTTP inputs, or a service test can stub the WhatsApp adapter to simulate sending messages without a real WhatsApp connection. Integration tests might spin up the Express server (in-memory) and simulate HTTP calls to the endpoints, perhaps using Supertest, verifying that the responses and side effects (like calling a dummy webhook) work as expected.
	•	Config & CI Files: The Dockerfile will define how to build the container. A docker-compose.yml may be provided for local development, for example to easily run the service with required environment variables and perhaps a dummy webhook receiver service for testing. The GitHub Actions workflow file will contain the CI/CD pipeline configuration (detailed below). Additionally, common project files like package.json and tsconfig.json are present as usual.

This structured layout ensures clean modularity: each directory (and file) has a clear purpose. A developer can navigate the project and quickly find the relevant code (e.g., “all HTTP endpoints are in controllers”, “all WhatsApp-specific code is in the adapter”). It also makes it straightforward to extend functionality — e.g., adding a new endpoint would mean adding a new controller (and possibly a service method), without touching unrelated parts.

API Endpoints Design

The service will expose a set of HTTP REST endpoints to allow clients (e.g. your backend or other services) to interact with WhatsApp via our service. Below is a specification of the main endpoints, including their routes, methods, expected parameters, and responses. The API is designed to cover session management and message sending. All endpoints will accept and return JSON (with appropriate HTTP status codes). Authentication to these endpoints (if needed) can be handled via an API key or token in headers – for now, we assume a simple scenario or local use, but adding an API key check (e.g., in an Express middleware) is recommended for production security.

1. Session Management Endpoints (manage WhatsApp account sessions):
	•	POST /sessions – Initiate a new WhatsApp session (login a new number via QR).
	•	Request: JSON body can be empty or contain optional parameters. (No parameters are strictly required to start a new session, but optionally a client-provided sessionId or label can be accepted. If not provided, the service will generate a unique session identifier.)
	•	Behavior: This triggers the service to start a new Baileys connection. The service will generate a QR code for WhatsApp multi-device login. Upon calling this endpoint, the service begins listening for the QR code event from Baileys.
	•	Response:
	•	On success (i.e., the service has started the session initialization): return JSON with a generated sessionId (if one wasn’t provided) and a status like "status": "QR_REQUIRED". For example:

{ "sessionId": "session123", "status": "QR_WAITING", "message": "Scan the QR code to authenticate this session" }

Additionally, the response may include the QR code information. Since the QR code is time-sensitive and changes every few seconds, we have a few design choices:
	•	Simple approach: Log the QR code to the console (as ASCII or an image link) for the developer to scan. This is acceptable for a developer-friendly setup. The response can instruct to check logs for the QR.
	•	Enhanced approach: Provide the QR code in the response, perhaps as a data URL or an ASCII QR. For example, include a field qr that contains a string which, when rendered as a QR code, can be scanned. We could generate a base64 PNG and include it (though that makes the JSON response large). Alternatively, if we expect the client to be a web interface, we might give the raw text for the QR so the client can generate its own QR image.
	•	Real-time approach: Use Server-Sent Events (SSE) or WebSocket to push the QR code to the client as soon as it’s available. This would require the client to subscribe after calling this endpoint. (For simplicity, initial implementation might skip this, but it’s a noted enhancement.)

	•	After the QR is scanned by the user on their phone and WhatsApp authenticates, the session will transition to “connected”. At that point, the session manager will persist the credentials to disk. The HTTP response to the initial POST call may not wait for this (it will likely return immediately with the session status). The client can later check session status via another endpoint (see next).
	•	Error cases: If too many sessions are already active or if a session with the same ID exists, respond with an error status (HTTP 400) and message. If Baileys fails to start (rare), respond with HTTP 500.

	•	GET /sessions – List all active sessions.
	•	Request: No parameters.
	•	Response: JSON array of active session info. For each session, include details such as sessionId, the WhatsApp phone number or ID associated (if known), and connection status. For example:

[
  { "sessionId": "session123", "wid": "15551234567@s.whatsapp.net", "status": "connected", "name": "John's WhatsApp" },
  { "sessionId": "session124", "wid": "15557654321@s.whatsapp.net", "status": "connecting", "qrWaiting": true }
]

Here, wid is the WhatsApp ID (including the phone number) and could serve as the “originating number” tag. The status might be connected, connecting, disconnected, etc., and we can indicate if a session is waiting for QR (qrWaiting: true).

	•	GET /sessions/{id} – Get status/details of a specific session.
	•	Request: Path parameter {id} is the session identifier (either the ID returned when created, or possibly the phone number as an ID if we use that).
	•	Response: JSON object with details similar to a single entry in the list above. Additionally, we could include info like last seen or the WhatsApp user’s name. If the session is not found, return 404.
	•	DELETE /sessions/{id} – Terminate a session (logout).
	•	Request: Path param is the session ID or number to log out.
	•	Behavior: This will trigger the service to disconnect the Baileys connection for that session and remove its auth info (optionally deleting the file or keeping it if we want possibility to reconnect?). We likely will delete to avoid stale data.
	•	Response: HTTP 200 with a JSON { "sessionId": "...", "status": "disconnected" } on success. If session not found, 404. If error during logout, 500 with error message.

2. Messaging Endpoints (sending messages through WhatsApp sessions):
	•	POST /sessions/{id}/messages – Send a message from a specific WhatsApp session.
	•	Request: Path param {id} identifies the session (WhatsApp account) that will send the message. The JSON body should contain the message details. For example:

{
  "to": "<recipient_phone_number>",
  "type": "<message_type>",
  "text": "Hello world!",
  "mediaUrl": "<url_or_base64_to_media>",
  "fileName": "document.pdf",
  "caption": "See attached",
  ...
}

Required fields:
	•	to: recipient’s phone number (international format) or WhatsApp ID. We can accept a plain phone number string and the service will format it to the proper ID (appending “@s.whatsapp.net”).
	•	One of the content fields depending on type. For example, if type: "text", then a text field with the message text is expected. If type: "image", a mediaUrl or base64 string should be provided, plus optionally a caption text. Similarly, type: "video", "audio", "document" etc., would expect corresponding data (and maybe a filename for documents).
We could also allow a type: "location" (with latitude/longitude fields), type: "contact" (with vCard data), etc., as supported by Baileys. The plan is to cover all message types by either a single unified endpoint or multiple endpoints. Here we choose a single endpoint with a type field for flexibility.

	•	Behavior: The controller will validate that required fields are present (e.g., if type is “text”, ensure text is provided; if “image”, ensure we have media data). It then calls WhatsAppService.sendMessage(sessionId, messageData). The service will use the WhatsApp adapter to send the message via Baileys. If the session is not connected or does not exist, it should return an error. If the media is given as a URL, the service might first download the file (or Baileys might support sending via URL directly; if not, we handle the download in the media adapter). If base64 is provided, the adapter will decode it and send.
	•	Response: On success, return HTTP 200 with JSON containing message details or an ID. For example:

{ "status": "sent", "messageId": "<WA_message_id>", "timestamp": 1681234567890 }

This confirms that the message was accepted for sending. (Baileys typically returns an ID and we can assume it’s sent; if we want to confirm delivery we might rely on incoming delivery receipt events via the webhook rather than hold the HTTP call.)
On failure (e.g. invalid session, or Baileys error), return an error status and message. For instance, a 400 if the input is wrong (unknown message type or missing data), or 500 if sending failed unexpectedly.

	•	GET /sessions/{id}/media/{messageId} – Retrieve media content (if needed).
	•	Purpose: This optional endpoint would allow retrieval of media from a message, for example if an incoming message event indicates a media message, the webhook payload might not include the binary. The external system can call this to fetch the actual image/audio/etc. This keeps webhook payloads lighter and gives more control over when to download media.
	•	Request: Path params include the session ID and the WhatsApp messageId (or a combination of IDs identifying the media message).
	•	Behavior: The service will locate the message via Baileys (Baileys might require we supply the message object; we may need to store recent messages or use an identifier to get it). Then use the Baileys downloadMediaMessage function through our media adapter to get the Buffer/stream of the media. It then returns the file content. This could stream the data or convert to base64. For simplicity, we might return base64 in JSON or set the appropriate content-type (e.g. image/jpeg) and return binary.
	•	Response: If successful, the raw media content (with correct content-type, or base64 in JSON). On error (message not found, expired media, etc.), return appropriate error code.

3. Webhook Endpoint (External):
There is no GET/POST endpoint on our service for the webhook; instead, the webhook is an external URL that our service will call. However, for testing purposes, we might include a dummy or test endpoint: for example, POST /webhook-test on our service that simply logs the event or returns it, so developers can simulate a webhook receiver easily. This is not for production, just a development aid.

General Response Format:
For consistency, we can use a uniform response structure for our API endpoints (especially for success/failure). For example:

{ "success": true, "data": {...}, "error": null }

or

{ "success": false, "error": "Session not found", "data": null }

This matches a pattern like in some existing implementations (e.g., always returning a JSON with these fields) ￼. This is optional, but a consistent format helps clients handle responses uniformly. We will also use standard HTTP status codes: 2xx for success, 4xx for client errors (bad input, not found), 5xx for server/internal errors.

Endpoint Usage Example:
	•	To add a new WhatsApp number to the service, a client would call POST /sessions. The response might be:

{ "sessionId": "session123", "status": "QR_WAITING" }

The developer then scans the QR from logs or from the provided data. Once scanned, the service connects. If the client polls GET /sessions/session123 after a few seconds, it might then see status "connected" and the wid (WhatsApp ID) of the account. At that point, the account is ready to send/receive messages.

	•	When the WhatsApp account receives a new message, our service (without any further API calls) will catch that event and POST it to the configured webhook. For example, it might send a JSON like:

{
  "sessionId": "session123",
  "wid": "15551234567@s.whatsapp.net",
  "event": "message.received",
  "data": {
     "from": "15557654321@s.whatsapp.net",
     "to": "15551234567@s.whatsapp.net",
     "timestamp": 1681300000000,
     "type": "text",
     "text": "Hello from someone!",
     "id": "ABCD1234...",
     "isGroup": false
  }
}

This payload tells the external system that session123’s WhatsApp (which is phone +1 5551234567) got a text message from +1 5557654321 with the given content. The external system could respond (not to the webhook, but via another endpoint call) by perhaps sending a reply through our service’s send-message endpoint.

	•	To send a message via that account, the external system calls POST /sessions/session123/messages with JSON {"to": "15557654321", "type": "text", "text": "Hello, got your message."}. Our service will then use Baileys to send the WhatsApp message. The response might be {"success": true, "messageId": "XYZ789..."} . Shortly after, when WhatsApp confirms delivery, our service might emit a webhook event like event: "message.sent" or message.delivered with relevant info (this could be an additional feature to implement delivery notifications).

The above endpoints cover core functionality. We will document these endpoints (possibly via a README or OpenAPI spec) for users. The design is such that new endpoints can be added easily if needed (for example, if we want an endpoint to fetch contact list or get group info, we’d add a new controller and possibly use Baileys functions to implement it in the adapter). Because of the layered design, adding features doesn’t break existing ones, maintaining the system’s extensibility.

WhatsApp Integration via Baileys (Adapter Layer)

At the heart of this service is the integration with the Baileys library, which handles the WhatsApp Web API connectivity. We will implement a WhatsApp Adapter module that encapsulates all usage of Baileys. This section outlines how we’ll handle multiple accounts, QR authentication, message sending, and receiving events using Baileys in a modular way.

Baileys Setup:
We will use the latest Baileys library (at the time of writing, Baileys by Whiskeysockets). Baileys allows connection to WhatsApp by scanning a QR code on the phone, using WhatsApp’s multi-device feature ￼. It provides an asynchronous WebSocket connection to WhatsApp and an event-driven model for receiving messages and updates.

Key points of our Baileys integration:
	•	One Baileys Socket per Session: Each WhatsApp account (session) will correspond to a Baileys client instance. We will not attempt to use one socket for multiple numbers (that isn’t possible); instead, maintain a collection (dictionary) of clients indexed by sessionId or phone number. For example, whatsappAdapter can have an internal Map like clients: Map<string, WASocket> where WASocket is Baileys’ socket type.
	•	Auth State & Persistence: Baileys provides utility hooks for saving auth credentials. We will use useSingleFileAuthState(filePath) for simplicity – this gives us a state object and an update function we can hook into Baileys. When starting a session, we’ll point it to a file in sessions_data/<sessionId>.json. If the file exists (from a previous login), Baileys will load the saved credentials and attempt to restore that session without QR. If the file doesn’t exist, Baileys will start a new session requiring QR. The adapter will call saveState on every cred update (Baileys triggers a 'creds.update' event) to keep the file updated. Storing these files on disk (and on a Docker volume in deployment) ensures persistence.
	•	Session Initialization (QR Code flow): When a new session is created, we call Baileys to initiate a connection. E.g., in code:

const { state, saveState } = useSingleFileAuthState(`sessions_data/${sessionId}.json`);
const sock = makeWASocket({ auth: state, printQRInTerminal: false });
sock.ev.on('creds.update', saveState);

If state has no valid creds (first time), Baileys will emit a connection.update event with a qr field containing the QR string. Our adapter listens for that event:

sock.ev.on('connection.update', (update) => {
    const { qr, connection, lastDisconnect } = update;
    if (qr) { ... } 
    if (connection === 'open') { ... }
    if (connection === 'close') { ... }
});

	•	When qr is present, we need to relay that to the user for scanning. As mentioned earlier, for a dev environment we might simply log the QR in the console as an ASCII QR code (Baileys can print to terminal if printQRInTerminal: true, but since our service may run headless or in Docker, we might handle it manually). We can also expose it via our API (perhaps storing the latest QR string in the session manager so that if a client calls GET /sessions/{id}, they might get a field qrData while it’s awaiting scan). For better UX, generating a temporary QR code image (e.g., using qrcode package to produce a base64 PNG) is an option.
	•	When connection === 'open', the session is successfully authenticated. Baileys provides sock.user which contains info about the logged-in account (e.g., the WhatsApp ID and maybe the phone number or name). At this point, our adapter will update the session record (in sessionManager) with this info. We then consider the session fully started. We might log “session X connected as number Y”.
	•	If connection === 'close', Baileys will typically provide a lastDisconnect reason. If it’s an error or logged out by server, we may attempt auto-reconnect depending on reason. The adapter can handle automatic reconnection (Baileys often auto-reconnects by default, but we can configure a max attempt or catch certain errors like “logged out” which means credentials are invalid – in that case, we’d need to start over with a new QR). We’ll implement logic for resilience: e.g., if disconnected unexpectedly, maybe try to restart the socket a few times (with a delay) before giving up. The .env snippet from a similar project shows configurable reconnect attempts ￼; we can have similar settings.

	•	Sending Messages: The adapter will expose methods like sendText(sessionId, to, text), sendMedia(sessionId, to, mediaBuffer, type, caption), etc., or a general sendMessage(sessionId, message) that figures out the type. Internally, it will call Baileys’ sending functions. For example, Baileys has a method sock.sendMessage(jid, content, options) where jid is the recipient WhatsApp ID and content is an object that can define various message types (text, image, document, etc.). We will build the content object based on the type:
	•	Text: { text: "Hello" }
	•	Image: { image: <Buffer of image>, caption: "hi" }
	•	Video: { video: <Buffer>, caption: "..." }
	•	Audio: { audio: <Buffer> }
	•	Document: { document: <Buffer>, fileName: "name.pdf" }
	•	etc.
Baileys handles sending asynchronously, returning an update with a message ID. Our adapter can await the sendMessage promise or use event messages.upsert which may echo the sent message. We will return the message ID or throw if an error occurs. The adapter doesn’t implement business rules – it just wraps Baileys calls. If Baileys requires certain formatting (like ensuring the to JID ends with “@s.whatsapp.net” for individuals or “@g.us” for groups), the adapter can hide those details (e.g., automatically append domain if not present).
	•	Receiving Messages & Events: Baileys emits many events, but the ones we care about primarily:
	•	messages.upsert: When new messages are received (or when messages we sent are acknowledged, depending on configuration). We will listen for .ev.on('messages.upsert', handler). The handler receives an object with message(s) and the type (e.g. “notify” for new incoming messages). We will filter out our own sent messages if needed (Baileys might include echoes of sent messages). For each new message (especially those of type “notify”), we will construct a normalized event object and pass it to the service layer for webhook dispatch. The adapter will likely emit an internal event or call a callback in the service whenever a new message arrives. For example, when adapter gets an incoming text, it could call service.handleIncomingMessage(sessionId, message). However, to keep adapters decoupled from services, a better approach is using an Event Emitter or observer pattern: the adapter can emit events like onMessage(sessionId, message) that the service layer subscribed to. We can utilize Node’s EventEmitter or even directly use the Baileys event pipeline but filtered per session. The session manager might subscribe to each sock’s events and unify them.
	•	Other events: connection.update (as discussed, for QR, connect, disconnect), messages.update (edits or status updates), presence.update (if we care about online status, probably not needed for MVP), messages.reaction, etc. In general, all events from all sessions should be caught and forwarded to the webhook with the session context. We will implement handlers for key events to be forwarded. The most important is incoming messages. We might also forward delivery receipts (when a message we sent is delivered/read) if Baileys provides that (Baileys does in messages.update or message status updates). This would allow the webhook receiver to know message status.
	•	Tagging events with originating number: The adapter or service will include an identifier for the source session when emitting events. We have a few choices for what that identifier is:
	•	The sessionId we internally use (which might be an opaque string like “session123”).
	•	The actual phone number (international format) of the WhatsApp account (e.g., “15551234567”). Baileys sock.user.id will give something like <phone>@s.whatsapp.net. We can extract the phone part for clarity.
	•	Perhaps a user-defined label for the session if provided.
Including the actual number is useful because it identifies the WhatsApp account in human terms. We will likely include both sessionId and the wid (WhatsApp ID / number) in the event payload. The question explicitly says “tagged with the originating number”, so ensuring the phone number is present is important.
	•	Handling multiple sessions concurrently: Baileys connections run in async, but Node can handle multiple at once. We must ensure thread-safety of the auth files (which is generally fine as each session has its own file). The session manager will coordinate actions: for example, we should not start two sessions with the same ID concurrently. Also, memory-wise, each session is separate so memory usage scales with number of accounts (Baileys can be a bit heavy if many sessions, but presumably manageable for a moderate number). We will provide guidance that this service is not meant to host hundreds of WhatsApp sessions unless resources are scaled accordingly.
	•	Error Handling: The adapter will catch errors from Baileys and propagate them in a controlled way. For instance, if sendMessage fails (maybe due to an invalid JID or media too large), the adapter can throw a descriptive error that the service layer turns into an HTTP 400 for the client. If a session disconnects permanently (e.g., logged out), we might trigger a webhook event for session status change and require the user to re-initiate. We’ll use logs to record issues as well.

By encapsulating all these details in whatsappAdapter.ts, our service layer remains clean. The service doesn’t need to know the intricacies of Baileys or WhatsApp protocols; it only calls high-level methods (like adapter.sendMessage(session, data)) and listens for high-level events (adapter.on('message', handler)). This modular design means we could swap out Baileys for another library or even the official WhatsApp Cloud API in the future, with minimal changes outside the adapter.

Incoming Event Handling and Webhook Routing

One of the core features is routing all incoming events (especially messages) to a common webhook. Here we detail how the system will capture these events and forward them, and what the payloads will look like. We also ensure that events from different sessions are distinguishable via tags.

Event Capture:
As described above, the WhatsApp adapter (Baileys integration) will emit events for new messages and possibly other WhatsApp events. The design is: each session’s Baileys client sends events to our Node app; our session manager or adapter collates them and emits a unified stream of events internally, which the service layer then handles for webhook delivery. Concretely, we can implement this as follows:
	•	The sessionManager (or the whatsappService) includes an EventEmitter that all session adapters use to emit events upward. For example, when session “session123” receives a new message, the adapter does something like:

eventEmitter.emit('message_received', { sessionId: 'session123', message: msg });

Or we register a callback in the adapter: adapter.onMessage = (sessionId, msg) => {...} in the service. The exact mechanism can vary, but the result is the service layer gets notified with both the session ID and the message data.

	•	The service layer’s event handler will take that and prepare a webhook payload. This involves tagging the event with the session’s identifying info (session ID and/or phone number). The service might enrich the event with additional metadata if needed (for instance, a friendlier timestamp, or converting certain data formats).
	•	The service then calls the webhook adapter to POST this to the external webhook URL. The URL of the webhook will be configured (e.g., an environment variable WEBHOOK_URL). We will also have a flag to enable/disable webhook globally (ENABLE_WEBHOOK), so developers can turn it off (in which case perhaps events just get logged).

Webhook Payload Structure:
We will design a JSON structure for the events sent to the webhook. It should include:
	•	Origin Identifier: As discussed, include the sessionId and/or the WhatsApp phone number. e.g., "sessionId": "session123" and "origin": "+1 5551234567". The phone number can be extracted from the WhatsApp ID.
	•	Event Type: A field like "eventType" or simply "event" to describe what this notification is about. For example: "message.received", "message.sent" (if we choose to notify about messages the bot sent), "message.delivered" (delivery receipt), "session.connected" (when a session becomes ready), "session.disconnected", etc. At minimum, we handle incoming messages.
	•	Event Data: A nested object containing details relevant to the event. For a message, this would include the sender, recipient, timestamp, message type, and content. We will try to follow a consistent format, possibly similar to WhatsApp’s own webhook format (if any) or at least logical naming:
	•	For text: include "text": "hello".
	•	For media: include metadata like "mediaType": "image", "mediaFilename": "photo.jpg", "caption": "...". We might not include the binary in the webhook (to keep it lightweight), but we could include a "mediaId" or a flag indicating media, so the receiver knows to call our API to fetch it. Alternatively, if the media is small (like a small image or PDF), we could base64-encode it and include it under a field, but that might bloat the JSON. It’s likely better to provide an endpoint for retrieval.
	•	Other message types: location (latitude/longitude fields), contacts (contact info), etc., as they arise.
	•	Always include a "from" (the sender’s WhatsApp ID) and "to" (the recipient’s WhatsApp ID, which for personal messages will be our bot’s ID). Also an "id" (WhatsApp message ID) and "timestamp". Possibly an "isGroup": true/false and if group, include group info.
	•	Example of a webhook payload (incoming text):

{
  "sessionId": "session123",
  "origin": "15551234567", 
  "eventType": "message.received",
  "data": {
    "from": "15557654321",
    "to": "15551234567",
    "timestamp": 1681300000000,
    "type": "text",
    "text": "Hello from someone",
    "messageId": "ABCD1234EFGH"
  }
}

(Numbers here are in bare format for readability; we could also format them as full WhatsApp JIDs or include both.)

	•	The webhook adapter will serialize this JSON and POST it to the configured URL. We will include appropriate headers (e.g., Content-Type: application/json). If the webhook responds with an error or non-200, we can log a warning. Optionally, implement a retry mechanism for webhooks: e.g., if delivery fails, retry after a short delay a few times. This ensures reliability in case the receiving server is temporarily down. We can use an exponential backoff strategy for retries, but we should be careful not to queue infinite retries – perhaps a max of 3 attempts. These details can be configured or left for future enhancement.
	•	Security for Webhook: If needed, we could sign the payload or include a token so the receiving end can verify it came from our service (similar to how some webhooks send an HMAC signature). This would be an additional feature configured via a secret, but not strictly required unless security is a concern (assuming the webhook is a controlled endpoint).

Session Events:
Beyond messages, we may also forward session lifecycle events. For example, when a session first connects, we could send a "session.connected" event with the number, or when a session goes offline (connection.close with logged out), send "session.disconnected". This alerts the external system to possibly prompt the user to re-scan QR or just for monitoring. The webhook payload for those might be simpler, e.g.:

{ 
  "sessionId": "session123", 
  "origin": "15551234567", 
  "eventType": "session.connected", 
  "data": { "status": "connected", "name": "John's WhatsApp" } 
}

This is a nice-to-have addition. In our implementation plan, we will focus first on message events, but we’ll keep the design extensible for other event types. The eventType field allows easy filtering on the receiver side if they only care about certain events.

Common Webhook Endpoint:
All sessions use the same webhook URL (configured globally). We include the source session info as discussed. The reason for a single webhook is likely simplicity for the user – they can run one endpoint that handles all WhatsApp accounts by checking the origin field. (If, in the future, different sessions needed different webhooks, we could allow configuring a webhook per session, but that’s beyond current scope.)

Developer-Friendly Event Handling:
To facilitate local testing, we’ll also incorporate ways to observe events without an actual external server:
	•	For instance, in a dev mode (maybe when WEBHOOK_URL is not set or ENABLE_WEBHOOK=false), we will log incoming events to the console. This way a developer can see what events would be sent. We might pretty-print them or at least indicate “(DEV) Received message X from Y to Z”.
	•	We could also provide the aforementioned /webhook-test endpoint which simply prints any data posted to it. A developer could temporarily set WEBHOOK_URL to http://localhost:3000/webhook-test (pointing to the same service) to have the events loop back for inspection via logs. This isn’t meant for production but helps in verifying the event content.

By handling incoming events in a centralized way and using the webhook adapter to forward them, our service core remains focused on coordination, not on networking. The advantages of this approach include easy testability (we can simulate events and intercept calls to the webhook adapter in tests) and flexibility (change the webhook target or format without touching the WhatsApp logic).

Testing Strategy

Ensuring the reliability of this service is crucial, given it involves asynchronous events and external integration. We will employ a multi-layered testing approach, including unit tests for individual components and integration tests for the system behavior. The design of our architecture (with clear separation of layers and use of interfaces) makes it easier to test components in isolation by mocking their dependencies.

1. Unit Testing:
Each module (or logical unit) will have corresponding unit tests. We will use Jest (a popular testing framework for TypeScript) for writing and running tests. Key unit tests include:
	•	Controller Tests: Using supertest or by directly calling the Express handlers with a fake req/res. We will mock the service layer methods so that we don’t actually trigger real logic. The goal is to confirm that given certain inputs (request body or params), the controller calls the correct service method with correct arguments and handles success or error responses properly. For example, test that posting to /sessions/{id}/messages with missing fields returns a 400, or with valid input calls whatsappService.sendMessage(id, data) and returns 200. We can simulate the service’s response by replacing it with a stub that returns a known value.
	•	Service Tests: Here we test the business logic in whatsappService or sessionManager methods. We will mock the adapters (whatsappAdapter and webhookAdapter). This is where the separation of concerns pays off: we can create a fake WhatsAppAdapter class with the same interface but that doesn’t actually use Baileys – instead it might record that it was called, or return a preset value. For example, test that whatsappService.createSession() calls whatsappAdapter.createClient(sessionId) and doesn’t throw. Or test that whatsappService.sendMessage(session, msg) calls the adapter’s send and then perhaps logs or returns the correct output. We will also simulate events: e.g., create a dummy event emitter in place of the real adapter, emit a “message received” event, and verify that whatsappService then called webhookAdapter.sendWebhook(event) with the expected payload. These tests ensure our glue logic and transformations are correct (e.g., adding the right sessionId tag to events).
	•	Adapter Tests: Testing the real WhatsAppAdapter against WhatsApp is tricky in unit tests (as it needs network and a QR scan). Instead, we can abstract parts of it for testing:
	•	We can test that our adapter correctly constructs messages. For example, test a helper function that given a Message model (text or media) returns the proper Baileys content object. This doesn’t require a live connection, just that our format logic is right.
	•	We can simulate Baileys events by injecting a fake Baileys socket. If we design WhatsAppAdapter to accept a Baileys interface (for instance, inject a dummy that emits events), we can simulate a qr event or a messages.upsert event and verify our adapter’s internal handlers respond correctly (like storing QR, calling an event emitter, etc.).
	•	If we wanted to test with a real Baileys connection, we might mark those as integration tests (since they require a real WhatsApp login which is not suitable for automated CI). Probably we won’t do that in unit tests.
	•	For the webhookAdapter, we can mock the HTTP client (like jest mocking axios). Or we use a library like nock to intercept outgoing HTTP calls and assert the payload and URL. We can test that given an event object, webhookAdapter.send(event) calls the correct URL and handles errors properly (for example, if the webhook returns 500, does our adapter log and not throw, etc.).
	•	Utility Tests: e.g., test the qrUtil to ensure QR codes are generated or test the config loader to ensure default values work when env vars are missing.

We will aim for a high coverage on units, especially for the service logic which is the critical “brain” of the system.

2. Integration Testing:
Integration tests will test the system end-to-end (or at least across multiple layers) without involving actual WhatsApp network calls. We can achieve this by running the Express server (perhaps in-memory or on a test port) and replacing the real adapters with stubs/fakes that mimic Baileys and the webhook. Since we designed our layers to be decoupled, we can instantiate the server with a dependency injection approach for testing: e.g., initialize whatsappService with a FakeWhatsAppAdapter that has predictable behavior. Alternatively, we could monkey-patch the adapter module to use a fake during tests.

Possible integration test scenarios:
	•	Send Message Flow (without real WhatsApp): Start the server with a fake WhatsAppAdapter that when sendMessage is called simply returns a success (and maybe pretends to emit a sent event). Then simulate calling the real HTTP endpoint POST /sessions/test/messages with a sample payload. Verify that the HTTP response is as expected (success JSON). Also verify that the fake adapter received the call (to ensure the request went through service to adapter). We can also verify that our webhook stub (if any) did not get called for outgoing messages (unless we send a webhook for sent events).
	•	Receive Message Flow: Here we leverage our ability to simulate an incoming message. For example, have a fake adapter or expose an internal method to simulate a message event. We could call sessionManager.simulateIncomingMessage(sessionId, messageData) in the test, which would trigger the same logic as if Baileys emitted an event. We then verify that the webhook adapter was called with a payload containing the right data. For this, we will use a fake webhookAdapter that records calls (or a local test HTTP server acting as the webhook endpoint). One approach: in our application, instead of using a real HTTP call for webhook in test, we swap the webhookAdapter with one that simply emits an event we capture in test or writes to a log. The test can then inspect that. This ensures our event routing works end-to-end.
	•	Session Lifecycle: We might simulate a session connecting. Without real QR scanning, we can fake the connection event. For instance, call the /sessions POST (which with a fake adapter might immediately “connect” without a QR). Then check /sessions GET to see that session listed. Or simulate the sequence: create session (QR waiting), then simulate scanning by injecting credentials (fake adapter can have a method like simulateLogin(sessionId, user) that triggers the connection open event). Then test that now the session shows as connected and perhaps a webhook event session.connected was sent.
	•	Error cases: Test behavior for error flows: e.g., if sending a message to an invalid number, our fake adapter could throw an error like “invalid JID”. The service should catch it and return a 400. Our integration test can call the endpoint with such input and verify the error response format.

Integration tests give confidence that the pieces work together as expected in realistic scenarios. We will run them in CI as well, but ensure they do not require actual external connectivity.

3. Manual Testing & Developer QA:
In addition to automated tests, the developer can test the service manually in a dev environment:
	•	Run the service locally (npm run dev possibly using nodemon to auto-reload on changes). Use a real phone to scan QR and ensure a session connects. Then try hitting the send message endpoints (maybe send to a friend or another WhatsApp number) and verify the friend receives the message. Likewise, send a message from that friend to the WhatsApp account and observe that our service prints/logs it and sends a webhook (for manual testing, perhaps set the webhook URL to a local request bin or a simple Express app that prints the payload). This end-to-end sanity check is valuable.
	•	We’ll also test Docker container manually: build the image, run it with volume and env variables, and replicate the above to ensure nothing is broken in container environment (like file permissions for session files, etc.).

Throughout development, using a linting tool (ESLint) and type-checking with TypeScript will catch many issues early. We treat any TypeScript compile error or lint error as needing fixing before merge (and we can enforce that via CI checks too).

In summary, our testing strategy ensures each part of the system is verified in isolation (unit tests with mocks) and as a whole (integration tests and manual QA). The modular architecture (plumbing vs intelligence separation) significantly aids testing by allowing us to substitute boundaries (e.g., use a fake adapter) without complex setup.

Docker Setup and Configuration

We will provide a Docker configuration to facilitate deployment and running of the service in containerized environments. The Docker setup will be optimized for both development (if needed) and production usage.

Dockerfile:
We will use a multi-stage Dockerfile to keep the final image small and efficient. For example:

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci  # install dependencies
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build  # transpile TypeScript to JavaScript (outputs to /app/dist)

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
# Copy only the necessary files from build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
# Ideally, also copy package-lock and do a production install for only prod deps
COPY --from=builder /app/node_modules ./node_modules
# If using a separate step for prod deps:
# RUN npm ci --omit=dev

# Environment variables (if any default to set)
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]

Explanation:
	•	We start from a Node 20 Alpine image in the build stage. We copy package files and install dependencies (using npm ci for consistency with lock file). Then copy the source and compile with npm run build (which runs tsc).
	•	In the second stage, we use a fresh Node Alpine (for a clean environment with only needed files). We copy the built files (dist) and the node_modules (this copy might include dev deps; to optimize we could do a separate npm ci --only=prod, but given that we already have a full node_modules from builder, copying it is simpler; alternative is using npm prune --production).
	•	We set NODE_ENV=production for performance. Expose port 3000 (assuming our app listens on 3000 by default). The CMD runs the compiled app.

This yields a compact image that contains just the runtime code. We’ll ensure to .dockerignore unnecessary files (like not copy src to final, not include tests, etc.).

Docker Compose (for Dev):
We can include a docker-compose.yml to aid in local dev/testing with Docker. For example:

version: '3'
services:
  whatsapp-service:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./sessions_data:/app/sessions_data  # mount local volume for session persistence
      - ./logs:/app/logs  # if we log to files (optional)
    environment:
      - WEBHOOK_URL=http://host.docker.internal:4000/webhook  # example pointing to a local webhook tester
      - ENABLE_WEBHOOK=true
      - PORT=3000
      # (other config like API_KEY if used)

This allows a developer to run docker-compose up which builds the image and runs the container, with volumes so that session files persist on the host (and can be inspected). Also, it shows how to set env vars for configuration.

Environment Configuration:
We will use environment variables to configure the service at runtime, making it 12-factor compliant and easy to adjust in Docker. Key env vars include:
	•	PORT: which port the HTTP server should listen on (default 3000).
	•	WEBHOOK_URL: the common webhook endpoint to send events to. If not set, we might disable webhook sending (or require it, depending on design).
	•	ENABLE_WEBHOOK: a flag (true/false) to easily turn off webhook sending (perhaps default to true if URL is set).
	•	API_KEY: (Optional) if we want to secure the HTTP endpoints, we could require a custom header Authorization: Bearer <API_KEY> for all requests. This key would be set via env var. This was hinted in an example .env ￼. For now, this is optional but recommended for production use.
	•	LOG_LEVEL: (Optional) to control verbosity of logging (debug, info, error, etc.), default to info in production.
	•	SESSION_DIR: if we want to customize where session files are stored (default could be sessions_data). In Docker, we ensure this path is volume-mounted.
	•	RECONNECT_ATTEMPTS and RECONNECT_INTERVAL: to configure how the adapter retries on connection loss (e.g., 5 attempts, interval 5000ms as in example ￼).

These configurations will be documented. We will likely use dotenv to allow a .env file in development so that running via npm start locally picks them up.

Persistent Volume for Session Data:
As noted, the directory for session auth (sessions_data/) should be mapped to a volume in Docker deployments. In Kubernetes or other contexts, a persistent volume claim would be used similarly. This ensures that if the container restarts or is redeployed, it can load existing WhatsApp auth and not require re-scanning QR every time. We’ll document the need to mount this volume. If the service runs without a persistent volume, it will still function but sessions will reset on each restart (which is not ideal).

Docker Image Usage:
We will publish the image to Docker Hub (via CI). The usage might be as simple as:

docker run -d -p 3000:3000 -e WEBHOOK_URL=<your_url> -v $(pwd)/sessions_data:/app/sessions_data mydockeruser/whatsapp-service:latest

This would start the service in a container, listening on 3000, with a volume mounted for session data. Then the user could hit the endpoints as documented.

We will also ensure the base image is updated regularly for security (using a recent Node LTS) and minimize layers in the Dockerfile for quick builds.

CI/CD Automation (GitHub Actions)

To maintain code quality and expedite releases, we will set up GitHub Actions for continuous integration (CI) and continuous deployment (CD). The workflow will automatically run tests and build the project on each push, and on merges to main or version tags it will build & push the Docker image to Docker Hub.

CI Pipeline:
A GitHub Actions workflow (YAML under .github/workflows/ci-cd.yml) will be configured with roughly these steps:
	•	Trigger Conditions:
	•	On every push to any branch: run the CI (build & test) steps.
	•	Possibly on pull request creation as well: to ensure incoming contributions pass tests.
	•	On push to main (or a specific release branch) and on tagging a release (like pushing a git tag vX.Y.Z): run the full pipeline including Docker publish.
	•	Job: Build & Test:
	•	Checkout code: Use actions/checkout@v3 to get the repository code.
	•	Set up Node: Use actions/setup-node@v3 to install the appropriate Node.js (say version 20.x to match our dev environment). Possibly enable dependency caching for node_modules to speed up builds.
	•	Install Dependencies: Run npm ci to install. This ensures a clean, reproducible install based on package-lock.json.
	•	Type Check and Lint: Run npm run build (which invokes the TypeScript compiler) to catch any type errors. Also run npm run lint if we have an ESLint setup (likely we will, to enforce code style and catch code issues). This step ensures code meets our standards.
	•	Run Unit Tests: Run npm test which runs our Jest test suite. We will configure Jest in CI to produce a results report (and maybe coverage). The action can be set to fail if any test fails (exit code non-zero).
	•	These steps ensure that by the time we consider deploying, the code compiles and tests pass, aligning with preventing “broken windows” in code ￼.
	•	Job: Build & Push Docker (CD):
This can be either in the same workflow as above (but gated to only run on main/tag), or a separate job triggered after success of tests. We can have a condition like:

if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/')

to only run on main or tag. Steps in this job:
	•	Checkout (again, since each job is isolated unless we use artifacts).
	•	Set up Docker Buildx: Use docker/setup-buildx-action to enable multi-platform builds (if needed). Probably not needed if just building for linux/amd64 by default.
	•	Log in to Docker Hub: Use docker/login-action with credentials stored in GitHub Secrets (we will store DOCKERHUB_USERNAME and DOCKERHUB_TOKEN or password). This will allow pushing to our Docker repository.
	•	Build Image: Run docker build -t mydockeruser/whatsapp-service:latest . (and maybe also tag with the commit SHA or version). We might tag :latest for main and :vX.Y.Z for tags. For example, if building on a tag event v1.2.0, tag the image as mydockeruser/whatsapp-service:1.2.0 and also as latest. We can use the GitHub context to get either the tag or short commit.
	•	Push Image: docker push mydockeruser/whatsapp-service:latest (and the version tag if applied).
	•	Possibly, we will also consider multi-architecture builds (Linux amd64 vs arm64) if we want, but that could be added later.

	•	Notifications: If tests fail or deployment fails, we can have the workflow notify (e.g., via GitHub email or a Slack webhook if configured). This ensures issues are addressed promptly.

CI/CD Benefits:
Every code change goes through automated checks, ensuring that only tested, working code is deployed. Pushing the Docker image automatically saves time and avoids manual errors in the release process. This pipeline also makes it easy for other contributors to see if their changes break anything (PRs will show a failing status if so).

We will include the CI badge in the README for visibility. And in the project docs, explain how to set up the required secrets for Docker Hub. The Docker image on Docker Hub can then be pulled by users for deployment.

Development Tools and Libraries
To support our development and maintain code quality, we will utilize several tools and libraries:
	•	Web Framework: Express.js (with TypeScript typings) will serve as the HTTP server framework. Express is lightweight and familiar, making it easy to define REST routes and middleware. It integrates well with other libraries and has a large ecosystem. We will use express Router to organize endpoints (one router per controller).
	•	WhatsApp API Library: Baileys (@whiskeysockets/baileys) is the core library enabling WhatsApp connectivity. It’s a full-featured TypeScript library for WhatsApp Web API ￼. We rely on Baileys for low-level WhatsApp functions (connect, send, receive).
	•	TypeScript: We will use TypeScript for type safety, which helps catch errors early and serves as documentation for data structures (e.g., message and event models).
	•	HTTP Client: Axios for making outgoing HTTP requests to the webhook. Axios is promise-based and easy to use in TypeScript with typings available. Alternatively, node-fetch could be used for a lighter dependency. Either is fine; we lean towards Axios for familiarity and robust features (like interceptors, if needed for logging or retries).
	•	Logging: Pino or Winston will be used for logging. Pino is extremely fast and JSON-structured (good for production log aggregation), while Winston is flexible and good for formatted logs. The .env example showed Pino ￼, so we might choose Pino for performance. We will log key events (session start/stop, message sent, message received forwarded to webhook, errors, etc.). For development, we can set log level to ‘debug’ to see detailed info (like raw events coming from Baileys). In production, probably ‘info’ or ‘warn’.
	•	Data Validation: To enforce input schema for our API endpoints, we could use a library like Joi or zod to validate request bodies. However, since our controllers are simple and types are known, we might do manual checks or minimal validation (checking presence of required fields). Using a schema validation library can improve robustness (returning clear error messages if the client sends bad data). It’s a nice addition but not strictly required. If included, we define schemas for each endpoint input.
	•	QR Code Generation: qrcode npm library can convert a string to a QR code image or ASCII. This can be used to output the QR for a new session in a human-friendly way. For example, in dev mode we might do qrcode.generate(qrString, { small: true }); to log a small ASCII QR to the console. Or use qrcode.toDataURL(qrString) to get a base64 image if we ever want to send it via an API response.
	•	Testing Libraries: Jest for running tests, along with ts-jest for TS support. We will also use Supertest for HTTP integration tests. For mocking HTTP calls in tests, nock can intercept axios requests (for testing webhook calls). We might use sinon or Jest’s built-in mocking for stubbing functions like the Baileys adapter methods.
	•	Linting/Formatting: ESLint with a TypeScript plugin and maybe Prettier for code formatting. We will enforce coding standards (for example, no unused variables, consistent quotes/semi-colons, etc.) to keep the code clean. This also ties into “set the standards” from good architecture practices (ensuring code quality to reduce tech debt) ￼ ￼. The CI can run these linters.
	•	Dev Workflow: Nodemon can be used in development so that running npm run dev triggers automatic restarts on file changes. This speeds up testing changes with an active server. We’ll configure it to ignore the sessions_data folder to avoid restarting if auth files update.
	•	Source Control Hooks: (Optional) We can set up Husky to add git pre-commit or pre-push hooks to run tests or linting before code is committed/pushed, thus catching issues early.
	•	Documentation: For API documentation, we might use Swagger/OpenAPI by annotating our routes or writing an OpenAPI spec manually. At minimum, we’ll provide a detailed README with example requests and responses (possibly derived from our Postman collection). The Postman collection can be shared for developers to test the API easily.

By using these tools and libraries, we ensure a robust development environment and a high-quality codebase. Developers will find it easy to run and test the project, thanks to TypeScript’s clarity and the structured project layout. Automated checks (lint/test) and formatting will maintain consistency, and the chosen libraries (Express, Axios, Baileys, etc.) are well-supported and familiar to many, reducing the learning curve.

⸻

In conclusion, this implementation plan lays out a comprehensive approach to building the WhatsApp service with TypeScript. By adhering to clean architecture principles – dividing the system into clearly defined layers and modules – we achieve a design that is maintainable and scalable. Each requirement (multi-number support, persistent sessions, full message handling, webhook integration, Docker, CI/CD) is addressed with specific strategies and best practices. The result will be a well-organized codebase that is “inexpensive and painless to change” as new needs arise ￼, and a service that can be confidently deployed and extended in the future.
