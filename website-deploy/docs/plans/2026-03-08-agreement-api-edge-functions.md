# Agreement API Edge Functions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the FastAPI backend with a single Supabase Edge Function that handles NDIS support catalogue search, agreement creation with PDF generation (jsPDF), and PDF download.

**Architecture:** Single Deno Edge Function (`agreement-api`) with path-based routing. Supabase table for support items catalogue (11,431 items). jsPDF for PDF generation. Resend HTTP API for email. All deployed to Supabase project `octdvaicofjmaetgfect`.

**Tech Stack:** Deno (Supabase Edge Functions), jsPDF + jspdf-autotable (via esm.sh CDN), Supabase JS client, Resend HTTP API

---

### Task 1: Initialize Supabase project locally

**Files:**
- Create: `supabase/config.toml`

**Step 1: Initialize Supabase in the website-deploy directory**

```bash
cd ~/titus-crm/website-deploy
npx supabase init
```

**Step 2: Link to the remote project**

```bash
npx supabase link --project-ref octdvaicofjmaetgfect
```

**Step 3: Verify connection**

```bash
npx supabase functions list
```

Expected: Empty list or connection confirmation.

---

### Task 2: Create support_items table in Supabase

**Files:**
- Create: `supabase/migrations/001_create_support_items.sql`

**Step 1: Write the migration SQL**

```sql
-- Create support_items table for NDIS Support Catalogue 2025-26
CREATE TABLE IF NOT EXISTS public.support_items (
  id SERIAL PRIMARY KEY,
  support_item_number TEXT NOT NULL,
  support_item_name TEXT NOT NULL,
  category TEXT,
  rate_act NUMERIC(10,2),
  rate_nsw NUMERIC(10,2),
  rate_nt NUMERIC(10,2),
  rate_qld NUMERIC(10,2),
  rate_sa NUMERIC(10,2),
  rate_tas NUMERIC(10,2),
  rate_vic NUMERIC(10,2),
  rate_wa NUMERIC(10,2),
  rate_remote NUMERIC(10,2),
  rate_very_remote NUMERIC(10,2)
);

-- Indexes for search performance
CREATE INDEX idx_support_items_name ON public.support_items USING gin (to_tsvector('english', support_item_name));
CREATE INDEX idx_support_items_number ON public.support_items (support_item_number);
CREATE INDEX idx_support_items_category ON public.support_items (category);

-- Enable public read access (no auth needed for catalogue)
ALTER TABLE public.support_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON public.support_items FOR SELECT USING (true);
```

**Step 2: Apply the migration**

```bash
npx supabase db push
```

If `db push` doesn't work with remote, use the Supabase MCP tool `execute_sql` or the dashboard SQL editor.

---

### Task 3: Import NDIS support items data

**Files:**
- Create: `scripts/import-support-items.js` (one-time Node.js script)

**Step 1: Write the import script**

```javascript
// scripts/import-support-items.js
// Run: node scripts/import-support-items.js
// Imports ndis_support_items_2025_26.json into Supabase support_items table

const fs = require('fs');
const https = require('https');

const SUPABASE_URL = 'https://octdvaicofjmaetgfect.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const items = JSON.parse(
  fs.readFileSync(
    '/home/tasig/Titus-Agreement-Creator-17th-Feb-26/backend/data/ndis_support_items_2025_26.json',
    'utf8'
  )
);

console.log(`Loaded ${items.length} items`);

// Transform to table format
const rows = items.map(item => ({
  support_item_number: item.supportItemNumber,
  support_item_name: item.supportItemName,
  category: item.supportCategoryPace || null,
  rate_act: item.rates?.ACT ?? null,
  rate_nsw: item.rates?.NSW ?? null,
  rate_nt: item.rates?.NT ?? null,
  rate_qld: item.rates?.QLD ?? null,
  rate_sa: item.rates?.SA ?? null,
  rate_tas: item.rates?.TAS ?? null,
  rate_vic: item.rates?.VIC ?? null,
  rate_wa: item.rates?.WA ?? null,
  rate_remote: item.rates?.Remote ?? null,
  rate_very_remote: item.rates?.VeryRemote ?? null,
}));

// Insert in batches of 500
async function insertBatch(batch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/support_items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert failed: ${res.status} ${text}`);
  }
}

