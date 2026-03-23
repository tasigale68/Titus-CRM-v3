# Titus CRM V5: Complete Feature List with Provider Outcomes

> Generated: 2026-03-23
> Source: Full codebase analysis of ~/titus-crm-v5 (110+ source files, 13 Edge Functions)
> Live: https://v5.titus-crm.com

---

## Summary

| Metric | Count |
|--------|-------|
| Total features | 380+ |
| Modules | 12 |
| Pages | 45+ |
| Edge Functions (AI) | 13 |
| QMS Compliance Registers | 18 |
| LMS Training Courses | 21 |
| Database Tables | 75+ |

---

## Module 1: Dashboard and Task Management

### Dashboard
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 1 | KPI summary cards | Displays Active Clients, Active Staff, Shifts This Week, Open Tasks, Open Incidents as clickable cards | See your entire operation at a glance without opening 5 different screens |
| 2 | Compliance alerts panel | Shows urgent alerts: overdue incidents, expiring certifications, missing progress notes, budget warnings | Never miss a compliance deadline again. Catches issues before auditors do |
| 3 | Missing progress notes tracker | Lists clients with recent shifts that have no linked progress note | Eliminates the "who forgot to write their notes?" chase every Monday |
| 4 | Today's roster view | Shows all shifts scheduled for today with worker, client, time, and service type | Instant visibility of who is where today without opening the full roster |
| 5 | Referral pipeline funnel | Visual funnel chart showing referral counts per stage (New through Won/Lost) | Track your growth pipeline and conversion rates at a glance |
| 6 | Task summary by status | Counts tasks across To Do, In Progress, Completed, Overdue with link to Tasks | Know exactly how much is on your team's plate right now |
| 7 | Activity feed | Chronological log of recent portal actions (notes, shifts, referrals, etc.) | See what your team has been doing without asking for updates |
| 8 | Budget utilisation overview | Bar chart of client budget spend percentages, colour-coded by threshold | Spot clients burning through budget too fast or too slow before plan reviews |

### Tasks
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 9 | Kanban board | Drag-and-drop task cards across To Do, In Progress, Review, Completed columns | Visual workflow management. No more tasks falling through the cracks |
| 10 | List view toggle | Flat list showing all tasks with priority, status, due date, assignee | Quick scanning when you need to find a specific task fast |
| 11 | Create/edit/delete tasks | Full task CRUD with title, description, priority (Low/Medium/High/Urgent), status, due date, assignee | Assign work, set deadlines, track accountability in one place |
| 12 | Search and filter tasks | Filter by keyword, priority, status, assignee | Find any task instantly across your entire organisation |
| 13 | Drag-and-drop status updates | Move cards between columns to update status | Update task progress in one gesture instead of opening a form |
| 14 | Task analytics view | Pie chart of tasks by status and bar chart by priority | Identify bottlenecks: too many tasks stuck in "Review"? Reassign or escalate |
| 15 | Real-time task updates | Board auto-refreshes via Supabase real-time when another user changes a task | Team members see updates instantly. No more "refresh your browser" |

---

## Module 2: Contacts (Clients, Staff, Jobseekers)

### Contact Management (Shared)
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 16 | Three contact types | Separate views for Clients, Staff, and Jobseekers with type-specific fields | One place for every person in your organisation. No more separate spreadsheets |
| 17 | Search with live filter | Real-time text filter across name, email, phone | Find any contact in under 2 seconds |
| 18 | Multi-filter system | Filter by role, employment type, status, suburb, recruitment stage | Instantly answer "show me all casual workers in Sunnybank" |
| 19 | CSV import with validation | 4-step import wizard: upload, auto-map columns, validate, batch create. Duplicate email detection | Migrate from another system in minutes, not weeks. Catches duplicates before they cause problems |
| 20 | CSV export | Download filtered contact list as CSV | Get data out for payroll, reporting, or compliance audits |
| 21 | Profile photo upload | Click avatar to upload client photos to Supabase Storage | Put a face to every participant for better person-centred care |
| 22 | Archive contacts | Soft-delete with confirmation. Archived contacts hidden from active lists | Clean up your contact list without losing historical data |
| 23 | Split-panel detail view | List on left, full detail tabs on right. Auto-selects first contact | See the list and detail simultaneously. No back-and-forth navigation |

### Client Management
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 24 | 8-tab client detail view | Details, Support Plan, NDIS Plan & Budget, Stakeholders, Service Records, Contact History, Docs, AI Report | Everything about a participant in one place. No more hunting across 5 systems |
| 25 | Client personal profile | Edit name, DOB (auto-calculates age), gender, pronouns, NDIS number, address, emergency contact, medical info | Complete participant profile that meets NDIS audit requirements |
| 26 | Service type toggles | CAS/SIL/In-Home Support checkboxes on profile | Instantly see and update what services each client receives |
| 27 | Client overview dashboard | Donut charts for gender breakdown, service type (CAS vs SIL), intensity levels, PBSP and restrictive practice counts | Understand your client demographics at a glance for planning and reporting |

### NDIS Plan and Budget
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 28 | NDIS plan details | View/edit NDIS number, plan type (Agency/Plan/Self Managed), plan start/end dates, intensity level | Track every client's NDIS plan details without separate spreadsheets |
| 29 | Plan manager and coordinator fields | Store plan manager and support coordinator name, email, phone | Quick access to key contacts when you need to discuss a client's plan |
| 30 | NDIS goals CRUD | Create, edit, delete goals with category, description, and status (Active/Achieved/On Hold) | Track participant goals as required by NDIS Practice Standards |
| 31 | Budget tracking | Visual allocated vs spent vs remaining with colour-coded progress bar | Know exactly how much budget remains before you over-service or under-service |
| 32 | Budget line items | Itemised line items with NDIS support category and amounts | Granular budget visibility down to individual support items |
| 33 | Upload NDIS agreement (AI parse) | Upload a Schedule of Support PDF. AI extracts NDIS number, plan dates, line items, client details, plan manager, coordinator | Eliminate hours of manual data entry. AI reads the agreement and fills in the fields for you |
| 34 | Identity verification on upload | Cross-checks extracted name, DOB, NDIS number against client record | Catches mismatched documents before they enter your system |
| 35 | NDIS establishment fee toggle | Optional add of NDIS establishment support item for registered providers | Never forget to claim the establishment fee on new service agreements |

### Support Plan
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 36 | 17-section NDIS support plan | About Me, Decision Making, Disability Type, Communication, Goals, Daily Living, Behaviour, Triggers, Learning, Health, Community, Achievements, and more | Complete NDIS audit-ready support plan that covers every Practice Standard requirement |
| 37 | Completion percentage tracker | Progress bar shows how much of the support plan is filled | Know exactly which sections still need work before an audit |
| 38 | Typeform-style editing | One section at a time, back/next navigation with dot indicators | Less overwhelming than a giant form. Staff can complete sections in short bursts |
| 39 | AI support plan rewriting | Button sends section text to Claude AI to rewrite in NDIS audit-ready, person-centred language | Turn rough staff notes into professional support plan content in seconds |
| 40 | Accept or keep original | Compare AI suggestion with original text, choose which to keep | Staff stay in control. AI suggests, humans decide |
| 41 | Voice-to-text on every section | Microphone button activates Web Speech API (en-AU) dictation | Dictate support plan content instead of typing. Faster for field staff |

