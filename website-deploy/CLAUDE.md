# Titus CRM Marketing Website - Agent Instructions

## Project Overview
Marketing website + admin CRM for Titus CRM at https://www.titus-crm.com
Includes waitlist, agreement builder, 3-pipeline admin portal, and email automations.

## Architecture
- **Frontend:** Cloudflare Worker serving React SPAs (client-side Babel, NOT pre-built)
  - `index.html` — Marketing site
  - `agreement-builder.html` — Agreement builder tool
  - `administrator.html` — Admin portal (password: in env vars)
  - `roc.html` — Roster of Care calculator
- **Backend:** Supabase Edge Function `agreement-api` (Deno, 1600+ lines)
- **Email:** Cloudflare Email Routing → Worker → Supabase + forward to Gmail
- **Database:** Supabase project `octdvaicofjmaetgfect` (ap-southeast-2 Sydney)
- **Domain:** titus-crm.com on Cloudflare (canonical: www.titus-crm.com)

## Deployment
- **Worker:** `npx wrangler deploy` from ~/titus-crm/website-deploy
- **Edge Function:** `npx supabase functions deploy agreement-api --project-ref octdvaicofjmaetgfect --no-verify-jwt`
- **IMPORTANT:** Always use `--no-verify-jwt` flag — redeployment without it causes 401 errors
- **Must login first:** `npx wrangler login` (Cloudflare), Supabase CLI auth
- **NO staging environment** — deploys go directly to production

## Key Files
- `worker.js` — Main Cloudflare Worker (routes, email handler, static content, partner logos)
- `supabase/functions/agreement-api/index.ts` — All backend logic (agreements, waitlist, admin, email)
- `wrangler.toml` — Worker config (routes: www.titus-crm.com + demo.titus-crm.com)

## Edge Function Routes
- `GET /support-items` — NDIS support item catalogue
- `POST /agreements/public` — Create agreement + PDF
- `GET /agreements/download/:id` — Download agreement PDF
- `POST /waitlist` — Waitlist signup
- `POST /admin/login` — Admin auth (returns JWT-like token)
- `GET /admin/leads` — List leads with search/filter
- `PATCH /admin/leads/:id` — Update lead (triggers stage automations)
- `GET /admin/emails` — List email history
- `POST /admin/email/send` — Send email via Resend
- `POST /admin/email/inbound` — Inbound email webhook

## Conventions
- 3 pipelines: P1 Waitlist & Launch (6 stages), P2 Trial to Paid (8 stages), P3 Active Clients (6 stages)
- 20 email automation templates in STAGE_AUTOMATIONS object
- Date format conversion: DD/MM/YY ↔ YYYY-MM-DD (lines 30-55 of agreement-api)
- Partner logos served from worker.js at `/partners/*.png` routes
- Admin token: 24-hour expiry, Base64-encoded JSON payload

## Gotchas
- CORS is `Access-Control-Allow-Origin: *` on public endpoints — needs tightening
- Secrets are hardcoded in agreement-api source — must move to env vars
- No CSP headers on HTML responses
- SPAs use client-side React+Babel — NOT pre-built (impacts SEO)
- tituscrm.com is DIFFERENT from titus-crm.com
- PRODA/PACE are NOT features — never add references to them
- QMS has 15 registers (not 18)

## Security Issues to Watch
- Admin password, token secret, and webhook secret are hardcoded in agreement-api
- No rate limiting on any endpoint
- No audit logging for admin actions
- Stored XSS risk in admin_emails display (HTML not escaped)

## Testing
- No automated tests exist
- Manual: waitlist form → admin portal → pipeline management → email sends
- Test email routing via Cloudflare dashboard
