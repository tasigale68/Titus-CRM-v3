# Static HTML Conversion + Feature Content Update — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert JS-rendered marketing site content to static HTML, update all 31 features, rename Denise→Andy, update pricing to 3 tiers.

**Architecture:** Cloudflare Worker (worker.js) serves HTML module imports. Convert JS-rendered sections to static HTML in each .html file. Keep JS only for interactive elements (calculator, chatbot, waitlist form submission).

**Tech Stack:** HTML, CSS (inline), minimal vanilla JS, Cloudflare Workers

---

### Task 1: Rename Denise → Andy (all files)

**Files:**
- Modify: `index.html` (10 occurrences)
- Modify: `features.html` (1 occurrence)
- Modify: `pricing.html` (2 occurrences)
- Modify: `about.html` (1 occurrence)
- Modify: `worker.js` (1 occurrence in llms.txt)

**Step 1: Replace all Denise references**

In `index.html`, replace every occurrence of "Denise" with "Andy":
- Line 125: FAQ schema — "Denise is an always-on" → "Andy is an always-on" and "She answers" → "Andy answers"
- Line 152: noscript — "AI agent named Denise" → "AI agent named Andy"
- Line 163: noscript feature list — "(Denise)" → "(Andy)"
- Line 188: noscript pricing — "(Denise)" → "(Andy)"
- Line 268: pricing card subtitle — "Denise answers" → "Andy answers"
- Line 534: section heading — "24/7 AI Agent (Denise)" → "24/7 AI Agent (Andy)"
- Line 605: form checkbox — "AI Agent (Denise)" → "AI Agent (Andy)"
- Line 763: JS module data — all "Denise" → "Andy"
- Line 955: chatbot KB — "denise" keyword, "Denise is our" → "Andy is our", greeting mention
- Line 987: featureMap — "(Denise)" → "(Andy)"

In `features.html` line 372: "Denise" → "Andy"
In `pricing.html` lines 365, 368: "Denise" → "Andy"
In `about.html` line 265: "(Denise)" → "(Andy)"
In `worker.js` line 223: "(Denise)" → "(Andy)"

**Step 2: Verify no Denise references remain**

Run: `grep -rn "Denise\|denise" *.html worker.js`
Expected: No matches

**Step 3: Commit**

```
git add index.html features.html pricing.html about.html worker.js
git commit -m "chore: rename AI agent from Denise to Andy across all pages"
```

---

### Task 2: Update pricing to 3 tiers

**Files:**
- Modify: `index.html` (noscript, JSON-LD SoftwareApplication schema, pricing section JS data, chatbot KB)
- Modify: `pricing.html` (pricing cards and comparison table)
- Modify: `worker.js` (llms.txt pricing)

**Step 1: Update JSON-LD schema in index.html**

Find the SoftwareApplication schema `offers` array. Replace with 3 tiers:
- Foundation: $249/week +GST
- Growth: $499/week +GST
- Scale: $749/week +GST
- Andy AI add-on: $129/week +GST

Remove the Contractor $79/week tier from the schema.

**Step 2: Update noscript pricing**

Update the noscript fallback pricing table to show 3 tiers only.

**Step 3: Update chatbot KB pricing answer**

Line ~955: Update the pricing KB answer to: "Titus pricing: Foundation $249/week, Growth $499/week, Scale $749/week (all +GST). Andy AI add-on $129/week +GST. Flat fee, no per-user charges."

**Step 4: Update pricing.html**

Update pricing cards to show 3 tiers. Remove Contractor tier card. Update comparison table.

**Step 5: Update worker.js llms.txt**

Update the pricing section in the llms.txt response.

**Step 6: Commit**

```
git add index.html pricing.html worker.js
git commit -m "feat: update pricing to 3 tiers (Foundation $249, Growth $499, Scale $749)"
```

---

### Task 3: Update hero and tagline

**Files:**
- Modify: `index.html` (hero section, meta description, og:description, JSON-LD)

