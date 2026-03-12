# ROC Redesign — Guided Roster Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current ROC calculator (roc.html) with a 4-step guided roster builder that lets NDIS providers set up clients/staff, build a weekly roster with shifts, review auto-generated invoices, and export (gated by lead capture).

**Architecture:** Single HTML file (roc.html) with vanilla JS, all client-side data management. Reuses the existing `/waitlist` Edge Function endpoint for lead capture with `ROC BUILDER` tag. NDIS 2025-26 rates pre-loaded. Exports via XLSX.js (5-sheet workbook) and jsPDF (PDF summary).

**Tech Stack:** HTML/CSS/JS (vanilla), XLSX.js 0.18.5, jsPDF 2.5.2 + autotable 3.8.4, Google Fonts (Syne/Outfit), existing design system (navy/gold/teal CSS vars)

---

### Task 1: HTML Shell & CSS Foundation

**Files:**
- Modify: `/home/tasig/titus-crm/website-deploy/roc.html` (full rewrite)

**Step 1: Write the HTML shell with 4-step wizard structure**

Replace entire roc.html with the new structure. Keep same `<head>` (meta, fonts, CDN scripts). New body has:
- Hero section (same style as current)
- 4-step progress bar (Setup → Build Roster → Review → Export)
- 4 `<div class="section">` containers (sec-1 through sec-4)
- Footer disclaimer

```html
<!-- Progress bar -->
<div class="steps">
  <div class="step active" data-step="1"><span class="step-num">1</span><span class="step-label">Setup</span></div>
  <div class="step-line"></div>
  <div class="step" data-step="2"><span class="step-num">2</span><span class="step-label">Build Roster</span></div>
  <div class="step-line"></div>
  <div class="step" data-step="3"><span class="step-num">3</span><span class="step-label">Review</span></div>
  <div class="step-line"></div>
  <div class="step" data-step="4"><span class="step-num">4</span><span class="step-label">Export</span></div>
</div>
```

**Step 2: Write all CSS**

Reuse existing CSS variables (--navy, --gold, --teal, etc.) and patterns from current roc.html. New CSS needed for:
- `.client-card` / `.staff-card` — add/edit/remove cards with border-left colour coding
- `.roster-grid` — weekly calendar (CSS Grid: 8 cols — label + Mon-Sun)
- `.shift-block` — coloured blocks inside grid cells
- `.slide-panel` — right-side slide-out for shift creation (position fixed, z-index overlay)
- `.invoice-card` — per-client invoice summary card
- `.searchable-dropdown` — NDIS line item picker with filter input
- Keep all existing responsive patterns, card styles, button styles, form styles

Key measurements:
- Grid cells: min 120px wide, auto height
- Shift blocks: 60px min-height, border-radius 8px, coloured by support type
- Slide panel: 400px wide on desktop, 100% on mobile
- Cards: same --radius, --shadow as current

**Step 3: Verify shell renders**

Open roc.html in browser. Should show hero + 4-step progress bar + Step 1 visible. Steps 2-4 hidden. No JS logic yet.

**Step 4: Commit**

```bash
git add roc.html
git commit -m "feat(roc): scaffold 4-step roster builder HTML shell and CSS"
```

---

### Task 2: Step 1 — Client & Staff Setup

**Files:**
- Modify: `/home/tasig/titus-crm/website-deploy/roc.html`

**Step 1: Write Step 1 HTML**

Two sections side by side (stacked on mobile):

**Clients section:**
- "Add Client" button
- List of client cards, each showing: Client Name, NDIS Number, Plan Start, Plan End, Support Category (dropdown: Core Supports, Capacity Building, Capital), Agreement Signed (yes/no toggle)
- Edit/Remove buttons on each card

**Staff section:**
- "Add Staff" button
- List of staff cards: Staff Name, Role (dropdown: Support Worker, Team Leader, Allied Health, Registered Nurse), Employment Type (dropdown: Casual, Part-Time, Full-Time), SCHADS Level (dropdown: Level 1.1 through 4.3), Hourly Rate (auto-fills from SCHADS selection, editable)
- Edit/Remove buttons on each card

**Step 2: Write the JS data layer and SCHADS rates**

```javascript
// State
let clients = [];    // {id, name, ndisNumber, planStart, planEnd, supportCategory, agreementSigned}
let staff = [];      // {id, name, role, employmentType, schadsLevel, hourlyRate}
let shifts = [];     // {id, date, clientId, staffId, lineItemKey, startTime, endTime, hours, ratio, location, transportKm, sleepover, status}
let nextId = { client: 0, staff: 0, shift: 0 };

// SCHADS Award 2024-25 base rates
const SCHADS = {
  '1.1': 29.28, '1.2': 29.76, '1.3': 30.42,
  '2.1': 31.11, '2.2': 31.41, '2.3': 31.89, '2.4': 32.35,
  '3.1': 33.08, '3.2': 33.56, '3.3': 34.12,
  '4.1': 35.95, '4.2': 36.89, '4.3': 37.69,
};
```

