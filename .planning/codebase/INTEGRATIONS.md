# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**Voice & Communications:**
- **Twilio** - Phone calls, SMS, WebRTC browser dialer, call recording
  - SDK: `twilio` (v5.3.0)
  - Auth: Account SID + Auth Token
  - Env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`
  - Features:
    - Hunt group routing (sequential agent availability fallback)
    - Call recording with status callbacks
    - WebRTC token generation for browser dialer
    - TwiML App for call flow routing
  - Routes: `src/routes/voice/index.js` (primary integration)
  - Webhooks: Receives status callbacks for call state changes, recording completion
  - Usage: Core to DCS call operations and automated call routing

- **ElevenLabs** - AI voice agent ("Denise") for call fallback, post-call transcription
  - Auth: API Key via Bearer token
  - Env var: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`
  - Endpoints:
    - `https://api.us.elevenlabs.io/v1/convai/conversations` - Conversation listing/retrieval
    - `https://api.us.elevenlabs.io/v1/convai/conversations/{id}` - Get conversation details and transcript
    - `https://api.us.elevenlabs.io/v1/convai/conversations/{id}/audio` - Download call audio
    - `https://api.elevenlabs.io/twilio/inbound_call` - Twilio redirect endpoint for fallback routing
  - Webhook: Receives post-call webhook at `POST /api/voice/elevenlabs/post-call` with conversation ID
  - Features: Call transcription, conversation storage, audio retrieval
  - Fallback mechanism: Used when all hunt group members unavailable
  - Routes: `src/routes/voice/index.js`

**AI & Automation:**
- **Anthropic Claude API** - Operations reports, CV scanning, receipt OCR, AI chat
  - Endpoint: `https://api.anthropic.com/v1/messages`
  - Auth: Bearer token via header `x-api-key`
  - Env var: `ANTHROPIC_API_KEY`
  - Models used:
    - `claude-sonnet-4-5` - CV analysis, ops report generation, complex text analysis
    - `claude-haiku-4-5` - Receipt OCR, faster document analysis
  - Request format: JSON with `model`, `max_tokens`, `messages` array
  - Capabilities: Vision (image/PDF analysis), text analysis, report generation
  - Routes:
    - `src/routes/voice/index.js` - Call summary generation
    - `src/routes/recruitment/index.js` - CV scanning
    - `src/routes/receipts/index.js` - Receipt field extraction (supplier, amount, date, categories)
    - `src/routes/reports/index.js` - Ops report generation
  - Beta features: PDF analysis via `anthropic-beta: pdfs-2024-09-25` header

**CRM & Data:**
- **Airtable REST API** - Primary CRM database (temporary)
  - Base ID: `appg3Cz7mEsGA6IOI`
  - Endpoint: `https://api.airtable.com/v0/{baseId}/{table}`
  - Auth: Bearer token via header `Authorization: Bearer {API_KEY}`
  - Env var: `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`
  - Service: `src/services/airtable.js`
  - Rate limiting: 250ms between requests (4 req/sec max)
  - Pagination: Offset-based (`?pageSize=100&offset=...`)
  - Batch limits: 10 records per POST/PATCH/DELETE
  - Tables (28 total):
    - Core: All Contacts, Clients, Progress Notes, Incidents, Support Plans, Staff Availability
    - Scheduling: Rosters 2025, Roster of Care, Client Calendar, RoC Participants, RoC Shifts
    - Financial: Client Core Budgets, NDIS Items, Client Consumables
    - Properties: SIL Properties
    - Learning: Courses
    - Communications: Chat Conversations, Chat Members, Chat Messages, Employee Contact History, Client Contact History
    - Compliance: IR Reports 2025
    - Health: Client Sleep Chart, Bowel Chart, Fluid Intake Diary
    - Other: Client Media, Push Subscriptions, Messenger Knowledge Base, QR Code Data - Behaviours, Leads, Receipts
  - Status: **TEMPORARY** — Supabase migration planned in 4-6 weeks
  - Operations: CRUD (listRecords, getRecord, createRecords, updateRecords, deleteRecords)
  - Error handling: Automatic retry on 429 rate limit with 2s backoff