**Step 1: Update hero copy**

Find the hero section. Update:
- Main heading: keep "Stop Drowning in NDIS Admin. Start Living."
- Subheading/value prop: change to "The customisable management platform for NDIS, Aged Care, Youth Residential, and Community services. Titus replaces 5 tools with one AI-powered platform."
- Remove references to "Recruitment Agency, Labour Hire Company" from the hero (these can stay in the waitlist form checkboxes)

**Step 2: Update meta tags**

Update `<meta name="description">` and `og:description` to include "NDIS, Aged Care, Youth Residential, and Community services" positioning.

**Step 3: Update JSON-LD Organization and WebPage descriptions**

**Step 4: Commit**

```
git add index.html
git commit -m "feat: update hero tagline — customisable platform for NDIS, Aged Care, Youth Resi, Community"
```

---

### Task 4: Convert features section to static HTML

**Files:**
- Modify: `index.html` (replace JS-rendered feature accordion with static HTML grid)

This is the largest task. The current features section uses JS to render accordion modules from data objects. Replace with static HTML cards in 6 groups.

**Step 1: Remove the JS feature module rendering code**

Find the features section and its associated JS data/rendering code. Remove the accordion JS rendering.

**Step 2: Write static feature HTML**

Replace with a static grid layout using the existing design system (gold accent, Space Grotesk headings, Plus Jakarta Sans body). 6 groups as 2-column grid on desktop, 1-column mobile:

**Group 1: Core Operations** (blue icon bg)
- Smart Rostering & AI Suggestions
- Task Manager
- Sites & Locations
- Timesheets & Staff Hours
- SCHADS Payroll Engine

**Group 2: AI Powered** (rose icon bg)
- Andy AI Chatbot
- AI Receptionist (Calls & SMS)
- Freestyle Voice Progress Notes
- AI Receipt Parsing
- Bulk CV Upload & AI Assessment

**Group 3: Contacts & Pipeline** (sky icon bg)
- Contacts: Clients, Staff & Jobseekers
- Referral Pipeline
- Unified Inbox (Email, SMS, Calls)

**Group 4: NDIS Compliance & Audit** (indigo icon bg)
- NDIS Auditor (9 evidence tabs, PDF audit pack)
- 18 NDIS Compliance Registers
- Policy Register
- SCHADS Compliance Reports
- NDIS Plan & Budget Tracking

**Group 5: Training & Client Care** (teal icon bg)
- LMS with AI Course Builder
- Medication Administration
- Care Passport ID

**Group 6: Automation & Files** (amber icon bg)
- Workflow Automations
- Company Files

Each group card: icon, group title, feature count badge, bulleted list of features with brief description.

Below the 6 groups, add a "Coming Soon" row with 8 items in muted gray styling:
- Support Worker Profile Creator
- Service Agreement & SOS Creator
- Roster of Care Calculator
- Shift GPS Tracker & Auto KM Recording
- AI Daily Shift Summary Email
- NDIS Bulk Claim File Generator
- Client Risk & Wellbeing Scoring
- Automated Reference Checks

Section heading: "What's Inside Titus" with subheading "23 live features. 8 more coming soon."

**Step 3: Verify the section renders correctly**

Open index.html locally or via `npx wrangler dev` and verify all 6 groups display, responsive on mobile, Coming Soon section visible.

**Step 4: Commit**

```
git add index.html
git commit -m "feat: convert features section to static HTML — 6 groups, 23 live features"
```

---

### Task 5: Convert pricing section to static HTML

**Files:**
- Modify: `index.html` (replace JS-rendered pricing cards with static HTML)

**Step 1: Remove JS pricing rendering**

Find the pricing section JS data and rendering code. Remove.

**Step 2: Write static pricing HTML**

3 pricing cards (Foundation, Growth, Scale) + Andy AI add-on card. Use existing card styling (white bg, rounded corners, gold accent for recommended plan). Each card shows: tier name, price, target audience, key features included, CTA button.

