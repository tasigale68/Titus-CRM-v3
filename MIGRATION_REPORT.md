# Titus CRM — Airtable to Supabase Migration Report

**Date:** 2026-02-26
**Version:** v3.1
**Status:** Ready for deployment

---

## Overview

Complete migration infrastructure from Airtable to Supabase for Titus CRM v3. The system supports a zero-downtime switchover using the `DATABASE` environment variable toggle.

## Architecture

```
DATABASE=airtable (default)     DATABASE=supabase
        │                              │
   airtable.js                    supabase.js
        │                              │
        └──── database.js ─────────────┘
                   │
          All 16 route modules
```

**Toggle mechanism:** `src/services/database.js` reads `DATABASE` env var and re-exports either `airtable.js` or `supabase.js`. All route files import from `database.js` — no route code changes needed to switch.

## Files Created

| File | Purpose |
|------|---------|
| `scripts/schema.sql` | Complete Supabase schema (40+ tables, indexes, triggers, RLS) |
| `scripts/migrate-airtable-to-supabase.js` | One-time initial data migration |
| `scripts/sync-airtable-to-supabase.js` | 5-minute interval sync bridge |
| `worker.js` | Background worker process for sync |
| `src/services/supabase.js` | Supabase service layer (mirrors airtable.js API) |
| `src/services/database.js` | Toggle layer (switches based on DATABASE env var) |

## Files Modified

| File | Change |
|------|--------|
| `src/config/env.js` | Added `supabase` and `database` config |
| `.env.example` | Added `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DATABASE` |
| `package.json` | Added `worker`, `migrate:supabase`, `sync:start` scripts |
| `src/routes/contacts/index.js` | Import from `database.js` instead of `airtable.js` |
| `src/routes/clients/index.js` | Import from `database.js` |
| `src/routes/scheduling/index.js` | Import from `database.js` |
| `src/routes/leads/index.js` | Import from `database.js` |
| `src/routes/tasks/index.js` | Import from `database.js` |
| `src/routes/lms/index.js` | Import from `database.js` |
| `src/routes/receipts/index.js` | Import from `database.js` |
| `src/routes/accommodation/index.js` | Import from `database.js` |
| `src/routes/budget/index.js` | Import from `database.js` |
| `src/routes/recruitment/index.js` | Import from `database.js` |
| `src/routes/documents/index.js` | Import from `database.js` |
| `src/routes/support-worker/index.js` | Import from `database.js` |
| `src/routes/denise-agent/index.js` | Import from `database.js` |
| `src/routes/reports/ops-report.js` | Import from `database.js` |
| `src/routes/reports/weekly-stakeholder.js` | Import from `database.js` |
| `src/routes/reports/custom-report.js` | Import from `database.js` |

## Supabase Schema Summary

### Structured Tables (full column mapping)
| Table | Airtable Source | Columns |
|-------|----------------|---------|
| `contacts` | All Contacts | 26 columns |
| `clients` | Clients | 60+ columns |
| `leads` | Leads | 28 columns |
| `rosters` | Rosters 2025 | 20 columns |
| `progress_notes` | Progress Notes | 11 columns |
| `ir_reports` | IR Reports 2025 | 12 columns |
| `client_core_budgets` | Client Core Budgets | 25 columns |
| `tasks` | Tasks | 25 columns |
| `courses` | Course List | 9 columns |
| `receipts` | Receipts | 17 columns |
| `ndis_price_guide` | NDIS Price Guide 2025-2026 | 9 columns |
| `knowledge_base` | Messenger Knowledge Base | 9 columns |
| `client_docs` | Client Docs | 12 columns |