**Step 3: Write add/edit/remove client functions**

```javascript
function addClient() { ... }      // opens inline form, pushes to clients[], renders card
function editClient(id) { ... }   // toggles card into edit mode
function removeClient(id) { ... } // confirms, removes from clients[], re-renders
function renderClients() { ... }  // renders all client cards
```

**Step 4: Write add/edit/remove staff functions**

Same pattern as clients. SCHADS level dropdown auto-fills hourlyRate but allows override.

**Step 5: Write navigation validation**

"Continue to Roster" button validates: at least 1 client + 1 staff. Shows error if not met.

```javascript
function goStep(n) {
  if (n === 2 && (clients.length === 0 || staff.length === 0)) {
    showToast('Add at least 1 client and 1 staff member to continue');
    return;
  }
  // ... show/hide sections, update progress bar
}
```

**Step 6: Verify Step 1 works**

Add 2 clients, 2 staff members. Edit one. Remove one. Verify SCHADS auto-fill. Verify "Continue" is blocked with 0 clients/staff.

**Step 7: Commit**

```bash
git add roc.html
git commit -m "feat(roc): step 1 — client and staff setup with SCHADS rates"
```

---

### Task 3: Step 2 — Weekly Roster Builder

**Files:**
- Modify: `/home/tasig/titus-crm/website-deploy/roc.html`

**Step 1: Write the roster grid HTML/JS**

Roster grid renders dynamically based on clients added in Step 1:
- Rows: one per client (client name as row label)
- Columns: Mon | Tue | Wed | Thu | Fri | Sat | Sun
- Each cell is clickable → opens slide-out panel

```javascript
function renderRosterGrid() {
  const grid = document.getElementById('roster-grid');
  grid.innerHTML = '';
  // Header row
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  // ... render header + one row per client
  // Each cell: <div class="grid-cell" onclick="openShiftPanel(clientId, dayIndex)">
  // Existing shifts render as coloured blocks inside cells
}
```

**Step 2: Write the shift creation slide-out panel**

Right-side panel with form:
- Worker dropdown (populated from staff[])
- NDIS Line Item — searchable dropdown with the pre-loaded NDIS rates (reuse existing `R` object and `SUPPORT_OPTIONS` optgroups, but add a text filter input above the select)
- Start Time / End Time (time inputs)
- Total Hours (auto-calculated from times)
- Support Ratio dropdown (1:1, 1:2, 1:3)
- Location dropdown (Home, Community)
- Transport KM (number input, default 0)
- Sleepover toggle (Yes/No)
- Status dropdown (Planned, Confirmed, Completed)
- Save / Cancel buttons

```javascript
function openShiftPanel(clientId, dayIndex) { ... }  // shows panel, pre-fills client + day
function saveShift() { ... }    // validates, pushes to shifts[], re-renders grid cell
function closeShiftPanel() { ... }
```

**Step 3: Write shift rendering in grid cells**

Each shift in a cell shows as a coloured block:
- Support type determines colour (Core=teal, SIL=purple, CB=gold)
- Shows: worker first name, time range, line item short name
- Click existing shift → opens panel in edit mode
- Small X button to delete shift

**Step 4: Write running totals**

Bottom of roster grid shows:
- Per-client row totals (hours + cost)
- Grand total bar (total hours, total weekly cost)

```javascript
function recalcTotals() {
  let totalHours = 0, totalCost = 0;
  clients.forEach(c => {
    const clientShifts = shifts.filter(s => s.clientId === c.id);
    const hours = clientShifts.reduce((sum, s) => sum + s.hours, 0);
    const cost = clientShifts.reduce((sum, s) => sum + (s.hours * R[s.lineItemKey].r) + (s.transportKm * R.transport.r), 0);
    // update per-client total display
    totalHours += hours;
    totalCost += cost;
  });
  // update grand total display
}
```

**Step 5: Verify roster builder works**

Add shifts for 2 clients across different days. Edit a shift. Delete a shift. Verify totals update. Test on mobile (panel should be full-width overlay).

**Step 6: Commit**

```bash
git add roc.html
git commit -m "feat(roc): step 2 — weekly roster grid with shift creation panel"
```

---

### Task 4: Step 3 — Review & Auto-Generated Invoices

