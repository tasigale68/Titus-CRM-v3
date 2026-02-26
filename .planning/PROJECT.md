# Titus CRM v3 — UI Overhaul

## Vision
Modernize the Titus CRM interface to provide office users with dashboard-first views, functional workflows, and properly connected data across all modules.

## Current Milestone: v3.1 — UI Overhaul Sprint

### Phases

| # | Phase | Status | Description |
|---|-------|--------|-------------|
| 1 | Inbox Overhaul | done | Overview dashboard, hide email from conversations, fix Call Workflow |
| 2 | Leads Pipeline | done | Dashboard view with graphs, list date fields, SC email filter, Kanban dates |
| 3 | Recruit Pipeline | done | Overview/Kanban stage updates, filters, list dates, LMS/Airtable fixes |
| 4 | Rosters Enhancement | done | Draggable FABs, employee/contractor filter, sleepover calc, award rules, data connections |
| 5 | Reports Table View | pending | Internal reports table view, Airtable source linking, progress notes connection |

### Already Completed
- Navigation: Messenger link, rename User Management to Admin
- Contacts: Clients/Staff submenus, hide My Training, duplicate email detection
- Sidebar colour: Royal Blue (#4169E1)
- Office users default to Contacts Overview

## Tech Context
- Monolithic frontend: `public/index.html` (~21,000 lines)
- Secondary frontend: `public/receipt-form.html` (shared sidebar)
- Backend: Express + Airtable + SQLite
- Deployment: Railway (auto-deploy on push to main)