### Service Agreements
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 42 | Agreement list with status | Table showing all agreements with Draft/Sent/Signed/Expired status badges, total value, dates | Track every service agreement and its signing status in one view |
| 43 | 4-step agreement wizard | Review Details, Add Support Items (NDIS catalogue search), Preview, Send for Signature | Create professional NDIS service agreements in under 5 minutes |
| 44 | NDIS support catalogue search | Search 635 support items by keyword or category with per-state pricing | Find the correct NDIS line items without flipping through the price guide PDF |
| 45 | Line item customisation | Set rate, quantity, staffing ratio (1:1, 1:2, 1:3, group) per item with auto weekly estimate | Tailor each agreement to the client's specific supports and intensity |
| 46 | CC email recipients | Add up to 5 CC emails (plan manager, coordinator, family) | Everyone who needs a copy gets one automatically |
| 47 | Digital signature capture | Canvas signature pad (retina-ready, touch + mouse) with signer name and date | No more printing, posting, scanning. Clients sign on any device |
| 48 | Public signing page | Full /sign/:id page with Schedule of Supports + 22-section Terms & Conditions | Professional signing experience. Clients see everything before they sign |
| 49 | Automatic agreement expiry | Unsigned agreements expire after 14 days. Signing is blocked after expiry | No more agreements floating around unsigned for months |
| 50 | Automated reminders | Email reminders sent on days 3, 5, 7, 12 with urgency-coloured banners (blue to red) | Never chase a signature manually again. The system follows up for you |
| 51 | Signed notification emails | When signed, all parties (participant, admin, up to 5 CCs) get notification + PDF download link | Everyone knows instantly when an agreement is signed |
| 52 | Resend agreement | Re-send the signing email and reset the expiry countdown | Client lost the email? One click to resend |
| 53 | Download PDF | Download the generated or signed agreement as a PDF | Keep copies for your files, auditors, or plan managers |

### Service Records
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 54 | 5 sub-tab service records | Overview, Progress Notes, Incidents, KMs, Behaviours with count badges | All service delivery records for a client in one tabbed view |
| 55 | Overview cards | Summary cards showing count of each record type, click to navigate | Instant snapshot of a client's service history volume |

### Progress Notes
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 56 | 8-step typeform progress note | Goal Progress, Daily Living, Medication, Health/Wellbeing, Community Access, Incidents/Safety, Handover, Sign-off | Structured notes that capture everything auditors look for. No more free-text chaos |
| 57 | Goal progress ratings | Select which NDIS goals were worked on. Rate progress per goal | Direct evidence of goal progress for plan reviews and auditor questions |
| 58 | Medication administration | Record status (N/A, administered, refused, error), list medications, note concerns | Medication records linked to the right client and shift automatically |
| 59 | Mood tracking | Record participant mood per shift | Track wellbeing trends over time. Spot deterioration early |
| 60 | Voice-to-text on all fields | Microphone button on every free-text section | Support workers dictate notes on the spot instead of writing them up later at home |
| 61 | Photo attachments | Upload photos from camera or file system as evidence | Document visible injuries, property damage, or positive outcomes with photos |
| 62 | Auto-save drafts | Automatically saves every 30 seconds to prevent data loss | Never lose a progress note because the app crashed or the browser closed |
| 63 | Offline sync | Notes save to IndexedDB when offline, auto-push when reconnected | Workers in areas with poor reception can still complete notes. Data syncs later |

### 13-Step Typeform Progress Note (Reports)
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 64 | 13-step guided entry | Shift Details, Activities, Health, Medication, Behaviour, NDIS Goals & Rights, Transport, Appointments, Daily Living, Nutrition, Incidents, Summary, Review | The most comprehensive progress note format in any NDIS CRM. Every section auditors check |
| 65 | Single/multi-select cards | Radio and checkbox style answer cards for structured responses | Consistent data format across all workers. No more interpreting handwriting |
| 66 | Restrictive practice capture | Multi-select covering 11 NDIS reportable incident types | Never miss reporting a restrictive practice. The form prompts for it every time |

### Incident Reports
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 67 | 10-section incident report wizard | Identify, Classify, People Involved, Description, Injuries, Restrictive Practice, Immediate Response, Notifications, Root Cause, Sign-off | NDIS Commission-ready incident reports. Every required field captured in one guided flow |
| 68 | AI severity classification | Button sends description to Claude AI. Returns suggested severity + NDIS reportability + rationale | Consistent classification. No more guessing whether an incident is reportable |
| 69 | Auto NDIS reportable flag | System automatically checks "Reportable to NDIS Commission" when a mandatory incident type is selected | Eliminates the risk of failing to report a mandatory incident |
| 70 | Auto CAPA generation | For Medium/High/Critical incidents, AI generates a full Corrective and Preventive Action plan and writes it to the CAPA register | Every serious incident gets a remediation plan immediately, not weeks later |
| 71 | Witness documentation | Add witnesses with names and statements | Complete evidence trail as required by the NDIS Commission |
| 72 | Photo evidence attachment | Upload photos of the incident scene, injuries, or property damage | Visual evidence for investigations and Commission reports |
| 73 | Voice-to-text on all fields | Dictate descriptions, actions taken, follow-up notes | Workers can report incidents from the field in real time |
| 74 | CSV import/export | Bulk import historical incidents or export for external reporting | Migrate from another system or share data with plan managers |

### Behaviour Logs
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 75 | ABC format logging | Antecedent, Behaviour, Consequence format with severity (Minor/Moderate/Major/Critical) | Consistent behaviour documentation that behaviour support practitioners can actually use |
| 76 | Strategy used field | Record which BSP strategy was employed and the outcome | Evidence that staff are implementing behaviour support plans correctly |
| 77 | Trend view toggle | Switch between list and bar chart showing behaviour frequency by client over time | Identify patterns: is behaviour escalating? Is a strategy working? |
| 78 | CSV import/export | Bulk operations on behaviour data | Share behaviour data with behaviour support practitioners |

### Contact History
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 79 | Interaction logging | Log Phone, Email, In Person, SMS interactions with reason and notes | Complete communication trail for every participant, staff member, and jobseeker |
| 80 | Voice-to-text notes | Dictate contact notes after a call or meeting | Capture details while they're fresh without typing |
| 81 | File attachments | Attach files to any contact note | Link emails, photos, or documents to the interaction record |

### Client Documents
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 82 | Document library per client | Upload, categorise (Legal, Schedule of Support, Safety Plan, Service Agreement, Support Plan), download | Every client's documents in one place, categorised and accessible |
| 83 | Expiry status tracking | Valid/Expiring Soon/Expired badges on each document | Never miss renewing a client document |
| 84 | Signed agreements integrated | Signed service agreements automatically appear in the document list | No manual filing. Signed agreements flow into the client file automatically |

### Stakeholder Management
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 85 | Add/view stakeholders | Name, role (7 options: Support Coordinator, Nominee, Plan Manager, Therapist, etc.), phone, email | Know exactly who to call about a participant's plan, health, or legal matters |
| 86 | Decision-making panel | Track whether client is own decision maker. Map decision areas (medical, financial, living, legal) | Critical for restrictive practices. Know who has authority to consent |
| 87 | Click-to-call/email | Clickable phone numbers and emails on stakeholder cards | Contact a plan manager or coordinator in one tap |

### Client Shifts
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 88 | Shift history per client | List of all shifts with date, time, worker, status, service type, travel KMs | See a client's full service delivery history without searching the roster |

### Referral Tracking (per client)
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 89 | Linked referrals | Referrals matched by client ID or name showing stage, service type, referrer | See how a client came to you and track their referral journey |

