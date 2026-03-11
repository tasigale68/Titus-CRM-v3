import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2'
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.4'

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
  return jsonResponse({ error: message, detail: message }, status)
}

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

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
    terms_version: data.termsVersion || 'Website T&Cs v1.0',
    agreement_id: generateAgreementId(),
    status: 'COMPLETED',
  }
  for (const k of ['date_of_birth', 'agreement_start_date', 'ndis_plan_start', 'ndis_plan_end']) {
    if (rec[k] === '') rec[k] = null
  }
  return rec
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
  const weekly = Math.round(
    supportItems.reduce(
      (sum: number, item: any) => sum + (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1), 0
    ) * 100
  ) / 100

  const startDate = convertDateFormat(data.agreementStartDate)
  const endDate = convertDateFormat(data.ndisPlanEnd)
  let duration = 0
  if (startDate && endDate) {
    const diffDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    duration = diffDays > 0 ? Math.ceil(diffDays / 7) : 0
  }
  const total = Math.round(weekly * duration * 100) / 100

  // Insert
  const record = buildDbRecord(data, weekly, duration, total)
  const { data: inserted, error } = await supabase
    .from('agreements')
    .insert(record)
    .select()
    .single()

  if (error) return errorResponse(`DB error: ${error.message}`)

  const agreementId = inserted.agreement_id
  const recordId = inserted.id

  // PDF generation + upload
  let pdfUrl: string | null = null
  let pdfBytes: Uint8Array | null = null
  try {
    pdfBytes = generatePdf(data, supportItems, agreementId, inserted.created_at, weekly, duration, total)
    const filename = `pdfs/agreement_${agreementId}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('agreement-pdfs')
      .upload(filename, pdfBytes, { contentType: 'application/pdf', upsert: true })
    if (uploadErr) {
      console.error('Upload error:', uploadErr.message)
    } else {
      pdfUrl = filename
      await supabase.from('agreements').update({ pdf_url: filename }).eq('id', recordId)
    }
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr)
  }

  // Send email (non-fatal)
  try {
    await sendAgreementEmail(data, supportItems, agreementId, weekly, total, duration, pdfBytes)
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

// ── Route: POST /waitlist ──────────────────────────────────────
async function handleWaitlist(req: Request) {
  const data = await req.json()
  const supabase = getSupabaseClient()

  const firstName = (data.firstName || '').trim()
  const lastName = (data.lastName || '').trim()
  const email = (data.email || '').trim()
  const phone = (data.phone || '').trim()
  const state = (data.state || '').trim()
  const providerTypes = data.providerTypes || []
  const businessStructures = data.businessStructures || []
  const interestedFeatures = data.interestedFeatures || []

  if (!firstName || !lastName) return errorResponse('First and last name required.', 400)
  if (!email) return errorResponse('Email address required.', 400)
  if (!state) return errorResponse('State required.', 400)
  if (!providerTypes.length) return errorResponse('Select at least one provider type.', 400)

  const record: any = {
    first_name: firstName,
    last_name: lastName,
    state,
    provider_types: providerTypes,
  }
  // Add new fields only if the columns exist (graceful for pre-migration)
  if (email) record.email = email
  if (phone) record.phone = phone
  if (businessStructures.length) record.business_structures = businessStructures
  if (interestedFeatures.length) record.interested_features = interestedFeatures

  const { error } = await supabase.from('waitlist').insert(record)

  if (error) return errorResponse(`DB error: ${error.message}`)

  // Send notification email (non-fatal)
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      const structuresHtml = businessStructures.length
        ? `<p><strong>Business Structure:</strong></p><ul>${businessStructures.map((t: string) => `<li>${t}</li>`).join('')}</ul>`
        : ''
      const featuresHtml = interestedFeatures.length
        ? `<p><strong>Interested Features:</strong></p><ul>${interestedFeatures.map((t: string) => `<li>${t}</li>`).join('')}</ul>`
        : ''
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'Titus CRM <info@titus-crm.com>',
          to: ['info@titus-crm.com'],
          subject: `New Waitlist Signup - ${firstName} ${lastName} (${state})`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#9A7B2E;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;font-size:20px;">New Waitlist Signup</h1>
            </div>
            <div style="border:1px solid #ddd;border-top:none;padding:20px;">
              <p><strong>Name:</strong> ${firstName} ${lastName}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
              <p><strong>State:</strong> ${state}</p>
              <p><strong>Provider Types:</strong></p>
              <ul>${providerTypes.map((t: string) => `<li>${t}</li>`).join('')}</ul>
              ${structuresHtml}
              ${featuresHtml}
            </div>
          </div>`,
        }),
      })
      if (!emailRes.ok) {
        console.error('Waitlist email failed:', emailRes.status, await emailRes.text())
      }
    }
  } catch (emailErr) {
    console.error('Waitlist email error:', emailErr)
  }

  return jsonResponse({ success: true })
}