### JSONB-based Tables (flexible schema)
| Table | Airtable Source |
|-------|----------------|
| `sil_properties` | SIL Properties |
| `client_calendar` | Client Calendar |
| `support_plans` | Support Plan - 2025 |
| `course_enrollments` | Course Enrollments |
| `course_modules` | Course Modules |
| `course_lessons` | Course Lessons |
| `course_quizzes` | Course Quizzes |
| `course_quiz_questions` | Course QuizQuestions |
| `employee_contact_history` | Employee Contact History |
| `client_contact_history` | Client Contact History |
| `sw_contractor_rates` | SW Independant Contractor Rates |
| `tfn_pay_rates` | TFN Pay Rates |
| `staff_availability` | Staff Availability |
| `roc_participants` | RoC Participants |
| `roc_shifts` | RoC Shifts |
| `client_sleep_chart` | Client Sleep Chart |
| `bowel_chart` | Bowel Chart |
| `fluid_intake_diary` | Fluid Intake Diary |
| `client_consumables` | Client Consumables |
| `client_behaviours` | QR Code Data - Behaviours |
| `document_signing_requests` | Document Signing Requests |
| `employment_documents` | Employment Documents |
| `company_files` | Company Files |
| `chat_conversations` | Chat Conversations |
| `chat_members` | Chat Members |
| `chat_messages` | Chat Messages |
| `push_subscriptions` | Push Subscriptions |
| `client_media` | Client Media |
| `weekly_stakeholder_reports` | Weekly Stakeholder Reports |
| `candidate_interactions` | Candidate Interactions |

### Utility Tables
| Table | Purpose |
|-------|---------|
| `sync_metadata` | Tracks last sync time per table |
| `airtable_id_map` | Maps Airtable record IDs to Supabase UUIDs |

## Environment Variables

```env
# Add to Railway / .env:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-role-key
DATABASE=airtable    # Change to 'supabase' when ready to switch
```

## NPM Scripts

```bash
npm run migrate:supabase    # One-time: migrate all Airtable data to Supabase
npm run sync:start          # Start 5-minute sync bridge
npm run worker              # Background worker (auto-detects DATABASE mode)
```

## Switchover Procedure

### Phase 1: Setup (current state)
1. Create Supabase project
2. Run `scripts/schema.sql` in Supabase SQL Editor
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in Railway env vars

### Phase 2: Initial Migration
1. Run `npm run migrate:supabase` to copy all Airtable data
2. Verify record counts match

### Phase 3: Sync Bridge
1. Set `DATABASE=airtable` (still using Airtable as primary)
2. Deploy `worker.js` as a separate Railway service
3. Monitor sync logs for 24-48 hours

### Phase 4: Switchover
1. Set `DATABASE=supabase` in Railway env vars
2. Redeploy — app now reads/writes to Supabase
3. Keep sync bridge running as safety net
4. Monitor for 1 week

### Phase 5: Cleanup
1. Disable sync bridge
2. Remove Airtable API key (or keep as read-only backup)
3. Remove `airtable.js` imports (optional)

## SQLite Tables (NOT migrated — remain in SQLite)

These tables use SQLite directly and are not part of the Airtable migration:

- `users` — Auth users and sessions
- `sessions` — Login sessions
- `calls` — Twilio call records
- `sms_messages` — SMS records
- `emails` — Microsoft Graph email cache
- `audit_log` — System audit trail
- `support_tickets` — Internal tickets
- `incident_reports` — Local incident records
- `sw_users` / `sw_sessions` / `sw_otp` / `sw_clock_log` — Support worker PWA
- `stakeholder_access` — Portal tokens
- `template_settings` — Document template config
- `automation_settings` / `automation_runs` — Automation config
- `login_history` — Login tracking
- `knowledge_base_docs` — Uploaded KB documents
- `continuous_improvement` — CI register
- `call_hunt_groups` / `agent_availability` — Call routing
- `app_settings` — App configuration
- `permission_templates` — Role permission templates

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Data loss during migration | Airtable remains read-only backup; sync bridge provides continuous copy |
| Supabase downtime | `DATABASE=airtable` instantly reverts to Airtable |
| Field mapping errors | JSONB `data` column preserves all original Airtable fields as fallback |
| Rate limiting during sync | 260ms delay between Airtable API calls; 200-row batches for Supabase |
| Linked record resolution | `airtable_id_map` table maps all Airtable IDs to Supabase UUIDs |