### AI Stakeholder Report
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 90 | AI report generation | Claude synthesises client data, progress notes, shifts, goals, and budget into a structured report | Generate a professional stakeholder update in seconds instead of spending 4 hours writing one |
| 91 | 6-section NDIS format | Executive Summary, Service Delivery, Progress Toward Goals, Budget Utilisation, Observations, Action Items | Report format that support coordinators and plan managers expect to receive |
| 92 | Per-stakeholder action items | Each stakeholder gets specific recommended next steps | Clear accountability. Plan managers know what you need from them |
| 93 | Copy/download/regenerate | Copy to clipboard, download as text, or regenerate a fresh version | Flexible output. Paste into an email, save to file, or try again |

---

## Module 3: Staff Management

### Staff Profile
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 94 | 7-tab staff detail view | Details, Employment, Service Records, Conversations, Contact History, Training, Invoices (contractors) | Complete staff file in one place. No more paper folders or separate HR systems |
| 95 | Personal details editing | Name, DOB, gender, pronouns, ethnicity, phone, email, address, emergency contact | Full HR profile that meets employment record-keeping requirements |
| 96 | Director password reset | Directors can set a new password or create an auth account for any staff member | No more Supabase dashboard access needed. Directors self-serve |
| 97 | Employment/pay rate banner | Prominently displays employment type and current rate | Instantly see a worker's pay details when reviewing their profile |

### Employment and Pay
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 98 | SCHADS stream selector | Choose Home Care or SACS stream. View all levels and pay points | Correctly classify every worker under the right SCHADS stream |
| 99 | Assign SCHADS pay level | Click any level row to assign it. Full breakdown of base, penalties, super, allowances | One click to set compliant pay. Shows exactly what each shift costs at every rate |
| 100 | Contractor rate templates | Create named rate templates (hourly, per shift, per day, per km). Assign to individual contractors | Standardise contractor pricing. No more ad-hoc rate negotiations |
| 101 | Custom rate entry | Enter custom hourly charge and pay rates for contractors | Flexibility for unique contractor arrangements |
| 102 | Employment tenure | Start date auto-calculates and displays tenure | Know how long every team member has been with you |
| 103 | Contractor ABN field | Store and display ABN for all contractors | ABN always accessible for invoicing and ATO requirements |
| 104 | Contracts and documents sub-tab | List of employment contracts and documents on file | Digital employment file. Everything in one place |
| 105 | Leave records sub-tab | View leave history with type, dates, and approval status | Track leave without a separate leave management system |

### Certifications
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 106 | 6 mandatory cert types | NDIS Worker Screening, Blue Card (WWCC), Driver Licence, First Aid, CPR, Car Insurance | Track every cert auditors check. Colour-coded expiry badges make gaps obvious |
| 107 | Expiry status badges | Expired/Expiring Soon/Current badges based on date proximity | Visual alert system. Red means action needed now |
| 108 | Document upload per cert | Attach a copy of the certificate as evidence | Digital cert storage. No more photocopying and filing |
| 109 | AI document verification | Upload a photo of a cert. Claude Vision extracts holder name, cert number, expiry, issuing body, qualifications | Workers photograph their certs on their phone. AI reads and fills in the fields. Zero manual data entry |
| 110 | Confidence scoring | AI returns high/medium/low confidence on legibility | Low-quality uploads flagged for resubmission. No silently accepting unreadable docs |
| 111 | Document type matching | AI checks extracted cert matches the expected type | Catches "uploaded Driver Licence when we asked for Blue Card" errors |

### Staff Service Records
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 112 | Progress notes by staff | All progress notes authored by a specific worker | Review a worker's documentation quality across all their clients |
| 113 | Incidents by staff | All incidents involving a specific worker | Identify workers with high incident involvement for support or training |
| 114 | Staff exclusions (banned clients) | List clients a worker is banned from being rostered with, with reason (Client Request/Staff Request) and comments | Enforce boundaries. The roster blocks excluded worker-client combinations automatically |
| 115 | Assigned clients | All clients this worker has been rostered with, with shift counts and last shift date | See a worker's client portfolio at a glance |

### Staff Invoices (Contractors)
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 116 | Invoice management | View all invoices with Draft/Submitted/Approved/Paid status | Track every contractor invoice through the approval pipeline |
| 117 | Approve and pay invoices | Directors mark invoices as approved then paid | Clear approval workflow. No more paying unreviewed invoices |
| 118 | Download PDF tax invoice | Generate formatted PDF with line items, ABN, GST summary using jsPDF | Professional invoices for your records and the ATO |
| 119 | Expand invoice detail | Click to see full line items, subtotal, GST, total, notes | Review exactly what a contractor is billing for before approving |

### Training Records
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 120 | Add training records | Title, provider, completion date, expiry date, status | Track all training beyond the LMS (external courses, face-to-face, conferences) |
| 121 | Training status badges | Completed/In Progress/Expired on each record | Visual status at a glance |

### Staff Availability (Admin View)
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 122 | Read-only availability grid | 7-day x 4-slot grid showing what the worker submitted | Know when staff are available before creating shifts |
| 123 | Change history | Audit log of last 20 availability changes | Track when and how availability changed |

---

## Module 4: Recruitment (ATS)

### Jobseeker Management
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 124 | 4-stage recruitment pipeline | CV Received, Interview, Letter of Offer, Onboard as clickable stages | Visual Kanban-style recruitment tracking |
| 125 | Advance stage with one click | Click the next stage to move the jobseeker forward | Streamlined pipeline management |
| 126 | Convert to employee | Button creates a staff record from the jobseeker, marks them as converted | Seamless transition from candidate to employee. No re-entering data |
| 127 | Skills and certification chips | Add/remove skill and certification tags | Quick-scan candidate capabilities |
| 128 | CV filename display | Shows the uploaded CV file if one was parsed | Know which candidates have CVs on file |

### Bulk CV Upload
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 129 | Upload multiple CVs at once | Drag-and-drop one or more PDF files | Process a stack of applications in minutes instead of hours |
| 130 | AI CV text extraction | pdf.js extracts raw text client-side without server upload | Privacy-first. CVs never leave the browser until you import |
| 131 | Auto-parse candidate fields | Regex extracts name, email, phone, address from CV text | AI reads the CV and fills in the form. Zero manual data entry |
| 132 | Auto-detect certifications | 8 cert patterns (WWCC, NDIS, CPR, First Aid, etc.) detected in CV text | Instantly know which candidates already have the certs you require |
| 133 | Auto-detect skills | 10 skill patterns (disability support, mental health, etc.) detected | Match candidates to roles based on their stated skills |
| 134 | Review and edit before import | Table shows all parsed candidates. Edit any field before committing | Human review of AI parsing. Fix any mistakes before they enter your database |
| 135 | Batch import | Submit all reviewed candidates as new jobseeker records | One click to import 20 candidates |

---

## Module 5: Referral Pipeline

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 136 | 6-stage Kanban pipeline | New Referral, Contact Made, Meet & Greet, Agreements, Won, Lost | Visual referral tracking from first enquiry to onboarded client |
| 137 | Drag-and-drop stage changes | Move referral cards between columns | Quick status updates with one gesture |
| 138 | Full referral details | Participant name, DOB, NDIS number, suburb, service type, source, notes, assigned coordinator | Capture everything you need to progress a referral |
| 139 | Multi-filter referral board | Filter by service type, assigned coordinator, suburb | Focus on specific referral segments |
| 140 | Won: auto-create client | Moving to Won prompts client creation from referral data | Convert a referral to an active client without re-entering information |
| 141 | Lost: reason capture | Loss reason prompted before moving to Lost stage | Track why you lose referrals. Identify patterns. Fix conversion blockers |

---

## Module 6: Rostering and Scheduling

