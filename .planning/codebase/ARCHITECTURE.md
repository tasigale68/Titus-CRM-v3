# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Modular Express backend with layered API-driven design using service layer pattern.

**Key Characteristics:**
- Centralized entry point (`src/server.js`) mounting 16 domain-specific route modules
- Three-tier data layer: Airtable (primary CRM), SQLite (legacy/local state), external APIs (Twilio, ElevenLabs, Claude)
- Authentication and authorization via session tokens with role-based access control
- Socket.io for real-time updates
- Service layer for cross-cutting concerns (Airtable access, audit logging, permissions, email)

## Layers

**Presentation & Routing (`src/routes/`):**
- Purpose: Handle HTTP requests, validate input, orchestrate service calls, return JSON
- Location: `src/routes/*/index.js` (16 domain modules)
- Contains: Express route handlers, request validation, response formatting
- Depends on: Middleware (auth, error), services (airtable, audit, permissions), config, db
- Used by: Express app, clients via HTTP/REST, frontend served from `public/`

**Middleware (`src/middleware/`):**
- Purpose: Cross-cutting HTTP concerns (authentication, error handling)
- Location: `src/middleware/auth.js`, `src/middleware/error-handler.js`
- Contains: Auth token validation, role-based access control, error formatting
- Depends on: SQLite database, crypto utilities
- Used by: All authenticated routes, global error handler

**Service Layer (`src/services/`):**
- Purpose: Encapsulate external API interactions and business logic
- Location: `src/services/airtable.js`, `src/services/email.js`, `src/services/audit.js`, `src/services/permissions.js`, `src/services/roc-rates.js`
- Contains: Airtable CRUD with rate limiting, Microsoft Graph email, audit logging, permissions calculation
- Depends on: Config, database, external API clients
- Used by: Route handlers throughout the codebase

**Data Layer (`src/db/`, `src/config/`):**
- Purpose: Persistent storage and configuration management
- Location: `src/db/sqlite.js` (SQLite connection and schema), `src/config/env.js` (environment variables)
- Contains: Database connection, migrations, schema definition, centralized env var access
- Depends on: Environment, better-sqlite3 driver
- Used by: Middleware (auth), services (audit), all route modules

**Entry Point & Server Setup (`src/server.js`):**
- Purpose: Initialize Express app, mount all routes, set up middleware pipeline, start HTTP/Socket.io server
- Location: `src/server.js`
- Triggers: `npm start` or `npm run dev`
- Responsibilities: Load env, run migrations, seed users, mount CORS and body parsing, serve static files, attach Socket.io

## Data Flow

**Authentication & Authorization Flow:**

1. Client sends POST `/api/auth/login` with email and password
2. `src/routes/auth/index.js` validates credentials against `users` table in SQLite
3. On success: generate 32-byte hex token, create session record, return token + user object with permissions
4. Client stores token in localStorage, sends as `Authorization: Bearer {token}` header on subsequent requests
5. `authenticate` middleware (via `src/middleware/auth.js`) validates token by joining sessions + users tables
6. `requireRole()` checks if user's role is in allowed list
7. Request proceeds with `req.user` populated with session data (id, email, name, role, permissions)

**Airtable Data Sync Flow:**

1. Route handler (e.g., `/api/contacts`) calls `airtable.listRecords(tableName, params)`
2. `src/services/airtable.js` implements rate limiting (250ms between requests = 4 req/sec)
3. Handles pagination automatically (follows `offset` cursors)
4. Maps Airtable field names to app schema (e.g., `Full Name` → `name`)
5. Returns normalized array of records to route handler
6. Route returns JSON to client

**Audit Logging Flow:**

1. Service or route handler calls `logAudit(user, action, entityType, entityId, entityLabel, fieldName, oldValue, newValue)`
2. `src/services/audit.js` extracts user info from context
3. Inserts record into `audit_log` table with standardized schema
4. Logs are queryable via `/api/admin` routes for compliance

**State Management:**

- **Session state:** SQLite `sessions` table (token → user_id mapping). Ephemeral, no persistence on server restart.
- **User data:** SQLite `users` table (roles, permissions). Seeded on startup with admin users.
- **CRM data:** Airtable (contacts, clients, rosters, budgets, progress notes, etc.). Primary source of truth. Migrations to Supabase planned.
- **Operational data:** SQLite (calls, SMS, emails, audit log, support tickets, incidents). Used for low-velocity local storage, audit trails.
- **Real-time updates:** Socket.io (in-memory connection state). No persistence, broadcast to connected clients on room join.

## Key Abstractions

**Airtable Client (`src/services/airtable.js`):**
- Purpose: Unified interface to Airtable REST API with built-in rate limiting and error retry
- Examples: `listRecords()`, `getRecord()`, `createRecords()`, `updateRecords()`, `deleteRecords()`
- Pattern: Async/await with fetch, manual rate limit queue, automatic pagination