**Email:**
- **Microsoft Graph API** - Email sending, inbox sync, OAuth mailbox access
  - Tenant: OAuth 2.0 Client Credentials flow
  - Endpoint: `https://graph.microsoft.com/v1.0`
  - Auth: Client ID + Client Secret → Bearer token (cached for 55+ minutes)
  - Env vars: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_EMAIL_ADDRESS`
  - Scope: `https://graph.microsoft.com/.default`
  - Endpoints used:
    - `POST /users/{email}/sendMail` - Send email
    - `GET /me/messages` - List received emails
    - `GET /me/mailFolders/{id}/messages` - List folder messages
  - Service: `src/services/email.js`
  - Usage:
    - Welcome emails when users created (`sendWelcomeEmail()`)
    - Email syncing to `emails` table in SQLite
  - Routes: `src/routes/auth/index.js`, `src/routes/email/index.js`
  - Token refresh: Automatic with 1-minute expiry buffer

## Data Storage

**Databases:**
- **Airtable** (primary, temporary)
  - Provider: Cloud-based API
  - Connection: HTTP REST API
  - Client: Native fetch with custom rate limiting (`src/services/airtable.js`)
  - Purpose: All operational CRM data (contacts, clients, rosters, budgets, progress notes, incidents, courses, etc.)
  - Migration path: Supabase in 4-6 weeks

- **SQLite** (secondary, persistent)
  - Type: Embedded database
  - Client: better-sqlite3
  - Location: `titus-voice.db` (Railway volume mount in production, local dir in dev)
  - Purpose: Users, sessions, calls, SMS, emails, audit logs, tasks, tickets, incidents
  - Storage: WAL mode enabled
  - Indices: Created on high-query tables (emails, audit_log, support_tickets, incidents)

**File Storage:**
- **Local Filesystem** (only)
  - Upload directories: `./uploads/` (served statically via `express.static`)
  - Multer storage: Disk storage for templates, CVs, document scans, knowledge base
  - Location in Docker: `/app/uploads/` (ephemeral; not persisted in Railway)
  - Production limitation: Files not persisted between deployments; consider cloud storage (S3/Railway) for production

**Caching:**
- **In-Memory:**
  - Microsoft Graph token cache (expiry-based)
  - No Redis or memcached; suitable for single-instance deployment

## Authentication & Identity

**Internal Auth:**
- **Session-based (SQLite)**
  - Token: SHA-256 hashed password + session token in `users` table
  - Sessions: `sessions` table (token → user_id)
  - Auth header: `x-auth-token` or cookie `authToken`
  - Password reset: Reset codes with expiry time
  - Roles: superadmin, director, admin, team_leader, roster_officer, manager, ceo, office_staff, support_worker
  - Middleware: `src/middleware/auth.js` (`authenticate()`, `requireRole()`)

**Support Worker Portal:**
- **OTP-based Auth** (separate from main portal)
  - OTP table: `sw_otp` (email, code, attempts, expiry)
  - Session table: `sw_sessions` (token → sw_user_id)
  - User table: `sw_users` (separate from main users)
  - Routes: `src/routes/support-worker/index.js`

**External Auth Providers:**
- **Twilio** - API credentials (no user sign-up flow)
- **ElevenLabs** - API credentials
- **Anthropic Claude** - API credentials
- **Microsoft Graph** - OAuth 2.0 Client Credentials (server-to-server)
  - No user-facing OAuth flow; service account only

**Token/Credential Management:**
- All credentials loaded from environment variables
- No secrets in code or `.env` file (`.env` is in `.gitignore`)
- Token caching: MS Graph token cached in memory with auto-refresh

## Monitoring & Observability

**Error Tracking:**
- Not detected - No external error tracking service (Sentry, etc.) integrated

**Logging:**
- **Console-based** (`console.log`, `console.error`)
  - Call status updates: `[VOICE]` prefix
  - Email operations: `[WELCOME]`, `[EMAIL]` prefixes
  - Database operations: Inline error logs
  - No external logging (CloudWatch, DataDog, etc.)
  - Suggestion: Add structured logging for production use

**Audit Trail:**
- **SQLite `audit_log` table**
  - Tracks: user_id, email, action, entity_type, entity_id, field changes
  - Indexed: created_at, user_email, entity_type
  - Used by: Compliance, user activity tracking

**Health Check:**
- **Endpoint:** `GET /api/health`
  - Response: `{ status: 'ok', version: '2.0.0', timestamp: ISO8601 }`
  - Railway: Used for deployment health verification (30s timeout)

## CI/CD & Deployment

**Hosting:**
- Railway (PaaS)
  - Auto-deploy on push to main branch
  - Docker-based deployment
  - Persistent volume: For SQLite database storage
  - Environment variables: Managed via Railway dashboard

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or equivalent
  - Direct push-to-deploy via Railway

**Build:**
- Dockerfile: Multi-stage capable, currently single stage
- Docker commands:
  - Build: `docker build -t titus-crm .`
  - Node 20-slim image + Python 3, make, g++ for native modules
  - Production installs: `npm install --production`