async function main() {
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await insertBatch(batch);
    console.log(`Inserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  console.log('Done!');
}

main().catch(console.error);
```

**Step 2: Run the import**

```bash
SUPABASE_SERVICE_KEY=<key> node scripts/import-support-items.js
```

Expected: "Inserted 11431/11431" then "Done!"

**Step 3: Verify the data**

Use Supabase MCP `execute_sql`: `SELECT count(*) FROM support_items;`
Expected: 11431

---

### Task 4: Create the Edge Function — router and support items endpoint

**Files:**
- Create: `supabase/functions/agreement-api/index.ts`

**Step 1: Create the function directory**

```bash
mkdir -p ~/titus-crm/website-deploy/supabase/functions/agreement-api
```

**Step 2: Write the Edge Function with router and support-items endpoint**

```typescript
// supabase/functions/agreement-api/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status)
}

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// ── Route: GET /support-items ──────────────────────────────────
async function handleSupportItems(url: URL) {
  const search = url.searchParams.get('search') || ''
  const supabase = getSupabaseClient()

  let query = supabase
    .from('support_items')
    .select('*')
    .order('support_item_number')

  if (search.trim()) {
    query = query.ilike('support_item_name', `%${search.trim()}%`)
  }

  query = query.limit(200)

  const { data, error } = await query
  if (error) return errorResponse(error.message)

  // Transform to frontend format
  const items = (data || []).map((row: any) => ({
    id: String(row.id),
    supportItemNumber: row.support_item_number,
    supportItemName: row.support_item_name,
    category: row.category,
    rates: {
      ACT: row.rate_act,
      NSW: row.rate_nsw,
      NT: row.rate_nt,
      QLD: row.rate_qld,
      SA: row.rate_sa,
      TAS: row.rate_tas,
      VIC: row.rate_vic,
      WA: row.rate_wa,
      Remote: row.rate_remote,
      VeryRemote: row.rate_very_remote,
    },
  }))

  return jsonResponse({ success: true, items, count: items.length })
}

// ── Main router ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  // Edge function URL: /agreement-api/support-items
  // Strip the function name prefix
  const path = url.pathname.replace(/^\/agreement-api/, '') || '/'

  try {
    // GET /support-items
    if (req.method === 'GET' && path.startsWith('/support-items')) {
      return await handleSupportItems(url)
    }

    // POST /agreements/public
    if (req.method === 'POST' && path === '/agreements/public') {
      return await handleCreateAgreement(req)
    }

    // GET /agreements/download/:id
    const downloadMatch = path.match(/^\/agreements\/download\/(.+)$/)
    if (req.method === 'GET' && downloadMatch) {
      return await handleDownloadPdf(downloadMatch[1])
    }

    return errorResponse('Not found', 404)
  } catch (err) {
    console.error('Unhandled error:', err)
    return errorResponse(err.message || 'Internal server error')
  }
})
```

Note: `handleCreateAgreement` and `handleDownloadPdf` are implemented in Tasks 5-7.

---

### Task 5: Add agreement creation endpoint (validation + DB insert)

**Files:**
- Modify: `supabase/functions/agreement-api/index.ts`

**Step 1: Add helper functions and the create-agreement handler**

Add before the main router:

```typescript
// ── Helpers ────────────────────────────────────────────────────
function convertDateFormat(dateStr: string): string {
  if (!dateStr) return ''
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length !== 3) return dateStr
    const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return dateStr
}

function generateAgreementId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

function buildDbRecord(data: any, weekly: number, duration: number, total: number) {
  const rec: any = {
    organisation_name: data.organisationName || '',
    organisation_type: data.organisationType || '',
    abn: data.abn || '',
    ndis_provider_number: data.ndisProviderNumber || '',
    provider_first_name: data.providerFirstName || '',
    provider_last_name: data.providerLastName || '',
    provider_email: data.providerEmail || '',
    provider_state: data.providerState || '',
    pricing_zone: data.pricingZone || '',
    provider_logo: data.providerLogo || '',
    participant_first_name: data.participantFirstName || '',
    participant_last_name: data.participantLastName || '',
    ndis_number: data.ndisNumber || '',
    date_of_birth: convertDateFormat(data.dateOfBirth) || null,
    participant_email: data.participantEmail || '',
    participant_phone: data.participantPhone || '',
    street_address: data.streetAddress || '',
    suburb: data.suburb || '',
    participant_state: data.participantState || '',
    postcode: data.postcode || '',
    ndis_goals: data.ndisGoals || '',
    full_decision_maker: data.fullDecisionMaker || '',
    medical_decision_maker: data.medicalDecisionMaker || '',
    legal_decision_maker: data.legalDecisionMaker || '',
    financial_decision_maker: data.financialDecisionMaker || '',
    living_decision_maker: data.livingDecisionMaker || '',
    advocates: data.advocates || [],
    agreement_start_date: convertDateFormat(data.agreementStartDate) || null,
    ndis_plan_start: convertDateFormat(data.ndisPlanStart) || null,
    ndis_plan_end: convertDateFormat(data.ndisPlanEnd) || null,
    plan_type: data.planType || '',
    plan_intensity: data.planIntensity || '',
    funding_public_holidays: data.fundingPublicHolidays || '',
    support_coordinator_first_name: data.supportCoordinatorFirstName || '',
    support_coordinator_last_name: data.supportCoordinatorLastName || '',
    support_coordinator_email: data.supportCoordinatorEmail || '',
    plan_manager_name: data.planManagerName || '',
    plan_manager_email: data.planManagerEmail || '',
    billing_frequency: data.billingFrequency || '',
    duration_weeks: duration,
    weekly_recurring_amount: weekly,
    total_agreement_value: total,
    support_items: data.supportItems || [],
    public_holidays_count: data.publicHolidaysCount || 0,
    public_holidays_list: data.publicHolidaysList || [],
    terms_accepted: data.termsAccepted === 'Yes',
    agreement_id: generateAgreementId(),
    status: 'COMPLETED',
  }
  // Null out empty date strings
  for (const k of ['date_of_birth', 'agreement_start_date', 'ndis_plan_start', 'ndis_plan_end']) {
    if (rec[k] === '') rec[k] = null
  }
  return rec
}

// ── Route: POST /agreements/public ─────────────────────────────
async function handleCreateAgreement(req: Request) {
  const data = await req.json()
  const supabase = getSupabaseClient()

  // Validation
  const supportItems = data.supportItems || []
  if (!supportItems.length) {
    return errorResponse('Please add at least one support item.', 400)
  }
  if (['Plan Managed', 'Self Managed'].includes(data.planType)) {
    if (!(data.planManagerName || '').trim() || !(data.planManagerEmail || '').trim()) {
      return errorResponse('Plan Manager Name and Email required for this plan type.', 400)
    }
  }
  if (data.termsAccepted !== 'Yes') {
    return errorResponse('Terms & Conditions must be accepted.', 400)
  }

  // Financial calculations
  const weekly = supportItems.reduce(
    (sum: number, item: any) => sum + (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1), 0
  )
  const startDate = convertDateFormat(data.agreementStartDate)
  const endDate = convertDateFormat(data.ndisPlanEnd)
  let duration = 0
  if (startDate && endDate) {
    const diffDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    duration = diffDays > 0 ? Math.ceil(diffDays / 7) : 0
  }
  const total = Math.round(weekly * duration * 100) / 100

  // Insert
  const record = buildDbRecord(data, Math.round(weekly * 100) / 100, duration, total)
  const { data: inserted, error } = await supabase
    .from('agreements')
    .insert(record)
    .select()
    .single()

  if (error) return errorResponse(`DB error: ${error.message}`)

  const agreementId = inserted.agreement_id
  const recordId = inserted.id

  // PDF generation + upload + email happen here (Tasks 6-7)
  // For now, return success immediately
  let pdfUrl = null
  try {
    const pdfBytes = await generatePdf(data, supportItems, agreementId, inserted.created_at, weekly, duration, total)
    // Upload to storage
    const filename = `pdfs/agreement_${agreementId}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('agreement-pdfs')
      .upload(filename, pdfBytes, { contentType: 'application/pdf', upsert: true })
    if (uploadErr) console.error('Upload error:', uploadErr.message)
    else {
      pdfUrl = filename
      await supabase.from('agreements').update({ pdf_url: filename }).eq('id', recordId)
    }
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr)
  }

  // Send email (non-fatal)
  try {
    await sendAgreementEmail(data, supportItems, agreementId, weekly, total, duration, pdfUrl ? await downloadPdfBytes(supabase, pdfUrl) : null)
  } catch (emailErr) {
    console.error('Email error:', emailErr)
  }

  return jsonResponse({
    id: recordId,
    recordId,
    agreementId,
    fields: inserted,
    createdTime: inserted.created_at,
    weeklyRecurringAmount: weekly,
    totalAgreementValue: total,
    durationWeeks: duration,
  })
}
```

---

### Task 6: Add PDF generation with jsPDF

**Files:**
- Modify: `supabase/functions/agreement-api/index.ts`

**Step 1: Add jsPDF import and PDF generation function**

Add at the top of the file:

```typescript
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2'
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.4'
```

Add the PDF generation function:

```typescript
// ── PDF Generation ─────────────────────────────────────────────
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return 'N/A'
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${year}`
    }
  }
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }
  return dateStr
}

async function generatePdf(
  data: any,
  supportItems: any[],
  agreementId: string,
  createdAt: string,
  weekly: number,
  duration: number,
  total: number
): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const creationDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane' })
    : new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane' })
  const creationTime = createdAt
    ? new Date(createdAt).toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit' })

  // ── Helper: add footer to every page ──
  const addFooter = () => {
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(100)
      doc.text(
        `Page ${i} of ${pageCount} | Created using Titus CRM Software visit www.tituscrm.com.au | Created on ${creationDate} at ${creationTime}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' }
      )
    }
  }

  // ── Helper: section heading ──
  const sectionHeading = (title: string) => {
    if (y > 260) { doc.addPage(); y = margin }
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(title, margin, y)
    y += 1
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  // ── Helper: info row ──
  const infoRow = (label: string, value: string) => {
    if (y > 275) { doc.addPage(); y = margin }
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(label, margin, y)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(value || 'N/A', margin + 45, y)
    y += 5
  }

  // ── Helper: terms paragraph ──
  const termsParagraph = (text: string) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)
    const lines = doc.splitTextToSize(text, contentWidth)
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += 3.5
    }
    y += 1
  }

  // ── Helper: terms bullet ──
  const termsBullet = (text: string) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(text, contentWidth - 8)
    for (let i = 0; i < lines.length; i++) {
      if (y > 275) { doc.addPage(); y = margin }
      if (i === 0) doc.text('•', margin + 3, y)
      doc.text(lines[i], margin + 8, y)
      y += 3.5
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE 1: SCHEDULE OF SUPPORTS
  // ══════════════════════════════════════════════════════════════

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Schedule of Supports', margin, y + 5)
  y += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('NDIS Service Agreement', margin, y)
  y += 6
  // Agreement ID badge
  doc.setFillColor(240, 240, 240)
  doc.setDrawColor(0)
  const idText = `Agreement ID: ${agreementId}`
  const idWidth = doc.getTextWidth(idText) + 10
  doc.roundedRect(margin, y - 4, idWidth, 7, 1, 1, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(idText, margin + 5, y)
  y += 12

  // Provider Details
  sectionHeading('Provider Details')
  infoRow('Organisation', data.organisationName || '')
  if (data.ndisProviderNumber) infoRow('NDIS Provider #', data.ndisProviderNumber)
  infoRow('Contact', `${data.providerFirstName || ''} ${data.providerLastName || ''}`.trim())
  infoRow('Email', data.providerEmail || '')
  y += 3

  // Participant Details
  sectionHeading('Participant Details')
  infoRow('Name', `${data.participantFirstName || ''} ${data.participantLastName || ''}`.trim())
  infoRow('NDIS Number', data.ndisNumber || '')
  infoRow('Date of Birth', formatDateDisplay(data.dateOfBirth))
  y += 3

  // Agreement Period
  sectionHeading('Agreement Period')
  infoRow('Agreement Start', formatDateDisplay(data.agreementStartDate))
  infoRow('NDIS Plan Period', `${formatDateDisplay(data.ndisPlanStart)} - ${formatDateDisplay(data.ndisPlanEnd)}`)
  infoRow('Duration', `${duration} weeks`)
  y += 3

  // Separate weekly from once-off
  const onceOffCodes = ['04_049_0104_1_1', '04_050_0104_1_1', '04_051_0104_1_1']
  const weeklyItems = supportItems.filter(i =>
    !onceOffCodes.includes(i.code || '') && !(i.name || '').toLowerCase().includes('public holiday')
  )
  const onceOffItems = supportItems.filter(i =>
    onceOffCodes.includes(i.code || '') || (i.name || '').toLowerCase().includes('public holiday')
  )

  // Weekly Support Items Table
  sectionHeading('Weekly Support Items')
  const weeklyTableBody = weeklyItems.map(item => [
    item.code || '',
    item.name || '',
    `$${(parseFloat(item.rate) || 0).toFixed(2)}`,
    String(item.quantity || 1),
    item.ratio || '1:1',
    `$${((parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1)).toFixed(2)}`,
  ])
  const totalWeekly = weeklyItems.reduce(
    (s, i) => s + (parseFloat(i.rate) || 0) * (parseFloat(i.quantity) || 1), 0
  )
  weeklyTableBody.push(['', '', '', '', 'Total Weekly:', `$${totalWeekly.toFixed(2)}`])
  weeklyTableBody.push(['', '', '', '', `Total (${duration} wks):`, `$${(totalWeekly * duration).toFixed(2)}`])

  autoTable(doc, {
    startY: y,
    head: [['Code', 'Support Item', 'Rate', 'Qty', 'Ratio', 'Weekly']],
    body: weeklyTableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    didParseCell: (data: any) => {
      // Bold the total rows
      if (data.row.index >= weeklyTableBody.length - 2 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [240, 240, 240]
      }
    },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // Once-off fees (if any)
  if (onceOffItems.length > 0) {
    sectionHeading('Once-off Fees')
    const onceOffBody = onceOffItems.map(item => [
      item.code || '',
      item.name || '',
      `$${(parseFloat(item.rate) || 0).toFixed(2)}`,
      String(item.quantity || 1),
      `$${((parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1)).toFixed(2)}`,
    ])
    autoTable(doc, {
      startY: y,
      head: [['Code', 'Description', 'Rate', 'Qty', 'Total']],
      body: onceOffBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  }

  // Total Agreement Value
  if (y > 250) { doc.addPage(); y = margin }
  doc.setFillColor(223, 245, 227)
  doc.rect(margin, y - 3, contentWidth, 22, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`Weekly Recurring: $${weekly.toFixed(2)}`, margin + 5, y + 3)
  doc.text(`Duration: ${duration} weeks`, margin + 5, y + 9)
  doc.setFontSize(11)
  doc.text(`TOTAL AGREEMENT VALUE: $${total.toFixed(2)}`, margin + 5, y + 16)
  y += 28

  // Signature boxes
  const drawSignatureBox = (title: string) => {
    if (y > 240) { doc.addPage(); y = margin }
    doc.setDrawColor(0)
    doc.rect(margin, y, contentWidth, 30)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 5, y + 6)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Name:', margin + 5, y + 14)
    doc.line(margin + 20, y + 14, margin + 80, y + 14)
    doc.text('Date:', margin + 90, y + 14)
    doc.line(margin + 102, y + 14, margin + 150, y + 14)
    doc.text('Signature:', margin + 5, y + 24)
    doc.line(margin + 25, y + 24, margin + 120, y + 24)
    y += 35
  }

  drawSignatureBox('Participant / Representative - Schedule of Support')
  drawSignatureBox('Provider Representative - Schedule of Support')

  // ══════════════════════════════════════════════════════════════
  // PAGE 2+: SERVICE AGREEMENT T&Cs
  // ══════════════════════════════════════════════════════════════
  doc.addPage()
  y = margin

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('NDIS Service Agreement', margin, y + 5)
  y += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('National Disability Insurance Scheme', margin, y)
  y += 6
  doc.setFillColor(240, 240, 240)
  const idText2 = `Agreement ID: ${agreementId}`
  const idWidth2 = doc.getTextWidth(idText2) + 10
  doc.roundedRect(margin, y - 4, idWidth2, 7, 1, 1, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(idText2, margin + 5, y)
  y += 12

  // Preamble
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  const preamble = 'This Service Agreement is made in accordance with the National Disability Insurance Scheme Act 2013 (NDIS Act), associated NDIS Rules, the NDIS Practice Standards, the NDIS Code of Conduct, the Privacy Act 1988 (Cth), and the Australian Consumer Law (ACL).'
  const preambleLines = doc.splitTextToSize(preamble, contentWidth)
  doc.text(preambleLines, margin, y)
  y += preambleLines.length * 3 + 5

  // 1. PARTIES TO THE AGREEMENT
  sectionHeading('1. PARTIES TO THE AGREEMENT')
  infoRow('Participant', `${data.participantFirstName || ''} ${data.participantLastName || ''}`.trim())
  infoRow('NDIS Number', data.ndisNumber || '')
  infoRow('Date of Birth', formatDateDisplay(data.dateOfBirth))
  infoRow('Address', `${data.streetAddress || ''}, ${data.suburb || ''} ${data.participantState || ''} ${data.postcode || ''}`)
  y += 3
  infoRow('Provider', data.organisationName || '')
  infoRow('Type', data.organisationType || '')
  infoRow('ABN', data.abn || '')
  if (data.ndisProviderNumber) infoRow('NDIS Provider #', data.ndisProviderNumber)
  infoRow('Email', data.providerEmail || '')
  y += 3

  // Advocates
  const advocates = data.advocates || []
  if (advocates.length > 0) {
    sectionHeading('1.2 Representatives/Advocates')
    const advBody = advocates.map((a: any) => [
      `${a.firstName || ''} ${a.lastName || ''}`.trim(),
      a.relationship || '',
      a.email || '',
      a.phone || '',
    ])
    autoTable(doc, {
      startY: y,
      head: [['Name', 'Relationship', 'Email', 'Phone']],
      body: advBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // Plan Management Details
  sectionHeading('Plan Management Details')
  infoRow('Plan Start', formatDateDisplay(data.ndisPlanStart))
  infoRow('Plan End', formatDateDisplay(data.ndisPlanEnd))
  infoRow('Plan Type', data.planType || '')
  infoRow('Plan Intensity', data.planIntensity || '')
  if (data.planManagerName) infoRow('Plan Manager', `${data.planManagerName} - ${data.planManagerEmail || ''}`)
  if (data.supportCoordinatorFirstName) {
    infoRow('Support Coord.', `${data.supportCoordinatorFirstName || ''} ${data.supportCoordinatorLastName || ''} - ${data.supportCoordinatorEmail || ''}`)
  }
  y += 3

  // T&Cs — all 22 sections
  const sections = [
    { title: '1. SCOPE OF SERVICES', content: [
      { type: 'p', text: '1.1 The Provider will deliver supports in accordance with the Schedule of Supports, the Participant\'s current NDIS Plan, the NDIS Act 2013 and associated Rules, the NDIS Practice Standards and Code of Conduct, and the current NDIS Pricing Arrangements and Price Limits.' },
      { type: 'p', text: '1.2 This Agreement may include the provision of Community Access, In-Home Supports, Supported Independent Living (SIL), and Short Term Accommodation (STA).' },
      { type: 'p', text: '1.3 Supports are subject to funding availability, workforce availability, and safety, legal, and operational requirements.' },
      { type: 'p', text: '1.4 The Provider does not guarantee specific staff members, exact times, or continuity of individual workers.' },
      { type: 'p', text: '1.5 The Provider may vary, substitute, suspend, or withdraw supports where reasonably necessary to manage safety, compliance, operational viability, or financial risk.' },
    ]},
    { title: '2. PARTICIPANT RESPONSIBILITIES', content: [
      { type: 'p', text: '2.1 The Participant, their representatives, household members, and visitors must treat staff with dignity, courtesy, and respect; provide safe and reasonable access for service delivery; maintain a safe environment free from hazards; provide accurate, complete, and current information; notify the Provider promptly of changes to circumstances, risks, funding, or support needs; and pay all amounts due under this Agreement.' },
      { type: 'p', text: '2.2 The Participant must not request supports that are unlawful, unsafe, or outside the agreed scope.' },
    ]},
    { title: '3. SAFETY, CONDUCT, AND ZERO TOLERANCE', content: [
      { type: 'p', text: '3.1 The Provider applies a zero-tolerance approach to violence, threats, harassment, intimidation, discrimination, sexual harassment, coercion, or unsafe conduct.' },
      { type: 'p', text: '3.2 Where safety is at risk, the Provider may immediately withdraw staff, suspend supports, terminate this Agreement, or contact emergency services or relevant authorities.' },
      { type: 'p', text: '3.3 The Provider is not required to continue service delivery where it is unsafe to do so.' },
    ]},
    { title: '4. DISCLOSURE OF RISKS AND COOPERATION', content: [
      { type: 'p', text: '4.1 The Participant must disclose all known risks relevant to service delivery, including behavioural, medical, environmental, and safety risks.' },
      { type: 'p', text: '4.2 The Participant agrees to cooperate with incident management, investigations, and regulatory reporting.' },
      { type: 'p', text: '4.3 Failure to disclose material risks may result in suspension or termination of supports and recovery of reasonable costs incurred, to the extent permitted by law.' },
    ]},
    { title: '5. CONSENT, AUTHORITY, AND DECISION-MAKING', content: [
      { type: 'p', text: '5.1 The Participant consents to reasonable operational decisions necessary to deliver supports safely and lawfully, including the use of employees and contractors.' },
      { type: 'p', text: '5.2 Where a nominee, guardian, or representative acts on behalf of the Participant, they warrant they have lawful authority to enter into and manage this Agreement.' },
      { type: 'p', text: '5.3 The Provider may request evidence of authority at any time.' },
      { type: 'p', text: '5.4 Instructions that are unlawful, unsafe, or inconsistent with NDIS requirements will not be followed.' },
    ]},
    { title: '6. PROFESSIONAL BOUNDARIES', content: [
      { type: 'p', text: '6.1 Staff must maintain professional boundaries at all times.' },
      { type: 'p', text: '6.2 The Participant must not offer gifts, money, loans, or benefits to staff; seek personal, financial, or social relationships with staff; or request services outside the agreed supports.' },
      { type: 'p', text: '6.3 Boundary concerns may result in staff reassignment, service modification, or withdrawal of supports.' },
    ]},
    { title: '7. FEES, PRICING, AND FUNDING RESPONSIBILITY', content: [
      { type: 'p', text: '7.1 Supports are charged in accordance with the Schedule of Supports and the current NDIS Pricing Arrangements.' },
      { type: 'p', text: '7.2 The Participant acknowledges that the Provider does not guarantee sufficient NDIS funding; NDIA or plan manager delays do not remove the obligation to pay for supports delivered; and supports delivered remain payable even if funding is later exhausted, to the extent permitted by law.' },
      { type: 'p', text: '7.3 Where the NDIA or a plan manager fails to pay, the Participant remains ultimately responsible for payment, to the extent permitted by law.' },
    ]},
    { title: '8. INVOICING AND PAYMENT TERMS', content: [
      { type: 'p', text: '8.1 Invoices will be issued weekly in arrears unless otherwise agreed in writing.' },
      { type: 'p', text: '8.2 Invoices may be issued to the NDIA, plan manager, or the Participant depending on plan management arrangements.' },
      { type: 'p', text: '8.3 Invoices must be paid by the due date specified on the invoice.' },
    ]},
    { title: '9. OVERDUE INVOICES AND SUSPENSION OF SUPPORTS', content: [
      { type: 'p', text: '9.1 An invoice is overdue immediately after the due date if not paid in full.' },
      { type: 'p', text: '9.2 If an invoice remains overdue, services will be suspended until all outstanding amounts are paid in full and the account is brought up to date.' },
      { type: 'p', text: '9.3 The Provider is under no obligation to continue services while any invoice remains overdue.' },
      { type: 'p', text: '9.4 Services will only recommence once all overdue amounts are paid and any reasonable conditions (including payment in advance) are met.' },
      { type: 'p', text: '9.5 The Provider is not liable for any loss or inconvenience arising from suspension due to non-payment.' },
    ]},
    { title: '10. DEBT RECOVERY AND COLLECTION COSTS', content: [
      { type: 'p', text: '10.1 If amounts remain unpaid, the Provider may refer the debt to a third-party debt collection agency or commence legal recovery.' },
      { type: 'p', text: '10.2 The Participant agrees to pay all reasonable recovery costs, including debt collection fees, legal costs, court fees, and administrative costs, to the extent permitted by law.' },
      { type: 'p', text: '10.3 The Provider may charge reasonable interest on overdue amounts as permitted by law.' },
    ]},
    { title: '11. MINIMUM SHIFT LENGTH', content: [
      { type: 'p', text: '11.1 A minimum shift length of five (5) hours applies to all supports delivered under this Agreement.' },
      { type: 'p', text: '11.2 Where a shift is rostered or delivered for less than five (5) hours, the minimum five (5) hours will be charged unless otherwise agreed in writing.' },
    ]},
    { title: '12. CANCELLATIONS AND NON-ATTENDANCE', content: [
      { type: 'p', text: '12.1 The Participant must provide at least two (2) clear business days\' notice to cancel any scheduled shift or support.' },
      { type: 'p', text: '12.2 Where cancellation occurs with less than two (2) business days\' notice, the Provider will charge 100% of the scheduled shift, subject to a minimum of five (5) hours, at the applicable rate.' },
      { type: 'p', text: '12.3 Failure to attend, refusal of service, unsafe environments, or failure to provide access will be treated as a short-notice cancellation.' },
      { type: 'p', text: '12.4 Repeated cancellations may result in review, requirement for payment in advance, reduction of services, or termination of this Agreement.' },
      { type: 'p', text: '12.5 Cancellation charges will only be applied to the extent permitted under the current NDIS Pricing Arrangements.' },
    ]},
    { title: '13. SUPPORTED INDEPENDENT LIVING (IF APPLICABLE)', content: [
      { type: 'p', text: '13.1 SIL supports are delivered in shared or individual living arrangements.' },
      { type: 'p', text: '13.2 The Provider allows up to seven (7) consecutive days per NDIS Plan period for absences due to hospitalisation, planned or unplanned leave, or temporary relocation.' },
      { type: 'p', text: '13.3 After seven (7) days, SIL charges may continue where staffing, accommodation, utilities, and fixed operational costs continue to be incurred, to the extent permitted by NDIS rules.' },
    ]},
    { title: '14. SHORT TERM ACCOMMODATION (IF APPLICABLE)', content: [
      { type: 'p', text: '14.1 STA is temporary and does not create a tenancy, lease, or residential rights.' },
      { type: 'p', text: '14.2 The Participant must comply with reasonable house rules and safety requirements.' },
      { type: 'p', text: '14.3 Early departure does not entitle the Participant to a refund where fixed costs have been incurred, to the extent permitted by law.' },
      { type: 'p', text: '14.4 The Participant is responsible for damage or excess cleaning caused by them or their visitors.' },
      { type: 'p', text: '14.5 The Provider may terminate STA immediately for safety risks, serious misconduct, damage, or non-payment.' },
    ]},
    { title: '15. NON-SOLICITATION OF STAFF', content: [
      { type: 'p', text: '15.1 The Participant agrees that they, and their agents, representatives, nominees, family members, or related parties, must not directly or indirectly solicit, engage, employ, or contract any staff member introduced to them by the Provider.' },
      { type: 'p', text: '15.2 This restriction applies during the term of this Agreement and for a period of twelve (12) months from the date of the staff member\'s first introduction to the Participant.' },
      { type: 'p', text: '15.3 This includes direct employment, independent contracting, or engagement through another entity.' },
      { type: 'p', text: '15.4 The Participant acknowledges that this clause is reasonable and necessary to protect the Provider\'s workforce and business.' },
    ]},
    { title: '16. RESTRICTIVE PRACTICES', content: [
      { type: 'p', text: '16.1 Restrictive practices are prohibited unless lawfully authorised, included in an approved Behaviour Support Plan, and implemented by trained staff.' },
      { type: 'p', text: '16.2 The Provider may suspend or withdraw supports where behaviour presents unmanaged risk.' },
    ]},
    { title: '17. PRIVACY, RECORDING, AND MONITORING', content: [
      { type: 'p', text: '17.1 Personal information is handled in accordance with privacy laws and NDIS requirements.' },
      { type: 'p', text: '17.2 The Participant must not audio or video record staff without consent, except where permitted by law.' },
      { type: 'p', text: '17.3 The Provider may maintain records and monitoring systems for compliance, safety, quality, and financial management.' },
    ]},
    { title: '18. COMPLAINTS AND FEEDBACK', content: [
      { type: 'p', text: '18.1 Complaints may be made to the Provider or the NDIS Quality and Safeguards Commission.' },
      { type: 'p', text: '18.2 Making a complaint in good faith will not result in disadvantage.' },
    ]},
    { title: '19. LIMITATION OF LIABILITY', content: [
      { type: 'p', text: '19.1 To the extent permitted by law, the Provider is not liable for indirect or consequential loss.' },
      { type: 'p', text: '19.2 Nothing in this Agreement excludes rights under the Australian Consumer Law.' },
    ]},
    { title: '20. FORCE MAJEURE', content: [
      { type: 'p', text: '20.1 The Provider is not liable for failure or delay in delivering supports due to events beyond reasonable control.' },
    ]},
    { title: '21. GOVERNING LAW', content: [
      { type: 'p', text: '21.1 This Agreement is governed by the laws of Australia.' },
    ]},
    { title: '22. ENTIRE AGREEMENT AND SEVERABILITY', content: [
      { type: 'p', text: '22.1 This Agreement, including the Schedule of Supports, constitutes the entire agreement.' },
      { type: 'p', text: '22.2 If any clause is unenforceable, the remaining clauses continue to operate.' },
    ]},
  ]

  for (const section of sections) {
    sectionHeading(section.title)
    for (const item of section.content) {
      termsParagraph(item.text)
    }
    y += 2
  }

  // Consent Summary
  if (y > 240) { doc.addPage(); y = margin }
  doc.setFillColor(240, 249, 255)
  doc.setDrawColor(2, 132, 199)
  doc.setLineWidth(0.5)
  doc.rect(margin, y, contentWidth, 25, 'FD')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(2, 132, 199)
  doc.text('Consent Summary', margin + 5, y + 6)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(5, 150, 105)
  doc.text(`Terms Accepted: ${data.termsAccepted || 'Yes'}`, margin + 5, y + 12)
  doc.setTextColor(0)
  doc.text(`Terms Accepted At: ${creationDate} ${creationTime} AEST`, margin + 5, y + 17)
  doc.text(`Terms Version: ${data.termsVersion || 'Website T&Cs v1.0'}`, margin + 5, y + 22)
  y += 32

  // Signature boxes for Service Agreement
  drawSignatureBox('Participant / Representative - Service Agreement')
  drawSignatureBox('Provider Representative - Service Agreement')

  // Add footers
  addFooter()

  return doc.output('arraybuffer') as unknown as Uint8Array
}
```

---

### Task 7: Add email sending and PDF download

**Files:**
- Modify: `supabase/functions/agreement-api/index.ts`

**Step 1: Add email sending function**

```typescript
// ── Email via Resend ───────────────────────────────────────────
async function sendAgreementEmail(
  data: any,
  supportItems: any[],
  agreementId: string,
  weekly: number,
  total: number,
  duration: number,
  pdfBytes: Uint8Array | null,
) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log('RESEND_API_KEY not set, skipping email')
    return
  }

  const firstName = data.participantFirstName || ''
  const lastName = data.participantLastName || ''
  const subject = `New Agreement Created - ${firstName} ${lastName} - ${agreementId}`

  // Build simple HTML email body
  const itemRows = (supportItems || []).map((item: any) => {
    const rate = parseFloat(item.rate) || 0
    const qty = parseFloat(item.quantity) || 1
    return `<tr>
      <td style="padding:6px 10px;border:1px solid #ddd;">${item.code || ''}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${item.name || ''}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">$${rate.toFixed(2)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">${qty}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">$${(rate * qty).toFixed(2)}</td>
    </tr>`
  }).join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:#2454A0;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">New NDIS Service Agreement</h1>
        <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">Agreement ID: <strong>${agreementId}</strong></p>
      </div>
      <div style="border:1px solid #ddd;border-top:none;padding:20px;">
        <p><strong>Organisation:</strong> ${data.organisationName || ''}</p>
        <p><strong>Participant:</strong> ${firstName} ${lastName}</p>
        <p><strong>NDIS Number:</strong> ${data.ndisNumber || ''}</p>
        <p><strong>Plan Type:</strong> ${data.planType || ''}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr style="background:#e8edf5;">
            <th style="padding:8px;text-align:left;border:1px solid #ddd;">Code</th>
            <th style="padding:8px;text-align:left;border:1px solid #ddd;">Item</th>
            <th style="padding:8px;text-align:right;border:1px solid #ddd;">Rate</th>
            <th style="padding:8px;text-align:center;border:1px solid #ddd;">Qty</th>
            <th style="padding:8px;text-align:right;border:1px solid #ddd;">Weekly</th>
          </tr>
          ${itemRows}
        </table>
        <p style="font-size:16px;color:#28a745;"><strong>Weekly: $${weekly.toFixed(2)}</strong> | Duration: ${duration} weeks | <strong style="color:#2454A0;">Total: $${total.toFixed(2)}</strong></p>
      </div>
    </div>`

  const emailPayload: any = {
    from: 'agreements@tituscrm.com.au',
    to: ['info@tituscrm.com.au'],
    subject,
    html,
  }

  if (pdfBytes) {
    // Convert to base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)))
    emailPayload.attachments = [{
      filename: `agreement_${agreementId}.pdf`,
      content: base64,
      type: 'application/pdf',
    }]
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify(emailPayload),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`Resend error: ${res.status} ${text}`)
  } else {
    console.log('Agreement email sent successfully')
  }
}

// ── Helper: download PDF bytes from storage ────────────────────
async function downloadPdfBytes(supabase: any, path: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabase.storage.from('agreement-pdfs').download(path)
    if (error || !data) return null
    return new Uint8Array(await data.arrayBuffer())
  } catch { return null }
}

// ── Route: GET /agreements/download/:id ────────────────────────
async function handleDownloadPdf(agreementId: string) {
  const supabase = getSupabaseClient()

  const { data: record, error } = await supabase
    .from('agreements')
    .select('pdf_url')
    .eq('agreement_id', agreementId)
    .single()

  if (error || !record) return errorResponse('Agreement not found', 404)
  if (!record.pdf_url) return errorResponse('PDF not found for this agreement', 404)

  const { data: fileData, error: dlError } = await supabase.storage
    .from('agreement-pdfs')
    .download(record.pdf_url)

  if (dlError || !fileData) return errorResponse('Failed to download PDF')

  return new Response(fileData, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="agreement_${agreementId}.pdf"`,
    },
  })
}
```

---

### Task 8: Deploy the Edge Function and set secrets

**Step 1: Set the Resend API key secret**

```bash
cd ~/titus-crm/website-deploy
npx supabase secrets set RESEND_API_KEY=<key>
```

Get the key from: `cat ~/Titus-Agreement-Creator-17th-Feb-26/backend/.env | grep RESEND`

**Step 2: Deploy the Edge Function (no JWT verification for public access)**

```bash
npx supabase functions deploy agreement-api --no-verify-jwt
```

**Step 3: Verify the function is deployed**

```bash
curl https://octdvaicofjmaetgfect.supabase.co/functions/v1/agreement-api/support-items?search=self+care
```

Expected: JSON with `{ success: true, items: [...], count: N }`

---

### Task 9: Update frontend API_URL and redeploy

**Files:**
- Modify: `~/titus-crm/website-deploy/agreement-builder.html`

**Step 1: Update API_URL to point to Edge Function**

Change:
```javascript
var API_URL = 'https://titus-agreement-api-production.up.railway.app';
```

To:
```javascript
var API_URL = 'https://octdvaicofjmaetgfect.supabase.co/functions/v1/agreement-api';
```

**Step 2: Update fetch endpoints in the HTML**

The frontend currently calls:
- `API_URL + '/api/support-items/'` → change to `API_URL + '/support-items'`
- `API_URL + '/api/agreements/public'` → change to `API_URL + '/agreements/public'`
- `API_URL + '/api/agreements/download/' + id` → change to `API_URL + '/agreements/download/' + id`

Find and replace all instances of `/api/support-items/` with `/support-items`, `/api/agreements/public` with `/agreements/public`, and `/api/agreements/download/` with `/agreements/download/`.

**Step 3: Redeploy the Cloudflare Worker**

```bash
cd ~/titus-crm/website-deploy
npx wrangler deploy
```

**Step 4: Test end-to-end**

1. Visit https://www.titus-crm.com/agreement-builder
2. Verify support items load from the catalogue (should show 200 items, not 17 mock items)
3. Fill in a test agreement and submit
4. Verify PDF download works
5. Verify email notification arrives at info@tituscrm.com.au

---

## Dependency Order

```
Task 1 (init supabase)
  → Task 2 (create table)
    → Task 3 (import data)
Task 4 (router + support items) — can start after Task 1
  → Task 5 (agreement creation)
    → Task 6 (PDF generation)
      → Task 7 (email + download)
        → Task 8 (deploy + secrets)
          → Task 9 (update frontend + redeploy)
```