**Permissions Engine (`src/services/permissions.js`):**
- Purpose: Centralized RBAC with role-based defaults + per-user overrides
- Examples: `getDefaultPermissions(role)`, `getUserPermissions(user)`, `isSeniorRole(user)`
- Pattern: Role name → permission object mapping. Define PERMISSION_KEYS array (40+ keys). Superadmin = edit all, Director = edit except admin, Support Worker = view + my_details edit.

**Audit Logger (`src/services/audit.js`):**
- Purpose: Immutable audit trail for compliance (NDIS requirements)
- Examples: `logAudit(user, action, entityType, entityId, entityLabel, fieldName, oldValue, newValue)`
- Pattern: Synchronous inserts into `audit_log` table. Catches exceptions to prevent breaking main flow.

**Session-Based Auth (`src/middleware/auth.js`):**
- Purpose: Token validation and request context enrichment
- Pattern: Token → session.token lookup → join with users → attach to req.user

**Error Handler (`src/middleware/error-handler.js`):**
- Purpose: Centralized error response formatting
- Pattern: Check err.status; if present, return that status + message; else return 500

## Entry Points

**HTTP Server (`src/server.js`):**
- Location: `src/server.js`
- Triggers: `node src/server.js` or `npm start`
- Responsibilities: Initialize Express, load config, run DB migrations, seed admin users, mount 16 route modules, attach Socket.io, listen on port 3000

**API Routes:**
- `/api/auth` → `src/routes/auth/index.js` (login, logout, password reset)
- `/api/contacts` → `src/routes/contacts/index.js` (CRM contact CRUD, maps Airtable)
- `/api/voice` → `src/routes/voice/index.js` (Twilio call routing, ElevenLabs fallback)
- `/api/scheduling` → `src/routes/scheduling/index.js` (Rosters, shifts, RoC)
- `/api/clients` → `src/routes/clients/index.js` (Client profiles, budgets)
- `/api/recruitment` → `src/routes/recruitment/index.js` (HR pipeline, CV scan)
- `/api/reports` → `src/routes/reports/index.js` (Ops reports, stakeholder reports via Claude AI)
- `/api/email` → `src/routes/email/index.js` (MS Graph email sync)
- `/api/lms` → `src/routes/lms/index.js` (Learning management)
- `/api/documents` → `src/routes/documents/index.js` (Signing, scanning)
- `/api/tasks` → `src/routes/tasks/index.js` (Tasks, projects)
- `/api/compliance` → `src/routes/compliance/index.js` (Audit log, incidents, support tickets)
- `/api/receipts` → `src/routes/receipts/index.js` (Receipt upload and OCR)
- `/api/leads` → `src/routes/leads/index.js` (Lead management)
- `/api/accommodation` → `src/routes/accommodation/index.js` (SIL properties)
- `/api/budget` → `src/routes/budget/index.js` (NDIS budget tracking)
- `/api/support-worker` → `src/routes/support-worker/index.js` (Support worker PWA with OTP auth)
- `/api/admin` → `src/routes/admin/index.js` (User management, system settings)

**Health Check:**
- `/api/health` (GET) → Returns `{ status: 'ok', version: '2.0.0', timestamp: ISO string }`

**Static Files:**
- `/` → Serves `public/index.html` (main SPA)
- `/uploads` → Serves uploaded files from `uploads/` directory
- Other files in `public/` (manifest, HTML templates, JS)

## Error Handling

**Strategy:** Synchronous error handler at route level + global middleware error handler.

**Patterns:**
- Route handlers wrap async Airtable calls in try/catch or .catch() chaining
- Errors with explicit `status` property (e.g., `err.status = 401`) return that status code
- Unhandled errors log to console and return 500
- Validation errors caught at route entry, return 400 with descriptive message
- External API failures (Airtable, Twilio, Claude) logged; caller decides retry behavior

## Cross-Cutting Concerns

**Logging:**
- Console.log for operational events (startup, route calls, Airtable rate limiting, Twilio setup)
- Structured audit_log table for compliance (who did what, when)

**Validation:**
- Route level (missing fields → 400 response)
- Airtable field mapping (retry if unknown field, strip and retry)
- No centralized validation schema

**Authentication:**
- Token-based sessions stored in SQLite
- Role-based access control via middleware `requireRole()` guard
- Support worker portal uses separate OTP-based auth (src/routes/support-worker)

**Rate Limiting:**
- Airtable client enforces 4 requests/second (250ms between calls)
- Automatic retry on 429 (rate limited) responses
- No API-level rate limiting on server endpoints

---

*Architecture analysis: 2026-02-26*