## Webhooks & Callbacks

**Incoming Webhooks (Callbacks from External Services):**

- **Twilio Call Status Callbacks**
  - Endpoint: `POST /api/voice/webhook/status`
  - Body: Call metadata (CallSid, CallStatus, From, To, Duration, RecordingSid)
  - Triggers: Call state changes (initiated, ringing, in-progress, completed)
  - Processing: Updates `calls` table, triggers recording fetch

- **Twilio Recording Status Callback**
  - Endpoint: `POST /api/voice/webhook/recording`
  - Body: Recording metadata (CallSid, RecordingSid, RecordingUrl, RecordingStatus)
  - Triggers: After call recording completes
  - Processing: Fetches recording, stores URL, triggers transcript fetch

- **Twilio Hunt Group Step Routing**
  - Endpoint: `POST /api/voice/webhook/hunt-step`
  - Query params: `callSid`, `step`, `from`
  - Triggers: Sequential routing through hunt group members
  - Processing: Routes to next available member or fallback to ElevenLabs

- **ElevenLabs Post-Call Webhook**
  - Endpoint: `POST /api/voice/elevenlabs/post-call`
  - Headers: `elevenlabs-signature` (webhook verification)
  - Body: Conversation ID, metadata
  - Triggers: After ElevenLabs AI agent completes call
  - Processing: Fetches transcript, stores in `calls` table

**Outgoing Webhooks (Callbacks to External Services):**
- **Twilio Callbacks:**
  - Call status: Sent to `/api/voice/webhook/status`
  - Recording status: Sent to `/api/voice/webhook/recording`
  - These are configured via TwiML callbacks in outbound calls
  - Base URL: Constructed from `BASE_URL` or `RAILWAY_STATIC_URL` environment variable

**Webhook Security:**
- Recording callback URL pattern: `{BASE_URL}/api/voice/webhook/recording`
- Hunt group redirect: TwiML POST method (secure via Bearer token in request)
- ElevenLabs: Signature verification via `elevenlabs-signature` header (implementation in route)

## Environment Configuration

**Required Environment Variables (Production):**
- `AIRTABLE_API_KEY` - Airtable authentication
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio API authentication
- `TWILIO_PHONE_NUMBER` - Incoming/outgoing phone number
- `TWILIO_API_KEY` - Twilio API key (separate from auth token)
- `TWILIO_API_SECRET` - Twilio API secret
- `TWILIO_TWIML_APP_SID` - TwiML app identifier
- `ELEVENLABS_API_KEY` - ElevenLabs authentication
- `ELEVENLABS_AGENT_ID` - AI agent ID
- `ANTHROPIC_API_KEY` - Claude API key
- `MS_TENANT_ID` - Microsoft Azure tenant ID
- `MS_CLIENT_ID` - Microsoft app client ID
- `MS_CLIENT_SECRET` - Microsoft app secret
- `MS_EMAIL_ADDRESS` - Service account email (for sendMail on behalf of)
- `PORT` - HTTP port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `RAILWAY_VOLUME_MOUNT_PATH` - SQLite persistent storage path (Railway)
- `RAILWAY_STATIC_URL` - Public URL for webhook callbacks (Railway)

**Optional Environment Variables:**
- `AIRTABLE_BASE_ID` - Airtable base (default: appg3Cz7mEsGA6IOI)
- `BASE_URL` - Fallback webhook callback URL

**Secrets Management:**
- Stored in: Railway environment variables (dashboard)
- Never committed: `.env` is in `.gitignore`
- `.env.example` provided as template

**Local Development:**
- Create `.env` file from `.env.example`
- Fill in local/sandbox credentials
- `dotenv` package loads at runtime

## Integration Status & Roadmap

**Stable/Production:**
- Twilio (calls, SMS, WebRTC) - Fully operational
- Microsoft Graph (email) - Fully operational
- Anthropic Claude (reports, OCR, analysis) - Fully operational
- ElevenLabs (AI voice agent) - Fully operational
- SQLite (local persistence) - Fully operational

**Temporary (Migration Planned):**
- Airtable (CRM database) - **Supabase migration in 4-6 weeks**
  - Reason: Airtable rate limits, cost, need for full SQL control
  - Migration approach: Parallel running, gradual data sync, cutover

**Not Yet Integrated:**
- Cloud file storage (S3, Azure Blob) - Currently local filesystem only
- External error tracking (Sentry) - Console logging only
- Analytics (Mixpanel, Segment) - Not integrated
- APM (New Relic, DataDog) - Console logging only

---

*Integration audit: 2026-02-26*
