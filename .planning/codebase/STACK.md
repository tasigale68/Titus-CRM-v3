# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- JavaScript (Node.js) - Server-side application logic, API routes, database operations

**Browser/Client:**
- HTML/CSS/JavaScript - Frontend UI, receipt scanner PWA, support worker portal

## Runtime

**Environment:**
- Node.js 20 (LTS)
  - Source: `Dockerfile` specifies `node:20-slim`
  - No `.nvmrc` or `.node-version` file; Dockerfile is source of truth

**Package Manager:**
- npm
  - Lockfile: `package-lock.json` present
  - Install: `npm install`
  - Production: `npm install --production` (used in Docker builds)

## Frameworks

**Core Web Framework:**
- Express.js 4.21.0 - HTTP server, routing, middleware
  - Entry point: `src/server.js`
  - Mounted route modules in `src/routes/`
  - Modular architecture: 16 route modules (auth, contacts, voice, scheduling, clients, recruitment, reports, email, lms, documents, tasks, compliance, receipts, leads, accommodation, budget, support-worker, admin)

**Real-Time Communication:**
- Socket.io 4.7.5 - WebSocket communication for live updates
  - Configured in `src/server.js` with CORS: `origin: '*'`
  - Used for call status updates, real-time notifications

**Database:**
- better-sqlite3 11.0.0 - Embedded SQLite database
  - WAL (Write-Ahead Logging) enabled for concurrency
  - Primary use: Users, sessions, calls, SMS logs, emails, audit logs, tasks, support tickets, incidents
  - Database file: `titus-voice.db` (location varies: Railway volume mount or local directory)
  - Migrations: Defined in `src/db/sqlite.js` (`migrate()` function)

**File Upload:**
- Multer 1.4.5-lts.1 - HTTP multipart form-data handling
  - Configs: `src/config/upload.js`
  - Multiple storage strategies: disk (templates, CVs, documents, knowledge base) and memory (general)
  - Upload directories: `./uploads/` (served statically)

**Document Processing:**
- pdf-parse 2.4.5 - PDF text extraction
- mammoth 1.11.0 - Word (.docx) document parsing
- sharp 0.34.5 - Image processing and optimization
  - Used in receipts module for image resizing
- pdfkit 0.17.2 - PDF generation

**Utilities:**
- dotenv 16.4.5 - Environment variable loading
- cors 2.8.5 - Cross-Origin Resource Sharing middleware
- uuid 13.0.0 - UUID generation for identifiers
- node-cron 4.2.1 - Scheduled task execution
- web-push 3.6.7 - Web push notifications (PWA)

## External SDK/Client Libraries

**Communications:**
- twilio 5.3.0 - Phone calls, SMS, WebRTC
  - Used in: Voice routes, recruitment module, call routing
  - Authentication: Account SID and Auth Token

**AI/ML:**
- Anthropic Claude API (via native fetch)
  - Models used:
    - `claude-sonnet-4-5` - CV scanning, ops reports, receipt OCR
    - `claude-haiku-4-5` - Receipt OCR fallback
  - Integration: Direct HTTP POST to `https://api.anthropic.com/v1/messages`
  - Authentication: Bearer token via `ANTHROPIC_API_KEY`

**Voice AI:**
- ElevenLabs ConvAI (via native fetch)
  - Agent: Denise (AI voice agent fallback)
  - Integration: Direct HTTP to `https://api.us.elevenlabs.io/v1/convai/conversations`
  - Authentication: Bearer token via `ELEVENLABS_API_KEY`
  - Webhook: POST `/api/voice/elevenlabs/post-call` for transcript delivery

**Email:**
- Microsoft Graph API (via native fetch)
  - Endpoints: `https://graph.microsoft.com/v1.0`
  - OAuth2 Client Credentials flow
  - Scope: `https://graph.microsoft.com/.default`
  - Purpose: Email sending, syncing from Outlook
  - Token caching: In-memory with 1-minute buffer before expiry

**CRM Database:**
- Airtable REST API (via native fetch)
  - Base ID: `appg3Cz7mEsGA6IOI` (Delta Community Support base)
  - Service: `src/services/airtable.js`
  - Rate limiting: 250ms between requests (4 req/sec)
  - Pagination: Automatic offset-based pagination
  - Batch operations: 10 records max per request
  - Tables: 28 tables (All Contacts, Clients, Progress Notes, Incidents, Rosters, Budgets, etc.)
  - Status: **Temporary** — Supabase migration planned in 4-6 weeks

## Configuration

**Environment Variables:**
- `AIRTABLE_API_KEY` - Airtable authentication
- `AIRTABLE_BASE_ID` - Base ID (default: appg3Cz7mEsGA6IOI)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID` - Twilio credentials and configuration
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` - ElevenLabs AI voice agent
- `ANTHROPIC_API_KEY` - Claude API access
- `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_EMAIL_ADDRESS` - Microsoft Graph OAuth
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `RAILWAY_VOLUME_MOUNT_PATH` - Production SQLite DB location (Railway persistent volume)
- `RAILWAY_STATIC_URL` - Production base URL for email links
- `BASE_URL` - Fallback base URL for webhooks/callbacks

**Centralized Config:**
- `src/config/env.js` - Loads and exports all environment variables with defaults

**File Upload Config:**
- `src/config/upload.js` - Multer storage strategies and middleware instances

## Database

**Primary (Temporary):**
- Airtable - All operational data (contacts, clients, rosters, progress notes, budgets, incidents, etc.)

**Secondary (Persistent):**
- SQLite (better-sqlite3)
  - Schema: 22 tables (users, sessions, calls, sms_messages, emails, audit_log, support_tickets, incidents, tasks, automation_settings, etc.)
  - WAL mode enabled for concurrent reads
  - Indices on: emails (from, to, conversation_id, received_at), audit_log (created_at, user_email, entity_type), support_tickets (status), incident_reports (status), stakeholder_access (token)

## Build & Deployment

**Docker:**
- Base image: `node:20-slim`
- Build: Install Python 3, make, g++ for `better-sqlite3` compilation
- Production: Multi-stage possible; currently single stage
- Entrypoint: `node src/server.js`
- Port: 3000 (exposed)
- Volume: `/app/titus-voice.db` (production SQLite storage via Railway)

**Deployment Platform:**
- Railway (auto-deploy on push to main)
- Health check: GET `/api/health`
- Start command: `node src/server.js`
- Restart policy: ON_FAILURE (max 3 retries)
- Static assets: Public files served from `./public/`

**Scripts:**
- `npm start` → `node src/server.js` (production)
- `npm run dev` → `node --watch src/server.js` (development auto-restart)

## Platform Requirements

**Development:**
- Node.js 20+
- Python 3 (for better-sqlite3 native compilation)
- build-essential (make, g++)
- npm 10+

**Production:**
- Node.js 20-slim Docker image
- Railway persistent volume (for SQLite database)
- Environment variables: Airtable, Twilio, ElevenLabs, Anthropic, Microsoft Graph credentials

## API Versions

**External APIs:**
- Anthropic: `anthropic-version: 2023-06-01`
- Microsoft Graph: `v1.0`
- ElevenLabs: Standard (no version header)
- Airtable: No versioning (REST API v0)
- Twilio: SDK v5.3.0

---

*Stack analysis: 2026-02-26*