### Roster Calendar
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 142 | Weekly/fortnightly/monthly views | Calendar grid with shifts colour-coded by status | See your entire roster at the zoom level that suits you |
| 143 | Staff view and client view | Toggle between viewing from worker perspective or client perspective | Answer "who's working today?" and "who's seeing David today?" with one toggle |
| 144 | List view toggle | Flat list of all shifts for the period | Quick scanning when the calendar is too dense |
| 145 | Create shift modal | Date, start/end time, worker, client, service type, site, notes, NDIS line items, sleepover toggle | Full shift creation with every field you need in one form |
| 146 | Edit and delete shifts | Click any shift to modify or remove it | Quick corrections without starting from scratch |
| 147 | Live SCHADS cost preview | Real-time pay cost calculation as shift times are entered | Know exactly what a shift costs before you publish it |
| 148 | Live NDIS line items | Auto-matches NDIS support item and rate based on service type and time | Ensure every shift bills against the correct NDIS line item |
| 149 | Sleepover toggle | Checkbox flags a shift as a sleepover (flat rate) | Correct sleepover costing applied automatically |
| 150 | Duplicate shift as vacant | Copy shift without a worker assigned, open for applications | Create open shifts for workers to pick up |
| 151 | Duplicate shift (copy) | Copy all shift details into a new shift | Rapid scheduling for recurring patterns |
| 152 | Drag-and-drop reschedule | Drag a shift to a different day/time | Reschedule in one gesture |
| 153 | CSV import/export shifts | Bulk import or download shifts | Migrate roster data or share with payroll |
| 154 | Filter by worker, client, service type, status | Narrow the roster to exactly what you need | Find specific shifts instantly |

### AI Staff Suggestions
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 155 | AI-ranked staff recommendations | Scores up to 10 available workers by suitability (0-100) considering qualifications, exclusions, hours, gender preference, cultural compatibility, travel distance, availability, past shifts, SCHADS overtime threshold, time conflicts | Stop guessing who to roster. AI recommends the best-fit worker for every shift |
| 156 | Overtime warning flags | Workers approaching or exceeding 38hr SCHADS weekly limit flagged | Avoid unplanned overtime costs and compliance breaches |
| 157 | Time conflict detection | Workers with overlapping shifts on the same day flagged and ranked last | Prevent double-booking before it happens |
| 158 | Staff exclusion enforcement | Excluded workers hidden from the shift assignment dropdown | Impossible to accidentally roster a banned worker with a client |
| 159 | Send notification to suggested staff | Email/SMS selected staff about the available shift | First-in-first-served shift filling without manual phone calls |

### Shift Applications
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 160 | Worker shift applications | Workers see vacant shifts on their roster and apply with one tap | Workers self-select available shifts. Less admin time filling gaps |
| 161 | Application status tracking | Pending (yellow), Approved (green), Declined (red) | Workers know where they stand. No more "did they see my message?" |
| 162 | Admin approval panel | Blue notification panel on the roster with Approve/Decline buttons per applicant | Review and approve shift applications without leaving the roster view |
| 163 | Auto-assign on approval | Approving an application auto-assigns the worker to the shift | One click from application to confirmed shift |

### SCHADS Compliance Bot
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 164 | Inline compliance warnings | Per-worker flags for weekly overtime, daily overtime, casual minimum engagement, meal breaks, broken shifts | Every SCHADS violation visible directly on the roster before you publish |
| 165 | Weekly overtime detection | Error when exceeding 38 hours, warning when approaching | Prevent costly overtime by catching it before shifts are confirmed |
| 166 | Daily overtime detection | Flag when any worker has 10+ hours in a single day | Comply with daily hour limits under the SCHADS Award |
| 167 | Casual minimum engagement | Flag when a casual shift is under 2 hours | Avoid underpaying casuals. SCHADS requires minimum 2-hour engagement |
| 168 | Meal break detection | Flag when 5+ continuous hours without a break | Ensure workers get legally required breaks |
| 169 | Broken shift detection | Flag when 2+ shifts on the same day span 12+ hours | Catch broken shift allowance obligations |

### Timesheets
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 170 | Weekly timesheet view | Per-worker collapsible sections showing shifts with scheduled vs actual times | Compare what was planned with what actually happened |
| 171 | Edit actual times | Enter actual start/end and break minutes inline | Correct timesheets without a separate form |
| 172 | Individual approve/reject | Green tick or red X per shift entry | Granular timesheet approval. Reject questionable entries individually |
| 173 | Bulk approve all | One-click approve all pending entries with confirmation | Process an entire week of timesheets in seconds |
| 174 | Variance calculation | Shows difference between scheduled and actual hours | Spot workers consistently over or under their rostered time |
| 175 | CSV export | Download filtered timesheets for payroll | Send to your payroll provider or accountant without re-typing |

### Sites
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 176 | Site management (5 tabs) | Details (with WiFi, linked clients), Property (SDA, tenancy, landlord), Documents, Utilities (Gas/Power/Water/Internet), Photos | Complete property file for every SIL house, group home, or service location |
| 177 | Linked clients per site | See which clients are placed at each site | Know who lives where at a glance |
| 178 | Utility account tracking | Store provider, account number, and contact per utility | Never hunt for the electricity bill account number again |
| 179 | Photo gallery with lightbox | Upload site photos, view in full-screen lightbox | Document property condition for tenancy, SDA, or insurance purposes |
| 180 | Site document library | Upload and manage documents per site (leases, fire plans, etc.) | All site documents accessible without digging through email |

### Staff Hours Overview
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 181 | Custom date range analysis | Flexible from/to date pickers with This Week/Fortnight/Month shortcuts | Analyse hours for any period: a specific week, a pay run, or a full month |
| 182 | SCHADS classification breakdown | Hours split by Day Shift, Afternoon, Night, Saturday, Sunday, Public Holiday, Overtime per worker | Know exactly where your labour costs are going. Sunday shifts costing too much? Now you can see it |
| 183 | Sleepover and broken shift counts | Columns per worker showing sleepover shifts and broken shift days | Track additional allowance obligations |
| 184 | Travel KM tracking | Total kilometres per worker | Monitor travel costs and reimburse accurately |
| 185 | Calculated total pay | SCHADS penalty multipliers for employees, flat rate for contractors, with grand total | Full payroll cost visibility before running payroll |
| 186 | SCHADS vs Contractor toggle | Switch between employee and contractor views with appropriate columns | Different data for different employment types |
| 187 | CSV export | Download the full breakdown with context-appropriate columns | Hand to your accountant or payroll provider |

### Staff Costs
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 188 | Week/month toggle | Switch between weekly and monthly cost aggregation | Match your analysis to your pay cycle |
| 189 | KPI summary cards | Total Hours, Total Cost, Total Shifts, Active Staff | Quick labour cost snapshot |
| 190 | Per-staff cost breakdown | Name, role, employment type, shifts, hours, rate, total cost | See exactly where your payroll dollars go |
| 191 | CSV export | Download the cost breakdown | Share with management or accountant |

### Client Budget Tracking
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 192 | Budget summary KPIs | Total Allocated, Total Spent, Total Remaining across all clients | Organisation-wide budget health at a glance |
| 193 | Per-client budget table | NDIS number, allocated, spent, remaining, colour-coded utilisation bar (green/amber/red) | Instantly spot clients at risk of running out of budget |
| 194 | Search and sort | Filter by name, sort by name or utilisation percentage | Find specific clients or surface the most urgent budget situations |
| 195 | NDIS price guide reference | Collapsible panel showing 2025-26 common support item rates by category and state | Check pricing without leaving the budget page |
| 196 | State/region selector | Switch displayed prices between all Australian states | Correct rates for your service area |
| 197 | CSV export with totals | Download including a TOTALS row | Budget report for plan reviews, audits, or management |

