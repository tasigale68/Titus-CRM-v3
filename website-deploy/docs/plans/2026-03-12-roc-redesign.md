# ROC Redesign — Guided Roster Builder

**Date:** 2026-03-12
**Route:** www.titus-crm.com/roc
**Type:** Free web tool, no login, all client-side, gated export with lead capture

## Overview

Redesign the ROC page from a pricing calculator to a guided roster builder based on the NDIS Roster of Care Operational Template (5-sheet Excel workbook). 4-step wizard that walks users through setting up clients, staff, building a weekly roster, reviewing auto-generated invoices, and exporting — with lead capture gating the download.

## Step 1: Setup

- Add **Clients** — Name, NDIS Number, Plan Start/End, Support Category, Agreement Signed (yes/no)
- Add **Staff** — Name, Role (dropdown), Employment Type (Casual/PT/FT), SCHADS Level, Hourly Rate (auto-fills from SCHADS level)
- Cards layout — add/edit/remove
- Minimum 1 client + 1 staff to proceed

## Step 2: Build Roster

- Weekly calendar grid — rows per client, columns Mon-Sun
- Click cell → slide-out panel to create a shift:
  - Select worker (from Step 1 staff)
  - Select NDIS Line Item (pre-loaded 2025-26 catalogue, searchable dropdown)
  - Start/End time, auto-calc hours
  - Support Ratio (1:1, 1:2, 1:3)
  - Location (Home/Community), Transport KM
  - Sleepover toggle
- Shifts show as colour-coded blocks on the grid
- Running total per client + grand total visible at bottom

## Step 3: Review & Invoice

- Auto-generated invoice summary per client:
  - Date range, total hours, line items breakdown, transport, total amount
  - Rate x hours per NDIS line item
- Grand total across all clients
- Visual breakdown chart (hours by support type, cost by client)
- Flag any budget overruns (if plan dates + category totals known)

## Step 4: Export (Gated + Lead Capture)

- Form: Org name, contact name, email, phone, state, current rostering tool
- On submit:
  1. POST to `/waitlist` endpoint (agreement-api Edge Function)
  2. Tags: `["ROC BUILDER"]`
  3. Sends email notification to info@titus-crm.com with lead details
  4. Saves to `waitlist` table in Supabase
  5. Unlocks Excel + PDF download buttons
- Excel export: 5-sheet workbook (Roster, Clients, Staff, NDIS Line Items, Invoices)
- PDF export: Summary report with charts
- CTA banner after download: "Want this built into your CRM?"

## Technical

- Single HTML file (roc.html), vanilla JS, no backend (except lead capture POST)
- XLSX.js + jsPDF for exports
- Design system: navy/gold/teal, Syne/Outfit fonts (matches site)
- All data in-memory JS objects, cross-referenced by name
- Pre-loaded NDIS 2025-26 line items with rates
- Lead capture reuses existing agreement-api `/waitlist` endpoint + Resend email

## Essential Fields (trimmed from full template)

### Clients
- Client Name, NDIS Number, Plan Start, Plan End, Support Category, Agreement Signed

### Staff
- Staff Name, Role, Employment Type, SCHADS Level, Hourly Rate, Status

### Roster Shifts
- Date, Client, Worker, Service Type, NDIS Line Item, Start Time, End Time, Hours (auto), Support Ratio, Location, Transport KM, Sleepover, Status

### Invoices (auto-generated)
- Client Name, NDIS Number, Date Range, Total Hours, Transport KM, Total Amount, Line Items Breakdown
