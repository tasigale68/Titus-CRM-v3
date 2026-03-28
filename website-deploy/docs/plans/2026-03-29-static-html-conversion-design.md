# Static HTML Conversion + Feature Content Update

**Date:** 2026-03-29
**Status:** Approved
**Goal:** Convert JS-rendered content to static HTML so AI crawlers and search engines can read it. Update all feature content to match the 31 management features audited in the app. Rename AI agent from Denise to Andy. Update pricing to 3 tiers.

## Problem

The homepage and key pages are client-side React SPAs rendered with Babel. AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript. The content is invisible to AI search. Feature content is stale and doesn't reflect the 31 management features in the app. The AI agent is called "Denise" on the website but "Andy" in the app. Pricing shows old tiers.

## Approach

Incremental conversion: keep the current worker.js architecture (Cloudflare Worker serving HTML modules) but move content from JS-rendered React into static HTML. JS only for interactive elements (calculator, chatbot, waitlist form submission).

## Architecture

No architectural changes. Cloudflare Worker continues serving HTML module imports. Each page stays as a separate .html file. Interactive elements keep inline JS. Everything else becomes static HTML.

## Homepage Structure (8 sections)

1. **Hero** - Static HTML. New tagline: "The customisable management platform for NDIS, Aged Care, Youth Residential, and Community services." CTAs: Join Waitlist + See Features. Badge: "24/7 AI Agent Available".
2. **Before vs After** - Static HTML. 4 time-saved cards (report writing 4hr, chasing timesheets 3hr, tracking certs 2hr, agreement reminders 1hr). Testimonial merged in.
3. **Partners** - Static HTML. 4 partner logos: Delta Community, Meadow Street, Amaiya Support, Pineula Care Services.
4. **Features** - Static HTML grid/cards (NOT accordions). 6 feature groups, all 23 live features visible without clicking. Coming Soon in muted section below.
5. **Andy AI Agent** - Static HTML. Renamed from Denise. Cost comparison ($71K human vs $129/wk AI). 4 capability cards.
6. **Pricing** - Static HTML cards. 3 tiers: Foundation $249/wk, Growth $499/wk, Scale $749/wk (all +GST). Andy AI add-on $129/wk. No per-user fees.
7. **Waitlist Form** - Static HTML form, JS for submission only.
8. **Chatbot Widget** - JS interactive (keep as-is).

## Feature Groups (6 groups, 23 live features)

### Core Operations (5)
- Smart Rostering & AI Suggestions
- Task Manager
- Sites & Locations
- Timesheets & Staff Hours
- SCHADS Payroll Engine

### AI Powered (5)
- Andy AI Chatbot
- AI Receptionist (Calls & SMS)
- Freestyle Voice Progress Notes
- AI Receipt Parsing
- Bulk CV Upload & AI Assessment

### Contacts & Pipeline (3)
- Contacts: Clients, Staff & Jobseekers
- Referral Pipeline
- Unified Inbox (Email, SMS, Calls)

### NDIS Compliance & Audit (5)
- NDIS Auditor (9 evidence tabs, PDF audit pack export)
- 18 NDIS Compliance Registers
- Policy Register
- SCHADS Compliance Reports
- NDIS Plan & Budget Tracking

### Training & Client Care (3)
- LMS with AI Course Builder
- Medication Administration
- Care Passport ID

### Automation & Files (2)
- Workflow Automations
- Company Files

### Coming Soon (8, muted styling)
- Support Worker Profile Creator
- Service Agreement & SOS Creator
- Roster of Care Calculator
- Shift GPS Tracker & Auto KM Recording
- AI Daily Shift Summary Email
- NDIS Bulk Claim File Generator
- Client Risk & Wellbeing Scoring
- Automated Reference Checks

## Pricing Update

| Tier | Price | Target |
|------|-------|--------|
| Foundation | $249/wk +GST | Small providers |
| Growth | $499/wk +GST | Mid-size providers |
| Scale | $749/wk +GST | Large providers |
| Andy AI (add-on) | $129/wk +GST | Any tier |

All plans: no per-user fees, implementation fee based on business size, paid weekly in advance.

## Other Pages Updated

- **features.html** - Same 6 groups with expanded descriptions, static HTML not accordion
- **pricing.html** - Updated to 3 tiers, Andy not Denise
- **llms.txt** - Updated with all 31 features, new pricing, Andy name
- **Noscript fallback** - Updated to match static content
- **sitemap.xml** - No changes needed
- **robots.txt** - No changes needed

## Global Rename

All references to "Denise" become "Andy" across every file: index.html, features.html, pricing.html, about.html, llms.txt, noscript fallback, JSON-LD schemas, blog articles that mention the AI agent.

## What Stays the Same

- Design system: gold #9A7B2E, Space Grotesk headings, Plus Jakarta Sans body, warm backgrounds
- Partner section content and logos
- Blog articles (content unchanged, only Denise->Andy if mentioned)
- Agreement builder, ROC calculator, admin portal
- Security headers, robots.txt rules, sitemap.xml structure
- Worker.js routing architecture
- Chatbot widget functionality
- Calculator page (moved from homepage, still accessible at its own route)
- Video page (moved from homepage, still accessible)

## Success Criteria

1. AI crawlers (GPTBot, ClaudeBot, PerplexityBot) can read all homepage content without JS
2. All 23 live management features visible on homepage and features page
3. All references to "Denise" replaced with "Andy"
4. Pricing shows Foundation $249, Growth $499, Scale $749
5. Tagline reads "The customisable management platform for NDIS, Aged Care, Youth Residential, and Community services"
6. Homepage loads with 8 sections, no accordion clicks required to see features