### NDIS Price Catalogue
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 198 | Full 635-item catalogue | All NDIS support items with registration groups, codes, descriptions, pricing | Complete price guide reference inside your CRM. No more separate PDF |
| 199 | Search across all fields | Text search on item name, number, and registration group | Find any support item in seconds |
| 200 | Filter by category (1-15) | Toggle buttons per NDIS category with item counts | Browse by support category |
| 201 | Filter by support type | Price Limited, Quotable, Unit Price = $1 toggles | Find specific pricing structures |
| 202 | Expand for all-region pricing | Click any item to see prices for every Australian state/territory | Compare pricing across regions for multi-state providers |
| 203 | Support flags | Non-Face-to-Face, Provider Travel, Short Notice Cancellations, NDIA Requested Reports, Irregular SIL | Understand every pricing flag at a glance |

---

## Module 7: QMS (18 Compliance Registers)

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 204 | Compliance dashboard | All 18 registers as cards with total records, open/overdue counts, last updated, colour-coded status | Your entire compliance position on one screen. Know exactly where you stand |
| 205 | Audit readiness score | Circular gauge showing percentage of registers with no overdue items | One number that tells you: are we audit-ready or not? |
| 206 | Auto-populated badge | Cards for registers sourced from operational data show "Auto" badge | Know which registers maintain themselves vs which need manual attention |
| 207 | CSV export all | Download all 18 register summaries as one CSV | Compliance snapshot for management or external consultants |
| 208 | Register record management | Create, edit, delete records in any of the 18 registers with register-specific fields | Guided forms for each register type. Staff don't need to guess what fields to fill |
| 209 | Status filter per register | Filter records by open/in-progress/closed/overdue | Focus on what needs attention right now |
| 210 | Search within a register | Text search across all column values | Find specific records in large registers |
| 211 | CSV export per register | Download filtered records from any individual register | Extract data for specific audit requirements |
| 212 | Voice input on all forms | All multi-line text fields support voice dictation | Faster data entry for staff entering register records |
| 213 | Read-only sourced registers | Auto-populated registers show data but prevent editing (edit at source) | Data integrity. Incident register can't be modified without modifying the actual incident report |
| 214 | Pagination | Large record sets load in batches of 50 | Performance stays fast even with thousands of records |

### The 18 Registers

| # | Register | Category | Auto-populated | What It Tracks |
|---|----------|----------|----------------|----------------|
| 215 | Risk Register | Governance & Risk | No | Organisational risks with likelihood x consequence matrix, controls, owners, review dates |
| 216 | Legislative Compliance | Governance & Risk | No | Legislation your org must comply with, status per law, responsible person |
| 217 | Quality Improvement | Governance & Risk | No | Continuous improvement initiatives, outcomes, and evidence |
| 218 | Internal Audit | Governance & Risk | No | Internal audit findings, recommendations, and follow-up status |
| 219 | Incident Register | Incidents & Safety | Yes (incident_reports) | All incidents with type, severity, people involved, actions taken |
| 220 | Reportable Incidents | Incidents & Safety | Yes (incident_reports, is_reportable=true) | NDIS Commission-reportable incidents with notification dates and report status |
| 221 | CAPA Register | Incidents & Safety | No (AI-generated from incidents) | Corrective and Preventive Actions: root cause, corrective steps, preventive measures, due dates |
| 222 | Restrictive Practices | Incidents & Safety | No | All uses of restrictive practices with type, authorisation, duration, outcome |
| 223 | Complaints Register | Complaints & Feedback | No | Complaints received, complainant details, resolution, satisfaction |
| 224 | Compliments Register | Complaints & Feedback | No | Positive feedback and compliments received |
| 225 | Worker Screening | Workforce & Screening | Yes (certifications) | Worker clearance checks: NDIS Screening, WWCC, police, with expiry tracking |
| 226 | Staff Training | Workforce & Screening | Yes (lms_enrollments) | Training records, completion dates, scores, linked to the LMS |
| 227 | Staff Qualifications | Workforce & Screening | No | Formal qualifications (Cert III, Cert IV, diplomas, degrees) |
| 228 | Key Personnel | Workforce & Screening | Yes (users) | Key management personnel: role, start date, qualifications, fitness declarations |
| 229 | Participant Files | Participant Records | No | Individual participant file completeness tracking |
| 230 | Service Agreements | Participant Records | Yes (client_agreements) | All service agreements with status, value, and signing dates |
| 231 | Consent Register | Participant Records | No | Consent records for services, data sharing, photography, restrictive practices |
| 232 | Medication Administration | Participant Records | No | Medication records with drug, dose, route, frequency, prescriber, administration details |

---

## Module 8: NDIS Auditor AI

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 233 | Automated compliance audit | Analyses all portal data against 23 NDIS Practice Standards (Divisions 1-4, Module 1, Module 2a). Calculates 0-100% score per standard | Know your compliance score any time. No more waiting for an auditor to tell you what's wrong |
| 234 | Overall compliance score dial | Circular gauge with Compliant/Partially Compliant/Non-Compliant label | One number that answers: "are we ready for an audit?" |
| 235 | Top strengths and risks | Highlights top 3 strongest standards and all standards below 80% with priority labels | Focus remediation effort where it matters most |
| 236 | Evidence and gaps per standard | Expand any standard to see evidence found, gaps identified, and remediation recommendations | Detailed gap analysis that tells you exactly what to fix |
| 237 | Create task from recommendation | Plus-Task button creates a task with auto-set priority from audit score | Turn audit findings into assigned tasks in one click |
| 238 | Incident trend chart | 6-month bar chart of incident counts within audit results | Auditors love trend data. This is pre-built for you |
| 239 | Export audit as PDF | Print-ready HTML report with all standards, scores, gaps, strengths, incidents | Hand this to your auditor or board. Professional format ready to go |
| 240 | Audit history | Last 10 audit runs with dates and scores | Track your compliance trajectory over time. Are you improving? |
| 241 | Re-run anytime | Fresh audit on demand based on current data | Run an audit before a real audit. Know your score before the auditor does |

---

## Module 9: SCHADS Compliance

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 242 | Per-worker weekly analysis | Table showing each worker's weekly hours with colour-coded violation flags | See every SCHADS issue across your workforce at a glance |
| 243 | Weekly overtime violation | Error badge when exceeding 38 hours, warning when approaching | Prevent unplanned overtime costs before payroll |
| 244 | Daily overtime violation | Flag for 10+ hours in a single day | Comply with daily hour limits |
| 245 | Casual minimum engagement | Flag for under-2-hour casual shifts | Avoid Fair Work underpayment claims |
| 246 | Meal break detection | Flag for 5+ continuous hours without a break | Ensure legal break entitlements |
| 247 | Broken shift detection | Flag for 2+ shifts spanning 12+ hours same day | Track broken shift allowance obligations |
| 248 | SCHADS penalty rate reference | Read-only table showing weekday, Saturday, Sunday, public holiday rates for permanent and casual | Quick reference without leaving the page |

---

## Module 10: Training (LMS)

### Course Library
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 249 | 21 NDIS-compliant courses | 8 NDIS Practice Standards, 6 WHS, 7 Company Policies & Induction. 136 modules, 272 quiz questions | Complete training library out of the box. No need to build courses from scratch |
| 250 | Category filter tabs | All, NDIS Standards, WHS, Company Policy, Induction, Custom | Browse by training category |
| 251 | Search courses | Filter by title | Find any course instantly |
| 252 | Training statistics | Totals for all courses, completed, in-progress, mandatory | Organisation-wide training health at a glance |
| 253 | Per-course progress bar | Each card shows enrollment status and visual progress | See who has started, who is behind, who is done |
| 254 | Mandatory/practical badges | Courses show "Mandatory" and "Practical" indicators | Know which courses are required and which need hands-on sign-off |

