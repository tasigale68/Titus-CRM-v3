# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
titus-crm/
├── src/                           # Backend Express application
│   ├── server.js                  # Entry point — mounts all routes, Socket.io setup
│   ├── config/
│   │   ├── env.js                 # Centralized environment variable exports
│   │   └── upload.js              # Multer file upload configurations
│   ├── db/
│   │   └── sqlite.js              # SQLite connection, migrations, schema
│   ├── middleware/
│   │   ├── auth.js                # Token validation, role guards
│   │   └── error-handler.js       # Global error response formatting
│   ├── services/
│   │   ├── airtable.js            # Airtable REST API client with rate limiting
│   │   ├── email.js               # Microsoft Graph email sync
│   │   ├── audit.js               # Audit logging to SQLite
│   │   ├── permissions.js         # Role-based permission engine
│   │   └── roc-rates.js           # Roster of Care rate calculations
│   └── routes/                    # 16 domain-specific API modules
│       ├── auth/                  # Login, logout, password reset
│       ├── contacts/              # CRM contact CRUD (Airtable-backed)
│       ├── voice/                 # Twilio call routing, ElevenLabs fallback
│       ├── scheduling/            # Rosters, shifts, RoC
│       ├── clients/               # Client profiles, budgets, progress notes
│       ├── recruitment/           # HR pipeline, CV scan, referee calls
│       ├── reports/               # Ops reports, stakeholder reports (Claude AI)
│       ├── email/                 # MS Graph email sync
│       ├── lms/                   # Learning management system
│       ├── documents/             # Document signing, scanning
│       ├── tasks/                 # Tasks and projects
│       ├── compliance/            # Audit log, incidents, support tickets
│       ├── receipts/              # Receipt upload and OCR
│       ├── leads/                 # Lead management
│       ├── accommodation/         # SIL properties
│       ├── budget/                # NDIS budget tracking
│       ├── support-worker/        # Support worker PWA (OTP auth)
│       ├── admin/                 # User management, system settings
│       └── chat/                  # Chat/messenger features
├── public/                        # Static frontend files (SPA + HTML templates)
│   ├── index.html                 # Main SPA entry point (2MB+ compiled bundle)
│   ├── admin/                     # Admin portal pages
│   ├── messenger/                 # Messenger PWA files (chat.js, app.js, sw.js)
│   ├── manifest.json              # PWA manifest
│   ├── agreements.html            # Service agreements template
│   ├── lms.html                   # LMS interface
│   ├── roster-calculator.html     # Roster calc UI
│   ├── receipt-form.html          # Receipt upload form
│   ├── stakeholder-portal.html    # Stakeholder dashboard
│   ├── lms-training.html          # Training module
│   ├── lms-course.html            # Course viewer
│   ├── invoices.html              # Invoice portal
│   ├── privacy.html               # Privacy policy
│   ├── sign.html                  # Document signing UI
│   ├── client-budget.jsx          # Client budget component
│   └── images/                    # Logo, icons, backgrounds
├── uploads/                       # Runtime directory for uploaded files
│   ├── receipts/                  # Receipt PDFs
│   ├── documents/                 # Signed documents
│   └── ...
├── titus-voice.db                 # SQLite database file (local; Railway uses volume mount)
├── .env.example                   # Environment variable template
├── package.json                   # NPM dependencies, scripts
├── Dockerfile                     # Container build config
└── CLAUDE.md                      # This file — project context for Claude
```

## Directory Purposes

**`src/`:**
- Purpose: Express backend application code
- Contains: Routes, middleware, services, database, configuration
- Key files: `server.js` (entry point), config subdirs, route modules

**`src/config/`:**
- Purpose: Centralized environment and file upload configuration
- Contains: `env.js` (exports all env vars), `upload.js` (Multer configs)
- Key files: `env.js` loads `.env` via dotenv, exports structured config object

**`src/db/`:**
- Purpose: SQLite database connection and schema management
- Contains: Database connection object, migration function
- Key files: `sqlite.js` (better-sqlite3 initialization, CREATE TABLE statements)

**`src/middleware/`:**
- Purpose: Express middleware for authentication and error handling
- Contains: Auth guards, role checks, error formatting
- Key files: `auth.js` (token validation, requireRole), `error-handler.js` (500 handler)

**`src/services/`:**
- Purpose: Shared business logic and external API clients
- Contains: Airtable CRUD, email sync, audit logging, permission calculation
- Key files:
  - `airtable.js` - Rate-limited Airtable REST client
  - `email.js` - Microsoft Graph email sync
  - `permissions.js` - RBAC engine with 40+ permission keys
  - `audit.js` - Immutable audit trail logger
  - `roc-rates.js` - RoC hourly rate calculations

**`src/routes/`:**
- Purpose: API endpoint handlers grouped by domain
- Contains: 16 Express route modules, each with its own handlers
- Pattern: Each subdirectory has `index.js` with one or more route handlers

**`public/`:**
- Purpose: Static frontend served by Express
- Contains: Compiled React/Vue SPA, HTML templates, service workers, manifests
- Key files:
  - `index.html` - Main SPA (2MB+, contains entire admin frontend)
  - `messenger/` - Chat app PWA (client-side)
  - `admin/` - Additional admin screens
  - HTML templates for reports, documents, etc.

**`uploads/`:**
- Purpose: Runtime directory for user-uploaded files
- Generated: Yes (created by file upload handlers)
- Committed: No

## Key File Locations

**Entry Points:**
- `src/server.js` - HTTP server startup, route mounting, Socket.io initialization
- `public/index.html` - Frontend SPA main entry
- `src/config/env.js` - Environment variable loader

**Configuration:**
- `src/config/env.js` - Centralized env var access (Airtable, Twilio, Claude, Azure)
- `src/config/upload.js` - Multer file upload configs (size limits, storage paths)
- `.env` - Runtime environment variables (not committed, use `.env.example` as template)
- `.env.example` - Environment variable template (AIRTABLE_API_KEY, TWILIO_ACCOUNT_SID, etc.)

**Core Authentication:**
- `src/middleware/auth.js` - `authenticate` middleware, `requireRole()`, `hashPassword()`, `seedUsers()`
- `src/routes/auth/index.js` - Login, logout, password reset endpoints

**Core Permissions & RBAC:**
- `src/services/permissions.js` - Role definitions, permission defaults, per-user overrides

**Core Audit & Logging:**
- `src/services/audit.js` - `logAudit()` function, logs to SQLite `audit_log` table
- Route handlers call `logAudit()` after mutations (create, update, delete)

**Primary Data Access:**
- `src/services/airtable.js` - `listRecords()`, `getRecord()`, `createRecords()`, `updateRecords()`, etc.
- `src/db/sqlite.js` - SQLite connection, all schema definitions

**Testing (if present):**
- Not detected in this codebase. No test files or test directory found.

## Naming Conventions

**Files:**
- Entry points: `index.js` (route modules, e.g., `src/routes/auth/index.js`)
- Services: `service-name.js` in `src/services/` (e.g., `airtable.js`, `audit.js`)
- Middleware: `middleware-name.js` in `src/middleware/` (e.g., `auth.js`, `error-handler.js`)
- Routes: Grouped by domain in subdirectories (auth, contacts, voice, etc.)
- Config files: `env.js`, `upload.js` in `src/config/`
- Database: `sqlite.js` in `src/db/`

**Variables & Functions:**
- camelCase for variables, functions: `listRecords`, `logAudit`, `requireRole`
- UPPERCASE for constants: `AIRTABLE_TABLE_NAME`, `RATE_LIMIT_MS`, `SALT`
- Underscore_snake_case for database column names: `user_id`, `created_at`, `password_hash`
- Single letter for iterators: `f` for fields, `p` for prefixes, `i` for index

**Directories:**
- kebab-case for route domains: `support-worker`, `accommodation`, `lms`
- lowercase for generic dirs: `config`, `db`, `middleware`, `services`, `routes`

## Where to Add New Code

**New Feature (new domain):**
1. Create directory under `src/routes/{feature-name}/`
2. Create `src/routes/{feature-name}/index.js` with Express router
3. Import and mount in `src/server.js` with line like `app.use('/api/{feature-name}', require('./routes/{feature-name}'));`
4. If feature uses Airtable, call existing `airtable.listRecords()` or similar from `src/services/airtable.js`
5. For mutations, call `logAudit(req.user, 'create', 'EntityType', recordId, ...)` from `src/services/audit.js`

**New Service/Utility:**
- Location: `src/services/{service-name}.js`
- Pattern: Export functions/classes, import via `const srv = require('../../services/{service-name}')`
- Use cases: External API clients, calculation engines, data transformers

**Permission-Gated Routes:**
- Use middleware: `router.get('/admin-only', authenticate, requireRole('superadmin'), handler)`
- Or check in handler: `if (!isSeniorRole(req.user)) return res.status(403).json({ error: 'Denied' });`

**Database Queries:**
- Use `const { db } = require('../../db/sqlite')` to access connection
- Use `db.prepare(sql).get(params)` or `.all()` or `.run(params)`
- Create new migrations in `src/db/sqlite.js` by adding CREATE TABLE in `migrate()` function

**File Uploads:**
- Use Multer middleware from `src/config/upload.js`
- Store in `uploads/{domain}/` directory
- Update `src/server.js` static serve rule if new upload type

**Configuration:**
- Add new env var to `src/config/env.js`, not hardcoded in routes
- Update `.env.example` with example value and comment
- Access via `const env = require('../../config/env'); env.service.property`

## Special Directories

**`uploads/`:**
- Purpose: Runtime user-uploaded files (receipts, documents, etc.)
- Generated: Yes (created by Express on first file upload)
- Committed: No (in .gitignore)

**`node_modules/`:**
- Purpose: npm dependency packages
- Generated: Yes (`npm install`)
- Committed: No (in .gitignore)

**`.planning/codebase/`:**
- Purpose: GSD mapping documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by /gsd:map-codebase command)
- Committed: Yes (guidance docs for future Claude instances)

**`public/admin/`:**
- Purpose: Admin portal additional pages
- Generated: No (checked in)
- Committed: Yes (compiled frontend)

**`public/messenger/`:**
- Purpose: Messenger PWA service worker and client code
- Generated: No (checked in)
- Committed: Yes (compiled/bundled from monolith migration)

## Import Patterns

**Standard pattern from routes:**
```javascript
const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');
const { db } = require('../../db/sqlite');
const { logAudit } = require('../../services/audit');
const airtable = require('../../services/airtable');
const env = require('../../config/env');

const router = express.Router();
router.use(authenticate);  // Require auth for all endpoints
```

**Service usage:**
```javascript
const airtable = require('../../services/airtable');
const records = await airtable.listRecords('Contacts', { maxRecords: 100 });
```

**Audit logging pattern:**
```javascript
logAudit(req.user, 'create', 'Contact', recordId, 'John Doe', 'email', '', 'john@example.com');
```

---

*Structure analysis: 2026-02-26*