**Files:**
- Modify: `/home/tasig/titus-crm/website-deploy/roc.html`

**Step 1: Write invoice generation logic**

```javascript
function generateInvoices() {
  const invoices = [];
  clients.forEach(c => {
    const clientShifts = shifts.filter(s => s.clientId === c.id);
    if (clientShifts.length === 0) return;

    const lines = {};  // group by line item key
    let totalHours = 0, totalKm = 0, totalAmount = 0;

    clientShifts.forEach(s => {
      const rate = R[s.lineItemKey].r;
      const shiftCost = s.hours * rate;
      const kmCost = s.transportKm * R.transport.r;
      totalHours += s.hours;
      totalKm += s.transportKm;
      totalAmount += shiftCost + kmCost;

      if (!lines[s.lineItemKey]) lines[s.lineItemKey] = { label: R[s.lineItemKey].l, rate, hours: 0, amount: 0 };
      lines[s.lineItemKey].hours += s.hours;
      lines[s.lineItemKey].amount += shiftCost;
    });

    invoices.push({
      id: 'INV-' + String(invoices.length + 1).padStart(4, '0'),
      client: c, totalHours, totalKm, totalAmount, lines: Object.values(lines),
      transportAmount: totalKm * R.transport.r
    });
  });
  return invoices;
}
```

**Step 2: Write the review UI**

- Summary stats row (same 4-card pattern from current roc.html): Total Weekly Cost, Total Hours, Participants, Annual Estimate
- Per-client invoice cards:
  - Client name + NDIS number header
  - Table: Line Item | Hours | Rate | Amount
  - Transport row (if km > 0)
  - Total row (bold)
- Grand total bar at bottom
- Admin overhead callout (reuse from current page)
- CTA banner "Let Titus manage your roster"

**Step 3: Write visual breakdown**

Simple horizontal bar chart (CSS-only, no chart library):
- Hours by support type (grouped)
- Cost by client (stacked bars)

```javascript
function renderBreakdownCharts(invoices) {
  // CSS bar chart: each bar is a div with width = percentage of max
  // Colour-coded by support category
}
```

**Step 4: Verify review step**

Navigate through Steps 1→2→3. Verify invoices calculate correctly. Verify totals match roster totals. Verify charts render.

**Step 5: Commit**

```bash
git add roc.html
git commit -m "feat(roc): step 3 — review page with auto-generated invoices and charts"
```

---

### Task 5: Step 4 — Lead Capture & Export

**Files:**
- Modify: `/home/tasig/titus-crm/website-deploy/roc.html`

**Step 1: Write the lead capture form**

Reuse the exact form fields from current Step 1: first name, last name, org, email, mobile, state, current rostering tool. Same validation patterns.

**Step 2: Write the waitlist API call**

```javascript
async function submitLead() {
  const data = {
    firstName: val('f-first'),
    lastName: val('f-last'),
    email: val('f-email'),
    phone: val('f-mobile'),
    state: val('f-state'),
    providerTypes: ['NDIS'],
    tags: ['ROC BUILDER'],
  };

  // Validate
  if (!data.firstName || !data.lastName || !data.email || !data.state) {
    showToast('Please fill in all required fields');
    return;
  }

  try {
    const res = await fetch('https://octdvaicofjmaetgfect.supabase.co/functions/v1/agreement-api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Submission failed');

    // Unlock downloads
    document.getElementById('export-buttons').style.display = 'flex';
    document.getElementById('lead-form').style.display = 'none';
    document.getElementById('lead-success').style.display = 'block';
    showToast('Details submitted! Your downloads are ready.');
  } catch (e) {
    showToast('Something went wrong. Please try again.', 'error');
  }
}
```

Note: The existing `/waitlist` endpoint expects `providerTypes` as a required array. We send `['NDIS']` as default. The endpoint will save with tags `['WAITLIST FORM']` by default — but we need to check if we can override tags. Looking at the endpoint code (line 392), it hardcodes `record.tags = ['WAITLIST FORM']`. We need to either:
- (a) Modify the edge function to accept a `source` field and use it as tag, OR
- (b) Use the `insertLead()` helper function (line 294) which accepts `opts.source`

**Simplest approach:** Add `source` field handling to `/waitlist` endpoint. If `data.source` is provided, use it as the tag instead of `'WAITLIST FORM'`.

**Edge function change (agreement-api/index.ts line 392):**
```typescript
record.tags = [data.source || 'WAITLIST FORM']
```

**Step 3: Write Excel export (5-sheet workbook)**