### Course Detail and Quizzes
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 255 | Module sidebar navigation | Click module names to navigate. Locked modules show padlock until previous is completed | Sequential learning. Workers can't skip ahead without completing each module |
| 256 | Rich HTML content | Scenario cards, step accordions, decision points, callout boxes, key term highlights | Interactive content that engages workers. Not just walls of text |
| 257 | Interactive scenario answers | Click "Show Answer" to reveal/hide scenario responses | Active learning. Workers think before seeing the answer |
| 258 | Decision-point exercises | Click options to get instant correct/incorrect feedback | Practical decision-making practice within the module |
| 259 | Module quizzes | Question-by-question quiz with submit, pass/fail, and retry | Assessment that proves comprehension. Evidence for auditors |
| 260 | Completion certificates | PDF certificate with name, course, date, score, and audit cert ID | Printable evidence of course completion for NDIS audits |
| 261 | Theory complete banner | When a course requires practical sign-off, a banner shows theory is done but practical is pending | Clear visibility that theory alone doesn't mean competency |

### Personal Training Dashboard (MyTraining)
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 262 | Onboarding progress ring | Circular indicator showing percentage of onboarding courses completed | New workers see exactly how much induction they have left |
| 263 | Training stats grid | Completed, average score, overdue counts | Personal training health at a glance |
| 264 | Status-grouped course list | Overdue (red), Theory Complete (amber), In Progress, Not Started, Completed | Prioritised view. Overdue courses surface to the top |
| 265 | Filter by status | Tabs to filter by All, Overdue, In Progress, Awaiting Sign-Off, Not Started, Completed | Focus on what matters right now |

### Team Progress (Admin)
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 266 | Staff training progress table | Every staff member with role, onboarding status, completed/total courses, average score, overdue count, practical pending/expiring | Complete training compliance view across your entire workforce |
| 267 | Bulk enroll staff | Select multiple staff, choose courses, enroll all at once | Assign mandatory training to 30 workers in 3 clicks |
| 268 | CSV export team progress | Download training metrics for all staff | Training compliance report for audits or management |
| 269 | Navigate to individual training | Click a staff row to see their personal training list | Drill into any worker's training detail |
| 270 | Practical expiry indicators | Colour-coded counts for pending, expiring within 30 days, and expired practical sign-offs | Catch expiring competencies before workers become non-compliant |

### Practical Assessments
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 271 | Assessment queue | Prioritised list of all workers needing practical sign-off: expired, expiring, awaiting initial, reassessment | Know exactly who needs assessment and how urgent it is |
| 272 | Competency checklist | Per-item Competent/Not Yet Competent/N/A selection with notes | Structured assessment that produces consistent, auditable results |
| 273 | Participant-specific assessment | Link an assessment to a specific client/participant | Proves competency with the actual participants a worker supports |
| 274 | Assessment type selection | Initial, Annual, Inactivity, Plan Change | Track why each assessment was conducted |
| 275 | Result override | Manually set Competent or Not Yet Competent even if checklist auto-calculates differently | Assessor judgment takes precedence when needed |
| 276 | Draft save | Save assessment in progress without finalising | Complete complex assessments across multiple sessions |
| 277 | Trigger reassessment | Create a new assessment for reasons: Plan Change, Incident Related, Worker Inactivity, Other | Respond to incidents or plan changes with immediate competency review |

### Supervision Links
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 278 | Supervision-training gap tracker | Link training gaps identified in supervision sessions to courses or custom actions | Close the loop between supervision observations and actual training |
| 279 | Auto-enroll on course link | Linking a recommended course auto-enrolls the worker | Supervision finding to training assignment in one step |
| 280 | Status tracking | Identified, Enrolled, Completed, External Completed | Track each gap through to resolution |

### AI Course Builder
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 281 | Upload document to generate course | Upload a PDF or DOCX policy/procedure document. AI creates structured course with modules, quizzes, interactive components | Turn any policy document into a training course without instructional design skills |
| 282 | Module content generation | AI generates HTML content with scenario cards, decision points, callout boxes, key terms | Interactive course content that engages workers, not just the policy text reformatted |
| 283 | Quiz generation | 4 questions per module with correct answers and explanations | Assessment built automatically. No question writing needed |
| 284 | NDIS Practice Standards mapping | AI maps content to relevant Practice Standards | Every AI-built course is linked to compliance requirements |
| 285 | Plain English rewriting | Content auto-written at Year 10 reading level, active voice, max 20 words per sentence | Accessible content for all workers regardless of education level |
| 286 | Preview and publish | Review AI output before making it available. Publish when satisfied | Human quality control before training goes live |
| 287 | Job status tracking | Uploading, Processing, Ready for Review, Published, Failed | Know where every AI course generation job stands |

### Compliance Report
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 288 | Training compliance overview | Total staff, onboarding percentage, enrollments, overdue, expiring within 30 days | Organisation-wide training compliance at a glance |
| 289 | Course completion rates table | Each course with enrolled count, completed count, completion rate (colour-coded) | Identify courses where completion is lagging |
| 290 | Practical competency dashboard | Completed, pending, expired, and expiring sign-offs | Track hands-on competency status |
| 291 | NDIS audit evidence mapping | 13 quality indicators mapped to LMS courses with evidence status (tick/warning) | Pre-built audit evidence. Shows auditors exactly which training addresses which Practice Standard |
| 292 | Audit evidence pack PDF | Multi-page PDF: cover page, organisation overview, course completion rates, NDIS evidence mapping, overdue training | Hand this PDF to your NDIS auditor. Complete training evidence in one document |

### Auto-enrollment
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 293 | Onboarding auto-enrollment | New staff are automatically enrolled in all mandatory onboarding courses with a 14-day deadline | Every new hire starts training on day one. No manual enrollment needed |

---

## Module 11: Reports and Analytics

### Reports Dashboard
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 294 | Progress notes with filters | View, create, import, export progress notes filtered by client, worker, date range | All progress notes in one searchable view |
| 295 | Goal alignment tracking | See which NDIS goals each progress note is linked to | Direct evidence that supports align with participant goals |
| 296 | Concern flagging | Toggle a concern flag on any note | Flag notes for team leader review without changing the note itself |
| 297 | Incident reports management | Full CRUD with CSV import/export, filter by client/type/severity/status/date | Complete incident management with flexible reporting |
| 298 | Behaviour logs with trends | ABC format logging with bar chart trends over time | Track whether BSP strategies are working |
| 299 | Compliance documents view | All Company Files displayed with review countdown badges | See which policies are overdue for review |
| 300 | Staffing vs client analysis | Monthly staff pay costs vs client NDIS billing, showing margin | Are you making or losing money on each client? Now you know |
| 301 | Client report generation | Select client, date range, data types. Print formatted HTML report | Generate reports for plan reviews, meetings, or coordinator requests |

### Company Files
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 302 | Document library | Grid/list view, 8 categories, search, sort, multi-select | Organised document management for policies, procedures, HR, templates |
| 303 | NDIS required documents checklist | Shows 15 required NDIS policies with tick/cross for each | Know exactly which mandatory policies you still need to create |
| 304 | Review period tracking | Each document has a review date with countdown | Never miss a policy review deadline |
| 305 | CSV import/export | Bulk operations on document metadata | Migrate document lists from another system |
| 306 | Mark as reviewed | Update last-reviewed date to today with one click | Quick review signoff during audit preparation |