Feature comparison details can remain a simple list per card rather than a full comparison table (simpler, more scannable).

**Step 3: Commit**

```
git add index.html
git commit -m "feat: convert pricing section to static HTML — 3 tiers + Andy add-on"
```

---

### Task 6: Remove video and calculator sections from homepage

**Files:**
- Modify: `index.html` (remove video gallery section and calculator section from homepage body)

**Step 1: Remove the video gallery section**

Videos remain accessible at their own section/page — just remove from homepage flow.

**Step 2: Remove the calculator section**

Calculator remains at `/roc` — just remove from homepage. Can link to it from pricing section ("Calculate your savings →").

**Step 3: Verify homepage flow**

Should now be: Hero → Before/After → Partners → Features → Andy AI → Pricing → Waitlist → Chatbot.

**Step 4: Commit**

```
git add index.html
git commit -m "refactor: remove video gallery and calculator from homepage (still at own routes)"
```

---

### Task 7: Update features.html to static HTML

**Files:**
- Modify: `features.html` (replace accordion modules with static grid matching homepage groups)

**Step 1: Replace accordion JS with static HTML**

Same 6 groups as homepage but with expanded descriptions for each feature (2-3 sentences each). Full page dedicated to features.

**Step 2: Add Coming Soon section**

8 coming soon features with descriptions and muted styling.

**Step 3: Commit**

```
git add features.html
git commit -m "feat: convert features page to static HTML with 31 features in 6 groups"
```

---

### Task 8: Update noscript fallback

**Files:**
- Modify: `index.html` (noscript block)

**Step 1: Rewrite noscript content**

Update the noscript fallback to match the new static content exactly:
- New tagline
- All 23 live features listed by group
- 8 coming soon features
- Updated pricing (3 tiers)
- Andy not Denise
- Updated company description

**Step 2: Commit**

```
git add index.html
git commit -m "chore: update noscript fallback to match new static content"
```

---

### Task 9: Update llms.txt and JSON-LD schemas

**Files:**
- Modify: `worker.js` (llms.txt response)
- Modify: `index.html` (JSON-LD schemas)

**Step 1: Update llms.txt**

Rewrite the llms.txt content in worker.js to include:
- Updated tagline
- All 31 features (23 live + 8 coming soon)
- Updated pricing (3 tiers + Andy add-on)
- Andy not Denise
- All page URLs

**Step 2: Update JSON-LD schemas**

- Organization: update description
- SoftwareApplication: update feature list, pricing
- FAQPage: update AI agent Q&A to use Andy
- WebPage: update dateModified to 2026-03-29

**Step 3: Commit**

```
git add worker.js index.html
git commit -m "feat: update llms.txt and JSON-LD schemas with 31 features and Andy branding"
```

---

### Task 10: Deploy and verify

**Step 1: Deploy to Cloudflare**

```
cd ~/titus-crm/website-deploy
npx wrangler deploy
```

**Step 2: Verify AI crawler visibility**

```
curl -s https://www.titus-crm.com | grep -c "Task Manager"
curl -s https://www.titus-crm.com | grep -c "NDIS Auditor"
curl -s https://www.titus-crm.com | grep -c "Andy"
curl -s https://www.titus-crm.com | grep -c "Denise"
```

Expected: Task Manager > 0, NDIS Auditor > 0, Andy > 0, Denise = 0

**Step 3: Verify llms.txt**

```
curl -s https://www.titus-crm.com/llms.txt | grep "Andy"
```

**Step 4: Log to AYG changelog**

```
POST https://www.askyrgrandpa.com/api/admin/platform-changelog
{
  "platform": "titus",
  "summary": "Marketing website converted to static HTML. All 31 features now visible to AI crawlers. Renamed AI agent from Denise to Andy. Updated pricing to 3 tiers. Homepage tightened to 8 sections.",
  "session_number": 21
}
```

**Step 5: Final commit and push**

```
git push
```
