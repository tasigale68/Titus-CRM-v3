# Agreement API — Supabase Edge Functions Design

**Date:** 2026-03-08
**Project:** Titus Agreement Creator backend
**Supabase Project:** `octdvaicofjmaetgfect`

## Overview

Replace the FastAPI+WeasyPrint backend with a single Supabase Edge Function (`agreement-api`) that handles support item catalogue, agreement creation with PDF generation, and PDF download.

## Architecture

Single Edge Function handling three routes:

- `GET /support-items?search=X&state=Y&pricing_zone=Z` — Query `support_items` table
- `POST /agreements/public` — Validate, save, generate PDF (jsPDF), upload to storage, email via Resend
- `GET /agreements/download/:id` — Return PDF from `agreement-pdfs` bucket

Frontend `API_URL` updated to: `https://octdvaicofjmaetgfect.supabase.co/functions/v1/agreement-api`

## Data Flow

1. Frontend loads support items via GET → Edge Function queries `support_items` table with ilike search
2. Frontend submits agreement via POST → Edge Function:
   - Validates required fields (support items, terms accepted, plan manager if needed)
   - Calculates financials (weekly amount, duration weeks, total value)
   - Generates 8-char alphanumeric agreement_id
   - Inserts into `agreements` table
   - Generates PDF with jsPDF (Schedule of Supports + 22-section Service Agreement T&Cs)
   - Uploads PDF to `agreement-pdfs` bucket as `pdfs/agreement_{id}.pdf`
   - Sends email via Resend to info@tituscrm.com.au with PDF attachment
   - Returns `{ agreementId, id }`
3. Download link fetches PDF from storage bucket via GET

## Database Changes

New table `support_items`:
- `id` (serial primary key)
- `support_item_number` (text, indexed)
- `support_item_name` (text, indexed)
- `category` (text)
- `rate_act`, `rate_nsw`, `rate_nt`, `rate_qld`, `rate_sa`, `rate_tas`, `rate_vic`, `rate_wa` (numeric)
- `rate_remote`, `rate_very_remote` (numeric)

Populated from existing `ndis_support_items_2025_26.json` (11,431 items).

Existing `agreements` table (53 columns) and `agreement-pdfs` storage bucket unchanged.

## PDF Generation

jsPDF + jspdf-autotable. Two-part document:

**Part 1 — Schedule of Supports:**
- Provider details, participant details, agreement period
- Weekly support items table (code, name, rate, qty, weekly cost)
- Once-off fees table
- Public holidays list
- Total agreement value summary
- Signature boxes (participant + provider)

**Part 2 — Service Agreement:**
- 22 numbered T&C sections (parties, scope, responsibilities, fees, cancellations, privacy, etc.)
- Consent summary (terms accepted, timestamp, version)
- Signature boxes

## Secrets

- `RESEND_API_KEY` — email notifications
- `SUPABASE_SERVICE_ROLE_KEY` — available by default in Edge Functions

## Frontend Change

Update `API_URL` in `agreement-builder.html` from Railway URL to Edge Function URL. Update endpoint paths to match (`/support-items`, `/agreements/public`, `/agreements/download/:id`).