---

## Module 12: AI Features

### AI Chat (Denise)
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 307 | Admin AI assistant | Floating draggable chatbot on all admin pages. Answers NDIS, SCHADS, compliance, and policy questions | Instant answers to operational questions without searching Google or calling the NDIS Commission |
| 308 | Worker policy bot | Separate floating chatbot for workers. Answers policy, procedure, and guideline questions | Workers get answers in the field without calling the office |
| 309 | Knowledgebase-grounded responses | AI answers from uploaded company policies and procedures | Answers are specific to YOUR organisation, not generic NDIS advice |
| 310 | Multimodal image chat | Attach photos to chat messages for AI analysis | Workers can photograph a situation and ask the AI about it |
| 311 | Document attachment analysis | Upload text/CSV/markdown files for AI context | Share a document with the AI for analysis or questions |
| 312 | Per-org persona customisation | Custom bot name, greeting, personality, avatar colour, avatar icon | Each tenant can personalise their AI assistant |
| 313 | Auto-nudge notification | After 5 minutes of inactivity, a nudge appears reminding staff the AI is available | Encourages adoption. Workers forget the chatbot exists without reminders |

### AI Chatbot Configuration
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 314 | Configure admin bot | Set name, greeting, personality instructions, avatar colour (8 options), icon (8 options) | Customise the AI to match your organisation's voice and branding |
| 315 | Configure worker bot | Separate configuration for the worker-facing bot | Different persona for workers vs office staff |
| 316 | Upload knowledgebase | Drag-drop PDF, DOCX, XLSX, CSV, TXT, or MD files (max 10MB) as AI knowledge sources | Feed the AI your specific policies so it answers from YOUR documents |
| 317 | Delete knowledgebase documents | Remove individual knowledge sources | Keep the AI knowledge current by removing outdated docs |

### AI Report Writing
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 318 | Stakeholder report generation | Claude synthesises client data, notes, shifts, goals, budget into 6-section NDIS report | Reports that take 4 hours now take 30 seconds |
| 319 | Support plan AI rewriting | Section-by-section rewriting into NDIS audit-ready, person-centred language with SMART goals | Turn rough notes into professional support plans |
| 320 | Incident AI classification | AI suggests severity, NDIS reportability, rationale | Consistent, defensible incident classification |
| 321 | Auto CAPA from incidents | AI generates corrective and preventive action plans for serious incidents | Every significant incident gets a remediation plan immediately |
| 322 | Complaint detection in notes | AI scans progress notes for embedded complaints | Catches complaints workers didn't formally log. NDIS requires all complaints to be registered |
| 323 | Medication voice parsing | Voice transcript parsed into structured medication fields | Workers speak the medication administration and AI fills in the form |

### AI Document Processing
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 324 | NDIS agreement parsing | Upload a Schedule of Support PDF. AI extracts all structured data | Eliminate hours of manual data entry from new agreements |
| 325 | CV text extraction | pdf.js extracts candidate data from CVs client-side | Process job applications in bulk without reading every CV |
| 326 | Document text extraction | Extract text from PDF, DOCX, XLSX, TXT, CSV, MD for AI knowledgebase | Any document format can feed the AI chatbot |
| 327 | AI cert verification | Upload photo of any cert. Claude Vision extracts all fields | Workers photograph certs on their phone. AI does the data entry |

### Voice-to-Text
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 328 | VoiceTextArea component | Microphone button on every textarea in the app. Australian English (en-AU) speech recognition | Dictate instead of type. Faster for field workers, especially on mobile |
| 329 | Visual dictation state | Red border and pulsing mic when listening. "Listening... speak now" hint | Clear feedback that the system is listening |
| 330 | Graceful fallback | Mic hidden if browser doesn't support Speech API | Works on Chrome/Edge. Degrades gracefully on Safari/Firefox |

---

## Module 13: Automations

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 331 | Trigger-condition-action builder | Entity (7 types) + field + operator + value triggers one or more actions | Build custom automations without code. "When an incident is marked Critical, email the Director" |
| 332 | 5 action types | Send Email, Send SMS, Create Task, Flag for Review, AI Prompt | Cover the most common automation needs |
| 333 | 7 trigger entities | Clients, Staff, Progress Notes, Incidents, Referrals, Tasks, Shifts | Automate across every area of your business |
| 334 | 6 pre-built templates | WWCC Expiring, First Aid Expiring, NDIS Plan Ending, Incident Submitted, Restrictive Practice Used, New Referral | Start with proven automations. Customise from there |
| 335 | Test run | Dry-run against live data showing how many records match | Verify your automation works before it goes live |
| 336 | Run history | Last 20 execution logs with timestamps, matched records, outcome | Audit trail for every automation that fires |
| 337 | Enable/disable toggle | Pause automations without deleting them | Turn off automations during system changes or testing |
| 338 | Duplicate automation | Copy an existing automation as a starting point | Build variations without starting from scratch |
| 339 | AI Prompt action | Trigger Claude to analyse matched records and return insights | AI-powered automation. "When a progress note mentions behaviour, AI analyses severity" |
| 340 | Image analysis in automations | Images attached to triggers are sent to Claude Vision | Visual AI analysis within automated workflows |

---

## Module 14: Document Templates and Deployment

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 341 | Template management | Upload .docx templates with {{placeholder}} fields. Browse by Staff/Client/Jobseeker category | Create once, deploy to every new hire or client |
| 342 | Placeholder auto-resolution | Templates auto-fill with recipient data (name, email, NDIS number, dates, rates, ABN, org name) | No more find-and-replace in Word documents |
| 343 | Deploy to individual | Search for a person, preview filled values, send for signing | Send a personalised document in under 30 seconds |
| 344 | Digital signing page | Public URL with document review and canvas signature pad | Recipients sign on any device. No printing or scanning |
| 345 | Expiry tracking | Deployments expire after 14 days. Signed/viewed/expired status tracked | Follow up on unsigned documents proactively |
| 346 | Per-org email branding | Emails come from your organisation name, not "Titus CRM" | Professional appearance to recipients |

---

## Module 15: Worker Portal

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 347 | Mobile-optimised portal | 4-tab bottom nav (Roster, Clients, Timesheets, Availability) + My Details header link | Purpose-built mobile experience for field workers |
| 348 | Roster with shift details | Weekly view, expand shifts to see client address, tasks, upcoming calendar | Workers know where to go and what to do without calling the office |
| 349 | Apply for shifts | Workers see vacant shifts with suburb and gender preference, apply with one tap | Self-service shift filling reduces admin time |
| 350 | Unavailability indicators | UNAVAILABLE and ON LEAVE badges on the roster calendar | Workers see at a glance which days they can't be rostered |
| 351 | Progress notes from roster | "Add Progress Note" button on expanded shifts pre-fills shift details | Notes created in context, linked to the right shift and client |
| 352 | Incident reports from roster | "Add Incident" on expanded shifts | Report incidents immediately from the field |
| 353 | Client detail (read-only) | View client profile, support plan, and service records | Workers access what they need to know about a client without full admin access |
| 354 | Timesheet view | Past shifts grouped by week with total hours | Workers verify their own hours before payroll |
| 355 | Contractor invoice creator | Select date range, auto-populate line items from shifts, edit rates, add GST, submit PDF | Contractors create and submit invoices directly. No external invoicing software needed |
| 356 | Availability grid | Toggle Morning/Afternoon/Evening/Overnight across 7 days | Workers manage their own availability. Updates visible to roster officers immediately |
| 357 | Leave management | Add leave periods with type (Annual, Sick, Personal, Unpaid) | Workers log leave directly. Admin sees it on the roster |
| 358 | My Details profile | Edit contact info, emergency contact, upload 6 mandatory certs with AI verification, view employment details, access training | Workers maintain their own profile and certifications |
| 359 | Worker alerts | Cert expiry alerts (60/30/21/14/7/3/1 days + expired + missing), missing progress note alerts, draft incident alerts | Workers see what they need to action immediately on login |
| 360 | Offline support | IndexedDB queue for progress notes and incidents. Auto-sync when back online | Works in areas with no reception. Data syncs when connectivity returns |
| 361 | Conflict resolution | Side-by-side diff when offline data conflicts with server changes | Keep Mine vs Keep Server choice when the same record was edited in two places |

