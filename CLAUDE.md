# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Titus CRM is an AI-powered operations platform for **Delta Community Support (DCS)**, an NDIS disability services provider in Brisbane, AU. This is a modular rewrite of the original Titus Voice monolith (17,000+ line single-file Express app).

## Commands

- **Start server:** `npm start` (runs `node src/server.js` on port 3000)
- **Dev mode:** `npm run dev` (auto-restart with `--watch`)
- **Install deps:** `npm install` (requires Python 3, make, g++ for better-sqlite3)
- **Docker build:** `docker build -t titus-crm .`

## Architecture

### Modular Express backend

```
src/
├── server.js              # Entry point — mounts all route modules
├── config/
│   ├── env.js             # Environment variables (centralized)
│   └── upload.js          # Multer file upload configs
├── db/
│   └── sqlite.js          # SQLite connection + migrations (legacy)
├── middleware/
│   ├── auth.js            # Session auth, role guards
│   └── error-handler.js   # Global error handler
├── services/
│   ├── airtable.js        # Airtable CRUD with rate limiting
│   ├── supabase.js        # Supabase service layer (mirrors airtable.js)
│   └── database.js        # Toggle: reads DATABASE env var, exports airtable or supabase
└── routes/
    ├── auth/              # Login, logout, session management
    ├── contacts/          # CRM contacts (Airtable)
    ├── voice/             # Twilio calls, SMS, ElevenLabs webhooks
    ├── scheduling/        # Rosters, shifts, roster of care
    ├── clients/           # Client profiles, budgets, progress notes
    ├── recruitment/       # HR pipeline, CV scan, referee calls
    ├── reports/           # Ops reports, stakeholder reports (Claude AI)
    ├── email/             # Microsoft Graph email integration
    ├── lms/               # Learning management system
    ├── documents/         # Signing, scanning, agreements
    ├── tasks/             # Tasks and projects (SQLite)
    ├── compliance/        # Audit log, incidents, tickets
    ├── receipts/          # Receipt upload and OCR
    ├── leads/             # Lead management
    ├── accommodation/     # SIL properties
    ├── budget/            # NDIS budget tracking
    └── support-worker/    # Support worker PWA (OTP auth)
```

### Data layer

- **Airtable** — CRM database (legacy). Base ID: `appg3Cz7mEsGA6IOI`. Stores contacts, clients, rosters, budgets, progress notes, incidents, courses, etc.
- **Supabase** — migration target. Set `DATABASE=supabase` to switch. Schema in `scripts/schema.sql`. All routes import from `src/services/database.js` which toggles based on `DATABASE` env var.
- **SQLite** (`better-sqlite3`, WAL mode) — local data: users, sessions, calls, SMS, audit logs. DB path uses `RAILWAY_VOLUME_MOUNT_PATH` in production.

### External integrations

- **Twilio** — calls (hunt group routing), SMS, WebRTC browser dialer, recording
- **ElevenLabs** — AI voice agent ("Denise") fallback, post-call transcripts
- **Anthropic Claude API** — ops reports, CV scanning, receipt OCR, AI chat, compliance scanning
- **Microsoft Graph** — email sync and sending (OAuth client credentials)
- **Airtable REST API** — all CRM data with pagination and rate limiting

### Authentication

Session-based auth using SQLite. SHA-256 password hashing. Token from `x-auth-token` header or `authToken` cookie. Roles: superadmin, director, admin, team_leader, roster_officer, manager, ceo, office_staff, support_worker. Support worker PWA uses separate OTP-based auth.

### Key domain concepts

- **NDIS** — National Disability Insurance Scheme (Australian)
- **SIL** — Supported Independent Living (24/7 residential)
- **CAS** — Community Access Support
- **SOS** — Schedule of Support (funding document)
- **Hunt groups** — Sequential call routing to available staff before AI fallback
- **RoC** — Roster of Care

### Deployment

Production on **Railway** (auto-deploy on push to main). Uses Railway persistent volume for SQLite.

## Environment Variables

See `.env.example` for the full list.

## Database Migration (Airtable → Supabase)

Toggle via `DATABASE` env var: `airtable` (default) or `supabase`. All route modules import from `src/services/database.js`. Migration scripts in `scripts/`. See `MIGRATION_REPORT.md` for full details.

```bash
npm run migrate:supabase    # One-time data migration
npm run sync:start          # 5-minute sync bridge
npm run worker              # Background sync process
```

## Migration from Titus Voice

This project replaces `~/Titus-Voice-version-2-/`. Route stubs marked with `// TODO: migrate` are ready for logic to be ported from the original `server/index.js`. Each route module is self-contained — migrate one domain at a time.

## Active Skills

Claude Code skills are installed in `.claude/skills/` and auto-activate based on context. Available skills:

| Skill | Description | Use When |
|-------|-------------|----------|
| **ui-ux-pro-max** | Design intelligence with BM25 search across styles, palettes, fonts, UX guidelines | UI/UX redesigns, design system generation, accessibility audits |
| **awesome-claude-code** | Curated Claude Code ecosystem knowledge + repo security evaluation | Evaluating new skills/plugins, finding community tools |
| **n8n-mcp** | MCP server bridging n8n workflow automation with AI assistants | Building automation workflows, n8n integration |
| **remotion** | Programmatic video creation with React (9 sub-skills) | Video generation, motion graphics, automated media |
| **cookbook-audit** | Anthropic cookbook notebook review rubric and scoring | Reviewing Jupyter notebooks against style guide |
| **financial-models** | DCF analysis, Monte Carlo simulation, sensitivity testing, scenario planning | Investment analysis, valuations, risk assessment |
| **financial-statements** | Financial ratio calculator (profitability, liquidity, leverage, valuation) | Analyzing company financials, ratio analysis |
| **brand-guidelines** | Corporate branding standards for documents (colors, fonts, layouts) | Generating branded reports, presentations, PDFs |

### Workflow System

**Get Shit Done (GSD)** is installed globally at `~/.claude/get-shit-done/`. Use `/gsd:help` for available commands including project planning, phase execution, codebase mapping, and debugging workflows.