// ── PDF Generation ─────────────────────────────────────────────
function generatePdf(
  data: any,
  supportItems: any[],
  agreementId: string,
  createdAt: string,
  weekly: number,
  duration: number,
  total: number
): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const creationDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane' })
    : new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane' })
  const creationTime = createdAt
    ? new Date(createdAt).toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit' })

  const checkPage = (needed = 20) => {
    if (y > pageHeight - needed - 15) { doc.addPage(); y = margin }
  }

  const sectionHeading = (title: string) => {
    checkPage(25)
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

  const infoRow = (label: string, value: string) => {
    checkPage(8)
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

  const termsParagraph = (text: string) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)
    const lines = doc.splitTextToSize(text, contentWidth)
    for (const line of lines) {
      checkPage(6)
      doc.text(line, margin, y)
      y += 3.5
    }
    y += 1
  }

  const drawSignatureBox = (title: string) => {
    checkPage(38)
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

  // ══ PAGE 1: SCHEDULE OF SUPPORTS ══
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Schedule of Supports', margin, y + 5)
  y += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('NDIS Service Agreement', margin, y)
  y += 6
  doc.setFillColor(240, 240, 240)
  doc.setDrawColor(0)
  const idText = `Agreement ID: ${agreementId}`
  const idWidth = doc.getTextWidth(idText) + 10
  doc.roundedRect(margin, y - 4, idWidth, 7, 1, 1, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(idText, margin + 5, y)
  y += 12

  sectionHeading('Provider Details')
  infoRow('Organisation', data.organisationName || '')
  if (data.ndisProviderNumber) infoRow('NDIS Provider #', data.ndisProviderNumber)
  infoRow('Contact', `${data.providerFirstName || ''} ${data.providerLastName || ''}`.trim())
  infoRow('Email', data.providerEmail || '')
  y += 3

  sectionHeading('Participant Details')
  infoRow('Name', `${data.participantFirstName || ''} ${data.participantLastName || ''}`.trim())
  infoRow('NDIS Number', data.ndisNumber || '')
  infoRow('Date of Birth', formatDateDisplay(data.dateOfBirth))
  y += 3

  sectionHeading('Agreement Period')
  infoRow('Agreement Start', formatDateDisplay(data.agreementStartDate))
  infoRow('NDIS Plan Period', `${formatDateDisplay(data.ndisPlanStart)} - ${formatDateDisplay(data.ndisPlanEnd)}`)
  infoRow('Duration', `${duration} weeks`)
  y += 3

  // Separate weekly from once-off
  const onceOffCodes = ['04_049_0104_1_1', '04_050_0104_1_1', '04_051_0104_1_1']
  const weeklyItems = supportItems.filter((i: any) =>
    !onceOffCodes.includes(i.code || '') && !(i.name || '').toLowerCase().includes('public holiday')
  )
  const onceOffItems = supportItems.filter((i: any) =>
    onceOffCodes.includes(i.code || '') || (i.name || '').toLowerCase().includes('public holiday')
  )

  // Weekly Support Items Table
  sectionHeading('Weekly Support Items')
  const weeklyTableBody = weeklyItems.map((item: any) => [
    item.code || '',
    item.name || '',
    `$${(parseFloat(item.rate) || 0).toFixed(2)}`,
    String(item.quantity || 1),
    item.ratio || '1:1',
    `$${((parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1)).toFixed(2)}`,
  ])
  const totalWeekly = weeklyItems.reduce(
    (s: number, i: any) => s + (parseFloat(i.rate) || 0) * (parseFloat(i.quantity) || 1), 0
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
    didParseCell: (hookData: any) => {
      if (hookData.row.index >= weeklyTableBody.length - 2 && hookData.section === 'body') {
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.fillColor = [240, 240, 240]
      }
    },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // Once-off fees
  if (onceOffItems.length > 0) {
    sectionHeading('Once-off Fees')
    const onceOffBody = onceOffItems.map((item: any) => [
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
  checkPage(30)
  doc.setFillColor(223, 245, 227)
  doc.rect(margin, y - 3, contentWidth, 22, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(`Weekly Recurring: $${weekly.toFixed(2)}`, margin + 5, y + 3)
  doc.text(`Duration: ${duration} weeks`, margin + 5, y + 9)
  doc.setFontSize(11)
  doc.text(`TOTAL AGREEMENT VALUE: $${total.toFixed(2)}`, margin + 5, y + 16)
  y += 28

  drawSignatureBox('Participant / Representative - Schedule of Support')
  drawSignatureBox('Provider Representative - Schedule of Support')

  // ══ PAGE 2+: SERVICE AGREEMENT T&Cs ══
  doc.addPage()
  y = margin

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

  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  const preamble = 'This Service Agreement is made in accordance with the National Disability Insurance Scheme Act 2013 (NDIS Act), associated NDIS Rules, the NDIS Practice Standards, the NDIS Code of Conduct, the Privacy Act 1988 (Cth), and the Australian Consumer Law (ACL).'
  const preambleLines = doc.splitTextToSize(preamble, contentWidth)
  doc.text(preambleLines, margin, y)
  y += preambleLines.length * 3 + 5

  // Parties
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
    { title: '1. SCOPE OF SERVICES', paragraphs: [
      '1.1 The Provider will deliver supports in accordance with the Schedule of Supports, the Participant\'s current NDIS Plan, the NDIS Act 2013 and associated Rules, the NDIS Practice Standards and Code of Conduct, and the current NDIS Pricing Arrangements and Price Limits.',
      '1.2 This Agreement may include the provision of Community Access, In-Home Supports, Supported Independent Living (SIL), and Short Term Accommodation (STA).',
      '1.3 Supports are subject to funding availability, workforce availability, and safety, legal, and operational requirements.',
      '1.4 The Provider does not guarantee specific staff members, exact times, or continuity of individual workers.',
      '1.5 The Provider may vary, substitute, suspend, or withdraw supports where reasonably necessary to manage safety, compliance, operational viability, or financial risk.',
    ]},
    { title: '2. PARTICIPANT RESPONSIBILITIES', paragraphs: [
      '2.1 The Participant, their representatives, household members, and visitors must treat staff with dignity, courtesy, and respect; provide safe and reasonable access for service delivery; maintain a safe environment free from hazards; provide accurate, complete, and current information; notify the Provider promptly of changes to circumstances, risks, funding, or support needs; and pay all amounts due under this Agreement.',
      '2.2 The Participant must not request supports that are unlawful, unsafe, or outside the agreed scope.',
    ]},
    { title: '3. SAFETY, CONDUCT, AND ZERO TOLERANCE', paragraphs: [
      '3.1 The Provider applies a zero-tolerance approach to violence, threats, harassment, intimidation, discrimination, sexual harassment, coercion, or unsafe conduct.',
      '3.2 Where safety is at risk, the Provider may immediately withdraw staff, suspend supports, terminate this Agreement, or contact emergency services or relevant authorities.',
      '3.3 The Provider is not required to continue service delivery where it is unsafe to do so.',
    ]},
    { title: '4. DISCLOSURE OF RISKS AND COOPERATION', paragraphs: [
      '4.1 The Participant must disclose all known risks relevant to service delivery, including behavioural, medical, environmental, and safety risks.',
      '4.2 The Participant agrees to cooperate with incident management, investigations, and regulatory reporting.',
      '4.3 Failure to disclose material risks may result in suspension or termination of supports and recovery of reasonable costs incurred, to the extent permitted by law.',
    ]},
    { title: '5. CONSENT, AUTHORITY, AND DECISION-MAKING', paragraphs: [
      '5.1 The Participant consents to reasonable operational decisions necessary to deliver supports safely and lawfully, including the use of employees and contractors.',
      '5.2 Where a nominee, guardian, or representative acts on behalf of the Participant, they warrant they have lawful authority to enter into and manage this Agreement.',
      '5.3 The Provider may request evidence of authority at any time.',
      '5.4 Instructions that are unlawful, unsafe, or inconsistent with NDIS requirements will not be followed.',
    ]},
    { title: '6. PROFESSIONAL BOUNDARIES', paragraphs: [
      '6.1 Staff must maintain professional boundaries at all times.',
      '6.2 The Participant must not offer gifts, money, loans, or benefits to staff; seek personal, financial, or social relationships with staff; or request services outside the agreed supports.',
      '6.3 Boundary concerns may result in staff reassignment, service modification, or withdrawal of supports.',
    ]},
    { title: '7. FEES, PRICING, AND FUNDING RESPONSIBILITY', paragraphs: [
      '7.1 Supports are charged in accordance with the Schedule of Supports and the current NDIS Pricing Arrangements.',
      '7.2 The Participant acknowledges that the Provider does not guarantee sufficient NDIS funding; NDIA or plan manager delays do not remove the obligation to pay for supports delivered; and supports delivered remain payable even if funding is later exhausted, to the extent permitted by law.',
      '7.3 Where the NDIA or a plan manager fails to pay, the Participant remains ultimately responsible for payment, to the extent permitted by law.',
    ]},
    { title: '8. INVOICING AND PAYMENT TERMS', paragraphs: [
      '8.1 Invoices will be issued weekly in arrears unless otherwise agreed in writing.',
      '8.2 Invoices may be issued to the NDIA, plan manager, or the Participant depending on plan management arrangements.',
      '8.3 Invoices must be paid by the due date specified on the invoice.',
    ]},
    { title: '9. OVERDUE INVOICES AND SUSPENSION OF SUPPORTS', paragraphs: [
      '9.1 An invoice is overdue immediately after the due date if not paid in full.',
      '9.2 If an invoice remains overdue, services will be suspended until all outstanding amounts are paid in full and the account is brought up to date.',
      '9.3 The Provider is under no obligation to continue services while any invoice remains overdue.',
      '9.4 Services will only recommence once all overdue amounts are paid and any reasonable conditions (including payment in advance) are met.',
      '9.5 The Provider is not liable for any loss or inconvenience arising from suspension due to non-payment.',
    ]},
    { title: '10. DEBT RECOVERY AND COLLECTION COSTS', paragraphs: [
      '10.1 If amounts remain unpaid, the Provider may refer the debt to a third-party debt collection agency or commence legal recovery.',
      '10.2 The Participant agrees to pay all reasonable recovery costs, including debt collection fees, legal costs, court fees, and administrative costs, to the extent permitted by law.',
      '10.3 The Provider may charge reasonable interest on overdue amounts as permitted by law.',
    ]},
    { title: '11. MINIMUM SHIFT LENGTH', paragraphs: [
      '11.1 A minimum shift length of five (5) hours applies to all supports delivered under this Agreement.',
      '11.2 Where a shift is rostered or delivered for less than five (5) hours, the minimum five (5) hours will be charged unless otherwise agreed in writing.',
    ]},
    { title: '12. CANCELLATIONS AND NON-ATTENDANCE', paragraphs: [
      '12.1 The Participant must provide at least two (2) clear business days\' notice to cancel any scheduled shift or support.',
      '12.2 Where cancellation occurs with less than two (2) business days\' notice, the Provider will charge 100% of the scheduled shift, subject to a minimum of five (5) hours, at the applicable rate.',
      '12.3 Failure to attend, refusal of service, unsafe environments, or failure to provide access will be treated as a short-notice cancellation.',
      '12.4 Repeated cancellations may result in review, requirement for payment in advance, reduction of services, or termination of this Agreement.',
      '12.5 Cancellation charges will only be applied to the extent permitted under the current NDIS Pricing Arrangements.',
    ]},
    { title: '13. SUPPORTED INDEPENDENT LIVING (IF APPLICABLE)', paragraphs: [
      '13.1 SIL supports are delivered in shared or individual living arrangements.',
      '13.2 The Provider allows up to seven (7) consecutive days per NDIS Plan period for absences due to hospitalisation, planned or unplanned leave, or temporary relocation.',
      '13.3 After seven (7) days, SIL charges may continue where staffing, accommodation, utilities, and fixed operational costs continue to be incurred, to the extent permitted by NDIS rules.',
    ]},
    { title: '14. SHORT TERM ACCOMMODATION (IF APPLICABLE)', paragraphs: [
      '14.1 STA is temporary and does not create a tenancy, lease, or residential rights.',
      '14.2 The Participant must comply with reasonable house rules and safety requirements.',
      '14.3 Early departure does not entitle the Participant to a refund where fixed costs have been incurred, to the extent permitted by law.',
      '14.4 The Participant is responsible for damage or excess cleaning caused by them or their visitors.',
      '14.5 The Provider may terminate STA immediately for safety risks, serious misconduct, damage, or non-payment.',
    ]},
    { title: '15. NON-SOLICITATION OF STAFF', paragraphs: [
      '15.1 The Participant agrees that they, and their agents, representatives, nominees, family members, or related parties, must not directly or indirectly solicit, engage, employ, or contract any staff member introduced to them by the Provider.',
      '15.2 This restriction applies during the term of this Agreement and for a period of twelve (12) months from the date of the staff member\'s first introduction to the Participant.',
      '15.3 This includes direct employment, independent contracting, or engagement through another entity.',
      '15.4 The Participant acknowledges that this clause is reasonable and necessary to protect the Provider\'s workforce and business.',
    ]},
    { title: '16. RESTRICTIVE PRACTICES', paragraphs: [
      '16.1 Restrictive practices are prohibited unless lawfully authorised, included in an approved Behaviour Support Plan, and implemented by trained staff.',
      '16.2 The Provider may suspend or withdraw supports where behaviour presents unmanaged risk.',
    ]},
    { title: '17. PRIVACY, RECORDING, AND MONITORING', paragraphs: [
      '17.1 Personal information is handled in accordance with privacy laws and NDIS requirements.',
      '17.2 The Participant must not audio or video record staff without consent, except where permitted by law.',
      '17.3 The Provider may maintain records and monitoring systems for compliance, safety, quality, and financial management.',
    ]},
    { title: '18. COMPLAINTS AND FEEDBACK', paragraphs: [
      '18.1 Complaints may be made to the Provider or the NDIS Quality and Safeguards Commission.',
      '18.2 Making a complaint in good faith will not result in disadvantage.',
    ]},
    { title: '19. LIMITATION OF LIABILITY', paragraphs: [
      '19.1 To the extent permitted by law, the Provider is not liable for indirect or consequential loss.',
      '19.2 Nothing in this Agreement excludes rights under the Australian Consumer Law.',
    ]},
    { title: '20. FORCE MAJEURE', paragraphs: [
      '20.1 The Provider is not liable for failure or delay in delivering supports due to events beyond reasonable control.',
    ]},
    { title: '21. GOVERNING LAW', paragraphs: [
      '21.1 This Agreement is governed by the laws of Australia.',
    ]},
    { title: '22. ENTIRE AGREEMENT AND SEVERABILITY', paragraphs: [
      '22.1 This Agreement, including the Schedule of Supports, constitutes the entire agreement.',
      '22.2 If any clause is unenforceable, the remaining clauses continue to operate.',
    ]},
  ]

  for (const section of sections) {
    sectionHeading(section.title)
    for (const p of section.paragraphs) {
      termsParagraph(p)
    }
    y += 2
  }

  // Consent Summary
  checkPage(35)
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

  drawSignatureBox('Participant / Representative - Service Agreement')
  drawSignatureBox('Provider Representative - Service Agreement')

  // Add footers
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(100)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Page ${i} of ${pageCount} | Created using Titus CRM Software visit www.titus-crm.com | Created on ${creationDate} at ${creationTime}`,
      pageWidth / 2, pageHeight - 8, { align: 'center' }
    )
  }

  const arrayBuffer = doc.output('arraybuffer')
  return new Uint8Array(arrayBuffer)
}

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
    from: 'info@titus-crm.com',
    to: ['info@titus-crm.com'],
    subject,
    html,
  }

  if (pdfBytes && pdfBytes.length > 0) {
    // Convert Uint8Array to base64
    let binary = ''
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i])
    }
    const base64 = btoa(binary)
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

// ── Main router ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/agreement-api/, '') || '/'

  try {
    if (req.method === 'GET' && path.startsWith('/support-items')) {
      return await handleSupportItems(url)
    }

    if (req.method === 'POST' && path === '/agreements/public') {
      return await handleCreateAgreement(req)
    }

    if (req.method === 'POST' && path === '/waitlist') {
      return await handleWaitlist(req)
    }

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
