# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Titus CRM is a **multi-tenant SaaS platform** for NDIS, aged care, and community service providers in Australia. Built for Delta Community Support (DCS) as the first tenant, now available to any NDIS provider.

## Commands

- **Start server:** `npm start` (runs `node src/server.js` on port 3000)
- **Dev mode:** `npm run dev` (auto-restart with `--watch`)
- **Install deps:** `npm install` (requires Python 3, make, g++ for better-sqlite3)
- **Docker build:** `docker build -t titus-crm .`
- **Run Supabase schema:** `psql $DATABASE_URL < scripts/saas-schema.sql`

## Architecture

### Multi-Tenant SaaS

- Each organisation gets a slug: `tituscrm.com.au/{org-slug}`
- Tenant config stored in Supabase `tenants` table
- ALL data queries scoped by `tenant_id`
- Row Level Security (RLS) enforced at database level
- Module gating: CORE features free, add-ons per tenant

### Modular Express Backend

```
src/
├── server.js              # Entry point — mounts all routes (legacy + SaaS)
├── config/
│   ├── env.js             # Environment variables (centralized)
│   └── upload.js          # Multer file upload configs
├── db/
│   └── sqlite.js          # SQLite connection + migrations (legacy local data)
├── middleware/
│   ├── auth.js            # Session auth, role guards
│   ├── tenant.js          # Multi-tenant resolution + scoping
│   ├── modules.js         # Module gating (CORE vs add-on)
│   ├── portalAuth.js      # Stakeholder portal auth
│   └── error-handler.js   # Global error handler
├── services/
│   ├── supabaseClient.js  # Direct Supabase client (new SaaS code)
│   ├── supabase.js        # Airtable-compatible Supabase wrapper (legacy)
│   ├── database.js        # Toggle layer (airtable/supabase)
│   ├── schadsRates.js     # SCHADS Award 2024 rates + compliance engine
│   ├── reportWriter.js    # Claude AI NDIS report generation
│   └── airtable.js        # Airtable CRUD (legacy)
└── routes/
    ├── tenants.js         # Tenant management + signup
    ├── pricing/           # Pricing calculator API
    ├── admin/tenants.js   # Superadmin tenant management
    ├── signing/           # Digital document signing (CORE + add-on)
    ├── portal/            # Stakeholder portal
    ├── payroll/           # Payroll reporting + CSV export (CORE)
    ├── budgets/           # Client NDIS budget tracking (CORE)
    ├── reports/weekly.js  # Weekly AI progress reports (CORE)
    ├── chatbot.js         # AI staff & policy chatbot (CORE)
    ├── voice-sms.js       # Voice & SMS CRM API (add-on)
    ├── messenger/         # Team messenger (CORE)
    ├── auth/              # Login, logout, session management
    ├── contacts/          # CRM contacts
    ├── voice/             # Twilio webhooks
    ├── scheduling/        # Rosters, shifts
    ├── clients/           # Client profiles
    ├── recruitment/       # HR pipeline
    ├── reports/           # Ops reports
    ├── email/             # Microsoft Graph email
    ├── lms/               # Learning management
    ├── documents/         # Document management
    ├── tasks/             # Tasks and projects
    ├── compliance/        # Audit log, incidents
    ├── receipts/          # Receipt OCR
    ├── leads/             # Lead management
    ├── accommodation/     # SIL properties
    ├── budget/            # Legacy budget routes
    └── support-worker/    # Support worker auth
```

### Frontend Pages

```
public/
├── index.html             # Main CRM dashboard (monolith)
├── pricing.html           # Interactive pricing page
├── signup.html            # 4-step tenant signup wizard
├── tenant-login.html      # Branded tenant login
├── payroll.html           # Payroll reporting dashboard
├── compliance.html        # SCHADS compliance dashboard
├── budget-dashboard.html  # Client NDIS budget tracking
├── sign/index.html        # Public document signing page
├── portal/index.html      # Stakeholder portal SPA
├── admin/tenants.html     # Superadmin tenant manager
├── mobile/                # Support Worker PWA
│   ├── index.html         # PWA shell
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Service worker
│   ├── css/app.css        # Mobile styles
│   └── js/                # app.js, api.js, router.js
├── js/chatbot-widget.js   # AI chatbot floating widget
├── website.html           # Marketing website
└── support-worker.html    # Legacy SW page
```

### CORE Features (free with every plan)

- Quality Management System (QMS)
- Contacts & Tasks
- Service Agreement + Schedule of Support Digital Signing
- Roster of Care Creator/Calculator
- Rosters & Scheduling (full SCHADS-compliant)
- Client Budget Tracking (integrated in Scheduler)
- Roster Compliance Warnings (SCHADS Award)
- Payroll Reporting + CSV Export
- Weekly AI NDIS Progress Reports
- AI Staff & Policy Chatbot
- Support Worker Mobile PWA
- Team Messenger

### Add-On Modules

| Module | Key | Price |
|--------|-----|-------|
| Recruiter ATS | `recruiter` | $59/wk |
| Leads & CRM | `leads` | $49/wk |
| Voice Phone & SMS | `voice_sms` | $99/wk |
| 24/7 AI Voice Agent | `ai_voice` | $99/wk |
| Client Management (Advanced) | `client_management` | $69/wk |
| Billing & Invoicing | `billing` | $79/wk |
| LMS | `lms` | $49/wk |
| AI Report Writing (Advanced) | `ai_reports` | $59/wk |
| Employment Contract Signing | `employment_signing` | $39/wk |
| Stakeholder Portal | `stakeholder_portal` | $49/wk |

Bundle discounts: 3-4 modules 10% off, 5-6 15% off, 7+ 25% off, all modules $599/wk flat.

### Data Layer

- **Supabase (PostgreSQL)** — primary database for all SaaS features. Schema: `scripts/saas-schema.sql`. RLS enabled on all tables. Direct client: `src/services/supabaseClient.js`.
- **Supabase Storage** — file storage: titus-reports, titus-documents, titus-knowledge, titus-chat, titus-logos buckets.
- **SQLite** (`better-sqlite3`, WAL mode) — legacy local data: users, sessions, calls, SMS, audit logs.
- **Legacy toggle** — `src/services/database.js` switches between airtable/supabase for legacy routes.

### External Integrations

- **Anthropic Claude API** — AI reports, chatbot, CV scanning, receipt OCR
- **Twilio** — calls, SMS, WebRTC, recording (voice_sms add-on)
- **ElevenLabs** — AI voice agent ("Denise") (ai_voice add-on)
- **Microsoft Graph** — email sync and sending

### Authentication

- **Admin**: SQLite session-based, SHA-256, token from `Authorization: Bearer` or `x-auth-token`
- **Support Worker**: OTP-based via `x-sw-token` header
- **Stakeholder Portal**: Separate sessions via `x-portal-token` header
- **Public Signing**: Token-based, no login required

### Key Domain Concepts

- **NDIS** — National Disability Insurance Scheme (Australian)
- **SIL** — Supported Independent Living (24/7 residential)
- **SCHADS** — Social, Community, Home Care and Disability Services Industry Award
- **SOS** — Schedule of Support (funding document)
- **RoC** — Roster of Care

### Deployment

Production on **Railway** (auto-deploy on push to main). Uses Railway persistent volume for SQLite. Supabase hosted separately.

## Environment Variables

Key variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`. See `.env.example` for full list.

## Delta Community Support Config

- Slug: `delta-community`
- All modules enabled, $599/wk flat
- 80+ staff, $99/wk base tier
- gus@deltacommunity.com.au = superadmin