---

## Module 16: Settings and Administration

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 362 | Organisation profile | Name, ABN (auto-formatted), NDIS registration number, state, timezone | Central settings for your entire organisation |
| 363 | Logo upload | Upload, change, or remove company logo (PNG/JPG/SVG, max 2MB) | Branded experience across the portal |
| 364 | NDIS registration status | Toggle Registered/Unregistered Provider | Affects NDIS admin fee eligibility in agreements |
| 365 | SCHADS pay rates reference | Browse all Home Care and SACS stream pay points with penalty rates | Quick reference for HR and payroll |
| 366 | Assign rates to staff | Click a pay point to assign it to a staff member | Set compliant pay rates in one click |
| 367 | Contractor rate templates | Create, delete, and assign named rate templates | Standardise contractor pricing across your organisation |
| 368 | SCHADS allowances reference | Vehicle km, sleepover, broken shift, first aid, on-call rates | Know every allowance obligation |
| 369 | Notification preferences | Toggle in-app and email notifications per event type (8 types) | Control alert volume. Only get notified about what matters to you |
| 370 | Compliance settings | Auto-flag reportable incidents, monthly auto-audit, cert expiry alert days, document review reminder days, budget warning threshold | Fine-tune compliance automation to your risk tolerance |
| 371 | Data export (JSON) | One-click export of entire organisation as JSON | Full data portability. You own your data |
| 372 | Table-level CSV export | Export any of 16 individual tables as CSV | Extract specific data for external systems |
| 373 | Delete account | Soft-delete with confirmation (type DELETE) | Clean data removal when needed |

---

## Module 17: Company Details

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 374 | Legal company details | Legal name, trading name, ABN, NDIS registration number, contact email, phone, head office address | Central record of your corporate details |
| 375 | 27 NDIS registration categories | Check/uncheck all NDIS registration groups your provider is registered for | Track exactly what you're registered to deliver |
| 376 | Verify NDIS registration | External link to NDIS Commission provider register | Quick verification without leaving the app |
| 377 | Business Continuity Plan (10 sections) | Editable continuity plan with voice-to-text and per-section AI generation | AI helps you write your BCP. NDIS requires one but most providers don't have one |
| 378 | Business Plan (10 sections) | Editable business plan with voice-to-text and per-section AI generation | Strategic planning tool built in. AI drafts sections from your NDIS context |
| 379 | AI generate all empty sections | One-click to auto-fill all blank sections in either plan | Go from empty template to complete draft in seconds |

---

## Module 18: Inbox

| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 380 | Email setup wizard | 3-step wizard: choose provider (Gmail, Outlook, IMAP), enter credentials, confirm | Connect your email in under 2 minutes |
| 381 | Compose and reply | Full email composition with To, Subject, Body. Reply pre-populated with thread context | Send and receive email without leaving the CRM |
| 382 | Email threading | Click an email to see the full conversation thread | Follow email conversations in context |
| 383 | Inbound/Outbound filter | Toggle between All, Inbound, Outbound views | Focus on what you need: incoming enquiries or sent messages |
| 384 | Search emails | Full-text search across subjects and senders | Find any email conversation |
| 385 | Link email to contact | Associate an email with a client, staff member, or jobseeker record | Email history attached to the right person's profile |

---

## Infrastructure Features

### Authentication and Security
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 386 | Multi-tenant isolation | Each organisation's data is completely isolated by org_id with Row Level Security | Your data is never visible to other providers |
| 387 | Role-based access control | Director, Team Leader, Roster Officer, Office Admin, Support Worker roles with different permissions | Staff see only what they need. Workers can't access settings. Roster officers can't delete clients |
| 388 | View-As impersonation | Office roles can "View As" Support Worker to see the worker portal without logging out | Test the worker experience without creating a separate account |
| 389 | PKCE authentication | Supabase auth with PKCE flow, auto-refresh tokens | Secure authentication that stays logged in across sessions |
| 390 | Activation expiry | Organisations have an activation window. Expired accounts are blocked at login | Control trial periods and paid activations |

### PWA and Offline
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 391 | Progressive Web App | Installable from browser, offline caching via Workbox service worker | Install on any phone or tablet. Works like a native app |
| 392 | Offline data sync | IndexedDB queue for notes and incidents. Auto-push when online. Conflict detection via updated_at timestamps | Never lose data because of poor mobile reception |
| 393 | Sync status banner | Red (offline), Blue (syncing), Green (synced), Amber (conflicts/pending) | Always know your sync status |
| 394 | Conflict resolution modal | Side-by-side diff with "Keep Mine" vs "Keep Server" for each conflicted field | Transparent conflict resolution. No silent data overwrites |

### Error Handling
| # | Feature | What It Does | Outcome for Providers |
|---|---------|-------------|----------------------|
| 395 | Error boundary with cache clearing | Catches TDZ/chunk errors from stale PWA caches. Auto-clears service worker caches and reloads | Self-healing. Stale cache errors resolve without IT support |
| 396 | Toast notification system | Success/error/warning/info toasts with auto-dismiss | Clear feedback on every action. No more "did it save?" uncertainty |
| 397 | Sentry error tracking | Production error monitoring with tracesSampleRate | Issues detected and logged automatically for the development team |

---

## Summary by Outcome Category

### Time Savings
- AI report writing (4 hrs/week → seconds)
- Voice-to-text progress notes (type → dictate)
- Auto-populated compliance registers (6 of 18 maintain themselves)
- Automated agreement reminders (no manual follow-up)
- Bulk CV parsing (read 20 CVs → 3 clicks)
- Bulk staff enrollment (30 workers → 3 clicks)
- AI support plan rewriting (rough notes → audit-ready)

### Compliance Risk Reduction
- 18 QMS registers with audit readiness score
- NDIS Auditor AI scans 23 Practice Standards on demand
- SCHADS compliance bot catches violations before shifts publish
- Auto NDIS reportable incident flagging
- Auto CAPA generation for serious incidents
- Complaint detection in progress notes
- Cert expiry tracking with 8-threshold alerts
- 21 NDIS-compliant training courses with completion evidence

### Financial Control
- Live SCHADS cost preview on every shift
- Real-time NDIS budget tracking per client
- Overtime detection before it happens
- Staffing vs billing margin analysis
- Contractor invoice management with approval workflow
- NDIS price catalogue with per-state pricing

### Staff Experience
- Mobile worker portal with offline support
- Self-service shift applications
- Voice-to-text everywhere
- AI chatbot for instant policy answers
- Certificate upload with AI verification (photograph → done)
- Personal training dashboard with progress tracking

### Growth and Client Acquisition
- 6-stage referral pipeline with auto client creation
- 4-stage recruitment pipeline with AI CV parsing
- Digital service agreement signing with auto reminders
- Admin savings calculator for sales conversations
- Free public tools (Agreement Builder, Roster of Care Calculator)