```javascript
function exportExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Roster_of_Care
  const rosterData = shifts.map((s, i) => ({
    'Shift ID': 'ROC-' + String(i + 1).padStart(4, '0'),
    'Date': s.date,
    'Client Name': clients.find(c => c.id === s.clientId)?.name || '',
    'NDIS Number': clients.find(c => c.id === s.clientId)?.ndisNumber || '',
    'Support Worker': staff.find(st => st.id === s.staffId)?.name || '',
    'Worker Role': staff.find(st => st.id === s.staffId)?.role || '',
    'Service Type': R[s.lineItemKey]?.g || '',
    'NDIS Line Item': s.lineItemKey,
    'Start Time': s.startTime,
    'End Time': s.endTime,
    'Total Hours': s.hours,
    'Support Ratio': s.ratio,
    'Location': s.location,
    'Transport KM': s.transportKm,
    'Sleepover (Yes/No)': s.sleepover ? 'Yes' : 'No',
    'Status': s.status,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rosterData), 'Roster_of_Care');

  // Sheet 2: Clients
  const clientData = clients.map(c => ({ ... }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientData), 'Clients');

  // Sheet 3: Staff
  const staffData = staff.map(s => ({ ... }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffData), 'Staff');

  // Sheet 4: NDIS_Line_Items (used items only)
  const usedItems = [...new Set(shifts.map(s => s.lineItemKey))];
  const itemData = usedItems.map(k => ({
    'NDIS Line Item': k,
    'Description': R[k].l,
    'Support Category': R[k].g,
    'Price Limit': R[k].r,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemData), 'NDIS_Line_Items');

  // Sheet 5: Invoices
  const invoices = generateInvoices();
  const invData = invoices.map(inv => ({ ... }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), 'Invoices');

  XLSX.writeFile(wb, `ROC-${new Date().toISOString().slice(0,10)}.xlsx`);
}
```

**Step 4: Write PDF export**

Reuse jsPDF patterns from current roc.html. Generate:
- Header with Titus CRM branding
- Provider details (from lead form)
- Summary stats
- Per-client invoice tables
- Budget breakdown
- Footer disclaimer

**Step 5: Update Edge Function to accept source tag**

Modify `/home/tasig/titus-crm/website-deploy/supabase/functions/agreement-api/index.ts` line 392:

```typescript
// Before:
record.tags = ['WAITLIST FORM']
// After:
record.tags = [data.source || 'WAITLIST FORM']
```

**Step 6: Verify full flow**

1. Fill Steps 1-3 with test data
2. On Step 4, fill form and submit
3. Verify lead appears in Supabase `waitlist` table with tag `ROC BUILDER`
4. Verify email sent to info@titus-crm.com
5. Download Excel — verify 5 sheets with correct data
6. Download PDF — verify formatted correctly

**Step 7: Commit**

```bash
git add roc.html supabase/functions/agreement-api/index.ts
git commit -m "feat(roc): step 4 — lead capture, waitlist API, Excel + PDF export"
```

---

### Task 6: Polish & Deploy

**Files:**
- Modify: `/home/tasig/titus-crm/website-deploy/roc.html`
- Modify: `/home/tasig/titus-crm/website-deploy/worker.js` (if needed — route already exists)

**Step 1: Mobile responsiveness pass**

- Roster grid: horizontal scroll on mobile, sticky client name column
- Shift panel: full-width overlay on screens < 768px
- Card layouts: single column on mobile
- All text minimum 12px (no text-[8px] or text-[10px])
- Touch-friendly: buttons min 44px hit target

**Step 2: Toast notifications**

Add a simple toast system for feedback messages (shift saved, client added, validation errors):

```javascript
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}
```

**Step 3: Empty states**

- Step 1: Show placeholder cards "No clients yet — add your first client" / "No staff yet"
- Step 2: Empty grid cells show "+" icon, no shifts message
- Step 3: "No shifts to review" if empty

**Step 4: SEO meta tags**

Update `<title>` and meta description:
```html
<title>NDIS Roster of Care Builder | Free Tool | Titus CRM</title>
<meta name="description" content="Build your NDIS Roster of Care for free. Add clients, staff, and shifts with 2025-26 NDIS pricing. Export to Excel and PDF. Purpose-built for Australian NDIS providers.">
```

**Step 5: Deploy Edge Function**

```bash
cd ~/titus-crm/website-deploy
npx supabase functions deploy agreement-api --project-ref octdvaicofjmaetgfect --no-verify-jwt
```

**Step 6: Deploy Worker**

```bash
cd ~/titus-crm/website-deploy
npx wrangler deploy
```

**Step 7: Smoke test on production**

Visit https://www.titus-crm.com/roc and run through complete flow.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(roc): polish, mobile responsive, deploy"
```
