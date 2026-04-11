// Titus CRM — Cloudflare Worker with hostname-based routing
// www.titus-crm.com  → serve marketing site (imported HTML)
// www.titus-crm.com/agreement-builder → NDIS Agreement Builder
// www.titus-crm.com/roc → NDIS Roster of Care Calculator
// demo.titus-crm.com → reverse proxy to Railway backend
// titus@askyrgrandpa.com → inbound email stored in Supabase

import SITE_HTML from './index.html';
import AGREEMENT_HTML from './agreement-builder.html';
import ADMIN_HTML from './administrator.html';
import ROC_HTML from './roc.html';
import PRICING_HTML from './pricing.html';
import PRIVACY_HTML from './privacy-policy.html';
import TERMS_HTML from './terms.html';
import ABOUT_HTML from './about.html';
import BLOG_HTML from './blog.html';
import FEATURES_HTML from './features.html';
import BLOG_NDIS_ADMIN from './blog/ndis-admin-cost.html';
import BLOG_AUDIT from './blog/ndis-audit-checklist.html';
import BLOG_SCHADS from './blog/schads-award.html';
import BLOG_SPREADSHEETS from './blog/outgrown-spreadsheets.html';
import BLOG_AI_NOTES from './blog/ai-progress-notes.html';
import BLOG_AGREEMENTS from './blog/digital-agreements.html';
import BLOG_COMPARISON from './blog/titus-vs-shiftcare.html';
import BLOG_BEST_NDIS from './blog/best-ndis-software.html';
import SALES_INDUCTION from './sales-induction.html';
import NDIS_HTML from './ndis.html';
import ACCOUNTING_HTML from './accounting.html';
import DV_HTML from './domestic-violence.html';
import YOUTH_RESI_HTML from './youth-residential-care.html';
import YOUTH_JUSTICE_HTML from './youth-justice.html';
import CHILDCARE_HTML from './childcare.html';
import REAL_ESTATE_HTML from './real-estate.html';
import RECRUITMENT_HTML from './recruitment.html';
import AGED_CARE_HTML from './aged-care.html';
import SERVICE_OPS_HTML from './service-ops.html';
import CHECKLIST_HTML from './checklist.html';
import CONTACT_HTML from './contact.html';
import LOGIN_HTML from './login.html';
import PROCEDURE_SHIFT_CANCEL from './procedures/ai-shift-cancellation.html';
import PROCEDURE_CLIENT_CANCEL from './procedures/ai-client-cancellation.html';
import PROCEDURE_STAKEHOLDER_GUIDE from './procedures/stakeholder-portal-guide.html';
import OG_IMAGE_DATA from './og-image.png';
import TITUS_LOGO from './titus-logo.png';
import LOGO_DELTA from './partners/delta-community.png';
import LOGO_MEADOW from './partners/meadow-street.png';
import LOGO_AMAIYA from './partners/amaiya-support.png';
import LOGO_PINEULA from './partners/pineula.png';
import SS_DASHBOARD from './screenshots/dashboard.png';
import SS_TASKS from './screenshots/tasks.png';
import SS_ROSTERS from './screenshots/rosters.png';
import SS_CLIENTS from './screenshots/clients-details.png';
import SS_REFERRALS from './screenshots/referrals.png';
import SS_STAFF from './screenshots/staff.png';
import SS_STAFF_HOURS from './screenshots/staff-hours.png';
import SS_CLIENT_BUDGET from './screenshots/client-budget.png';
import SS_SCHADS from './screenshots/schads-compliance.png';
import SS_AI_PROGRESS from './screenshots/ai-progress-notes.png';
import SS_AI_INCIDENTS from './screenshots/ai-incident-reports.png';
import SS_LMS from './screenshots/lms-course-builder.png';
import PostalMime from 'postal-mime';

const RAILWAY_ORIGIN = 'https://titus-voice-version-2-production.up.railway.app';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://esm.sh https://browser.sentry-cdn.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https://pub-e10851134f4946a5a12af091dd5ba51e.r2.dev; connect-src 'self' https://*.supabase.co https://octdvaicofjmaetgfect.supabase.co https://*.sentry.io https://browser.sentry-cdn.com https://cdnjs.cloudflare.com; frame-src https://www.loom.com;",
};

const OG_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FAF7EE"/><stop offset="100%" stop-color="#F7F6F2"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#9A7B2E"/><stop offset="100%" stop-color="#C8A951"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="8" fill="url(#gold)"/>
  <rect x="60" y="60" width="6" height="80" rx="3" fill="#9A7B2E"/>
  <text x="80" y="110" font-family="Arial,Helvetica,sans-serif" font-size="48" font-weight="800" fill="#1a1a1a">Titus CRM</text>
  <text x="80" y="200" font-family="Arial,Helvetica,sans-serif" font-size="56" font-weight="800" fill="#1a1a1a">AI-Powered CRM for</text>
  <text x="80" y="268" font-family="Arial,Helvetica,sans-serif" font-size="56" font-weight="800" fill="#9A7B2E">Australian NDIS Providers</text>
  <text x="80" y="340" font-family="Arial,Helvetica,sans-serif" font-size="26" fill="#666">Replace 5 tools with one platform. CRM · Rostering · HR · Compliance · AI</text>
  <rect x="80" y="390" width="280" height="56" rx="12" fill="url(#gold)"/>
  <text x="140" y="426" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#fff">From $79/wk +GST</text>
  <rect x="380" y="390" width="310" height="56" rx="12" fill="none" stroke="#9A7B2E" stroke-width="2"/>
  <text x="410" y="426" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="600" fill="#9A7B2E">24/7 AI Agent Included</text>
  <line x1="80" y1="490" x2="1120" y2="490" stroke="#E8E6DF" stroke-width="1"/>
  <text x="80" y="530" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="#999">18 Customisable QMS Registers · SCHADS Compliance · Browser Softphone · AI Reports</text>
  <text x="80" y="565" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="#999">Voice-to-Text · Digital Agreements · Recruitment ATS · Budget Tracking</text>
  <text x="1120" y="600" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="#9A7B2E" text-anchor="end">www.titus-crm.com</text>
</svg>`;

const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /administrator
Disallow: /sales-induction
Disallow: /procedures/
Disallow: /sales-induction
Disallow: /procedures/

# Block AI training crawlers (not search crawlers)
User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: anthropic-ai
Disallow: /

# Allow AI search crawlers (these surface content to users)
User-agent: GPTBot
Allow: /
Disallow: /administrator
Disallow: /sales-induction
Disallow: /procedures/

User-agent: OAI-SearchBot
Allow: /
Disallow: /administrator
Disallow: /sales-induction
Disallow: /procedures/

User-agent: ChatGPT-User
Allow: /
Disallow: /administrator
Disallow: /sales-induction
Disallow: /procedures/

User-agent: ClaudeBot
Allow: /
Disallow: /administrator
Disallow: /sales-induction
Disallow: /procedures/

User-agent: PerplexityBot
Allow: /
Disallow: /administrator
Disallow: /sales-induction
Disallow: /procedures/

Sitemap: https://www.titus-crm.com/sitemap.xml
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.titus-crm.com/</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/features</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/pricing</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/agreement-builder</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/roc</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/about</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/contact</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/blog</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/blog/ndis-admin-cost</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/blog/ndis-audit-checklist</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/blog/schads-award</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/blog/outgrown-spreadsheets</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/blog/ai-progress-notes</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/blog/digital-agreements</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/blog/titus-vs-shiftcare</loc>
    <lastmod>2026-04-08</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/checklist</loc>
    <lastmod>2026-04-08</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/aged-care</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/ndis</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/accounting</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/domestic-violence</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/youth-residential-care</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/youth-justice</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/childcare</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/real-estate</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/recruitment</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/service-ops</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/blog/best-ndis-software</loc>
    <lastmod>2026-04-08</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/privacy-policy</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/terms</loc>
    <lastmod>2026-03-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>`;

const LLMS_TXT = `# Titus CRM
> The AI-powered operations platform for compliance-heavy businesses. Built in Brisbane, Australia.

## What is Titus CRM?
Titus CRM is an Australian SaaS platform that consolidates rostering, compliance, HR, payroll, training, and AI automation into one system. Purpose-built for compliance-heavy, people-heavy industries: NDIS providers, aged care, child care, real estate, accounting, recruitment, and inbound service operations. All data hosted in Australia. ABN 28 616 760 206.

## Pricing
- Independent Contractor: $79/week +GST (sole traders)
- Company Growth: $349/week +GST (up to 100 user licenses)
- Andy AI (add-on): $129/week +GST — 24/7 AI receptionist
- No per-user fees. 14-day free trial. Cancel anytime.
- Customisation available at additional cost — contact us for a quote.

## 23 Live Features

### Core Operations
- Smart Rostering & AI Suggestions
- Task Manager
- Sites & Locations
- Timesheets & Staff Hours
- Award Payroll Engine (supports SCHADS for human services, Fair Work Act, configurable modern award rates)

### AI Powered
- Andy AI Chatbot
- AI Receptionist (Calls & SMS)
- AI Voice Field Notes
- AI Receipt Parsing
- Bulk CV Upload & AI Assessment

### Contacts & Pipeline
- Contacts: Clients, Staff & Jobseekers
- Referral Pipeline
- Unified Inbox (Email, SMS, Calls)

### Compliance & Audit
- Compliance Auditor (9 evidence tabs, PDF audit pack)
- 18 Configurable Compliance Registers
- Policy Register
- Award Compliance Reports
- Plan & Budget Tracking

### Training & Records
- LMS with AI Course Builder
- Medication Administration (human services)
- Care Passport ID (human services)

### Automation & Files
- Workflow Automations
- Company Files

## Coming Soon
- Support Worker Profile Creator
- Service Agreement & SOS Creator
- Roster of Care Calculator
- Shift GPS Tracker & Auto KM Recording
- AI Daily Shift Summary Email
- Bulk Claim File Generator
- Client Risk & Wellbeing Scoring
- Automated Reference Checks

## Pages
- [Homepage](https://www.titus-crm.com/): Platform overview, from $79/wk
- [Features](https://www.titus-crm.com/features): 23 live features across 6 modules, 8 coming soon
- [Pricing](https://www.titus-crm.com/pricing): Independent Contractor and Company Growth plans, customisation available
- [About](https://www.titus-crm.com/about): Company story, founder, mission
- [Contact](https://www.titus-crm.com/contact): Book a demo, get in touch, phone 0488 810 958
- [Blog](https://www.titus-crm.com/blog): NDIS compliance, SCHADS, AI automation articles
- [Human Services (NDIS)](https://www.titus-crm.com/ndis): Industry landing page for NDIS, aged care, youth residential, DV, child care providers
- [Aged Care](https://www.titus-crm.com/aged-care): Industry landing page for aged care providers covering Quality Standards compliance, SIRS, rostering, and workforce management
- [Professional Services](https://www.titus-crm.com/accounting): Industry landing page for accounting, bookkeeping, and financial planning firms
- [Child Care & OSHC](https://www.titus-crm.com/childcare): Industry landing page for long day care, family day care, OSHC, and vacation care services
- [Property Services](https://www.titus-crm.com/real-estate): Industry landing page for real estate, property management, and strata management
- [Domestic & Family Violence](https://www.titus-crm.com/domestic-violence): Industry landing page for DFV crisis services, refuge providers, and specialist DFV services
- [Youth Residential Care](https://www.titus-crm.com/youth-residential-care): Industry landing page for youth resi care providers covering shift handovers, incident documentation, behaviour support plans, mandatory reporting, and staff compliance
- [Youth Justice](https://www.titus-crm.com/youth-justice): Industry landing page for youth justice services covering court order tracking, community service hours, bail compliance, case planning, mandatory reporting, and Care Passport continuity
- [Recruitment & Labour Hire](https://www.titus-crm.com/recruitment): Industry landing page for recruitment agencies, labour hire, staffing firms, and care sector recruitment
- [Service Operations](https://www.titus-crm.com/service-ops): Industry landing page for plan management, intake and triage, coordination hubs, and inbound service centres
- [Agreement Builder](https://www.titus-crm.com/agreement-builder): Free NDIS service agreement generator
- [Roster of Care](https://www.titus-crm.com/roc): Free weekly planner and SCHADS calculator

## Blog Articles
- [The True Cost of NDIS Administration](https://www.titus-crm.com/blog/ndis-admin-cost)
- [NDIS Audit Checklist 2026](https://www.titus-crm.com/blog/ndis-audit-checklist)
- [SCHADS Award 2025-26](https://www.titus-crm.com/blog/schads-award)
- [Outgrown Spreadsheets](https://www.titus-crm.com/blog/outgrown-spreadsheets)
- [AI Progress Notes](https://www.titus-crm.com/blog/ai-progress-notes)
- [Digital Agreements](https://www.titus-crm.com/blog/digital-agreements)
- [Titus CRM vs ShiftCare](https://www.titus-crm.com/blog/titus-vs-shiftcare)
- [Best NDIS Software Australia 2026](https://www.titus-crm.com/blog/best-ndis-software)

## Contact
- Email: titus@askyrgrandpa.com
- Phone: 0488 810 958
- Location: Brisbane, QLD, Australia
- ABN: 28 616 760 206
`;

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...securityHeaders,
    }
  });
}

export default {
  async email(message, env, ctx) {
    const EDGE_FN = 'https://octdvaicofjmaetgfect.supabase.co/functions/v1/agreement-api';
    const WEBHOOK_SECRET = env.EMAIL_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      console.error('EMAIL_WEBHOOK_SECRET not configured');
      return;
    }

    try {
      // Parse the raw email
      const rawEmail = new Response(message.raw);
      const arrayBuffer = await rawEmail.arrayBuffer();
      const parser = new PostalMime();
      const parsed = await parser.parse(arrayBuffer);

      const fromAddress = message.from || parsed.from?.address || 'unknown';
      const toAddress = message.to || 'titus@askyrgrandpa.com';
      const subject = parsed.subject || '(No subject)';
      const bodyHtml = parsed.html || (parsed.text ? `<pre style="font-family:sans-serif;white-space:pre-wrap;">${parsed.text}</pre>` : '');

      // Store via edge function webhook
      ctx.waitUntil(
        fetch(`${EDGE_FN}/admin/email/inbound`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': WEBHOOK_SECRET,
          },
          body: JSON.stringify({
            from_address: fromAddress,
            to_address: toAddress,
            subject,
            body_html: bodyHtml,
          }),
        }).catch(err => console.error('Failed to store inbound email:', err))
      );

      // Forward to real inbox
      await message.forward(env.FORWARD_EMAIL || 'a4@askyrgrandpa.com');
    } catch (err) {
      console.error('Email handler error:', err);
      try {
        await message.forward(env.FORWARD_EMAIL || 'a4@askyrgrandpa.com');
      } catch (fwdErr) {
        console.error('Forward also failed:', fwdErr);
      }
    }
  },

  async fetch(request) {
    const url = new URL(request.url);

    // demo.titus-crm.com → gate then reverse proxy to Railway
    if (url.hostname === 'demo.titus-crm.com') {
      // POST /demo-register → set cookie and redirect
      if (request.method === 'POST' && url.pathname === '/demo-register') {
        return handleDemoRegister(request);
      }
      // Check for demo_access cookie
      const cookies = request.headers.get('Cookie') || '';
      if (!cookies.includes('titus_demo_access=1')) {
        return new Response(DEMO_GATE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...securityHeaders }
        });
      }
      return proxyToRailway(request, url);
    }

    // robots.txt
    if (url.pathname === '/robots.txt') {
      return new Response(ROBOTS_TXT, {
        headers: { 'Content-Type': 'text/plain', ...securityHeaders }
      });
    }

    // sitemap.xml
    if (url.pathname === '/sitemap.xml') {
      return new Response(SITEMAP_XML, {
        headers: { 'Content-Type': 'application/xml', ...securityHeaders }
      });
    }

    // Self-unregistering service worker — clears stale PWA registrations
    if (url.pathname === '/sw.js' || url.pathname === '/registerSW.js') {
      return new Response(
        'self.addEventListener("install", () => self.skipWaiting()); self.addEventListener("activate", () => self.clients.matchAll().then(c => c.forEach(cl => cl.postMessage({type:"SW_UNREGISTERED"}))).then(() => self.registration.unregister()));',
        { headers: { 'Content-Type': 'application/javascript', ...securityHeaders } }
      );
    }

    // OG image for social sharing (PNG)
    if (url.pathname === '/og-image.png') {
      return new Response(OG_IMAGE_DATA, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
          ...securityHeaders,
        }
      });
    }

    // OG image SVG fallback
    if (url.pathname === '/og-image.svg') {
      return new Response(OG_IMAGE_SVG, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=604800',
          ...securityHeaders,
        }
      });
    }

    // Titus logo
    if (url.pathname === '/titus-logo.png') {
      return new Response(TITUS_LOGO, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
          ...securityHeaders,
        }
      });
    }

    // Partner logos
    const PARTNER_LOGOS = {
      '/partners/delta-community.png': LOGO_DELTA,
      '/partners/meadow-street.png': LOGO_MEADOW,
      '/partners/amaiya-support.png': LOGO_AMAIYA,
      '/partners/pineula.png': LOGO_PINEULA,
    };
    if (PARTNER_LOGOS[url.pathname]) {
      return new Response(PARTNER_LOGOS[url.pathname], {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
          ...securityHeaders,
        }
      });
    }

    // Screenshot images
    const SCREENSHOTS = {
      '/screenshots/dashboard.png': SS_DASHBOARD,
      '/screenshots/tasks.png': SS_TASKS,
      '/screenshots/rosters.png': SS_ROSTERS,
      '/screenshots/clients-details.png': SS_CLIENTS,
      '/screenshots/referrals.png': SS_REFERRALS,
      '/screenshots/staff.png': SS_STAFF,
      '/screenshots/staff-hours.png': SS_STAFF_HOURS,
      '/screenshots/client-budget.png': SS_CLIENT_BUDGET,
      '/screenshots/schads-compliance.png': SS_SCHADS,
      '/screenshots/ai-progress-notes.png': SS_AI_PROGRESS,
      '/screenshots/ai-incident-reports.png': SS_AI_INCIDENTS,
      '/screenshots/lms-course-builder.png': SS_LMS,
    };
    if (SCREENSHOTS[url.pathname]) {
      return new Response(SCREENSHOTS[url.pathname], {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
          ...securityHeaders,
        }
      });
    }

    // /videos → redirect to features page
    if (url.pathname === '/videos' || url.pathname === '/videos/') {
      return Response.redirect('https://www.titus-crm.com/features', 301);
    }

    // /agreement-builder → serve Agreement Builder page
    if (url.pathname === '/agreement-builder' || url.pathname === '/agreement-builder/') {
      return htmlResponse(AGREEMENT_HTML);
    }

    // /administrator → serve Admin Portal (noindex, password-protected)
    if (url.pathname === '/administrator' || url.pathname === '/administrator/') {
      return htmlResponse(ADMIN_HTML);
    }

    // /roc → Roster of Care Calculator
    if (url.pathname === '/roc' || url.pathname === '/roc/') {
      return htmlResponse(ROC_HTML);
    }

    // /pricing → Pricing page
    if (url.pathname === '/pricing' || url.pathname === '/pricing/') {
      return htmlResponse(PRICING_HTML);
    }

    // /privacy-policy → Privacy Policy page
    if (url.pathname === '/privacy-policy' || url.pathname === '/privacy-policy/') {
      return htmlResponse(PRIVACY_HTML);
    }

    // /terms → Terms of Service page
    if (url.pathname === '/terms' || url.pathname === '/terms/') {
      return htmlResponse(TERMS_HTML);
    }

    // /features → Features page
    if (url.pathname === '/features' || url.pathname === '/features/') {
      return htmlResponse(FEATURES_HTML);
    }

    // /about → About page
    if (url.pathname === '/about' || url.pathname === '/about/') {
      return htmlResponse(ABOUT_HTML);
    }

    // /contact → Contact / Book a Demo page
    if (url.pathname === '/contact' || url.pathname === '/contact/') {
      return htmlResponse(CONTACT_HTML);
    }

    // /login → Platform chooser page
    if (url.pathname === '/login' || url.pathname === '/login/') {
      return htmlResponse(LOGIN_HTML);
    }

    if (url.pathname === '/sales-induction' || url.pathname === '/sales-induction/') {
      return htmlResponse(SALES_INDUCTION);
    }

    // /checklist → Compliance Checklist email capture page
    if (url.pathname === '/checklist' || url.pathname === '/checklist/') {
      return htmlResponse(CHECKLIST_HTML);
    }

    // /ndis → Human Services vertical landing page
    if (url.pathname === '/ndis' || url.pathname === '/ndis/') {
      return htmlResponse(NDIS_HTML);
    }

    // /aged-care → Aged Care vertical landing page
    if (url.pathname === '/aged-care' || url.pathname === '/aged-care/') {
      return htmlResponse(AGED_CARE_HTML);
    }

    // /accounting → Professional Services vertical landing page
    if (url.pathname === '/accounting' || url.pathname === '/accounting/') {
      return htmlResponse(ACCOUNTING_HTML);
    }

    // /domestic-violence → DFV Services vertical landing page
    if (url.pathname === '/domestic-violence' || url.pathname === '/domestic-violence/') {
      return htmlResponse(DV_HTML);
    }

    // /youth-residential-care → Youth Residential Care vertical landing page
    if (url.pathname === '/youth-residential-care' || url.pathname === '/youth-residential-care/') {
      return htmlResponse(YOUTH_RESI_HTML);
    }

    // /youth-justice → Youth Justice vertical landing page
    if (url.pathname === '/youth-justice' || url.pathname === '/youth-justice/') {
      return htmlResponse(YOUTH_JUSTICE_HTML);
    }

    // /childcare → Child Care & OSHC vertical landing page
    if (url.pathname === '/childcare' || url.pathname === '/childcare/') {
      return htmlResponse(CHILDCARE_HTML);
    }

    // /real-estate → Property Services vertical landing page
    if (url.pathname === '/real-estate' || url.pathname === '/real-estate/') {
      return htmlResponse(REAL_ESTATE_HTML);
    }

    // /recruitment → Workforce Services vertical landing page
    if (url.pathname === '/recruitment' || url.pathname === '/recruitment/') {
      return htmlResponse(RECRUITMENT_HTML);
    }

    // /service-ops → Service Operations vertical landing page
    if (url.pathname === '/service-ops' || url.pathname === '/service-ops/') {
      return htmlResponse(SERVICE_OPS_HTML);
    }

    // Blog articles
    if (url.pathname === '/blog/ndis-admin-cost') return htmlResponse(BLOG_NDIS_ADMIN);
    if (url.pathname === '/blog/ndis-audit-checklist') return htmlResponse(BLOG_AUDIT);
    if (url.pathname === '/blog/schads-award') return htmlResponse(BLOG_SCHADS);
    if (url.pathname === '/blog/outgrown-spreadsheets') return htmlResponse(BLOG_SPREADSHEETS);
    if (url.pathname === '/blog/ai-progress-notes') return htmlResponse(BLOG_AI_NOTES);
    if (url.pathname === '/blog/digital-agreements') return htmlResponse(BLOG_AGREEMENTS);
    if (url.pathname === '/blog/titus-vs-shiftcare') return htmlResponse(BLOG_COMPARISON);
    if (url.pathname === '/blog/best-ndis-software') return htmlResponse(BLOG_BEST_NDIS);

    // Procedures
    if (url.pathname === '/procedures/ai-shift-cancellation') return htmlResponse(PROCEDURE_SHIFT_CANCEL);
    if (url.pathname === '/procedures/ai-client-cancellation') return htmlResponse(PROCEDURE_CLIENT_CANCEL);
    if (url.pathname === '/procedures/stakeholder-portal-guide') return htmlResponse(PROCEDURE_STAKEHOLDER_GUIDE);

    // /blog → Blog landing page
    if (url.pathname === '/blog' || url.pathname === '/blog/') {
      return htmlResponse(BLOG_HTML);
    }

    // llms.txt
    if (url.pathname === '/llms.txt') {
      return new Response(LLMS_TXT, {
        headers: { 'Content-Type': 'text/plain', ...securityHeaders }
      });
    }

    // Homepage — only serve for / and /index.html
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return htmlResponse(SITE_HTML);
    }

    // 404 for all unknown paths (prevents soft-404 duplicate content)
    return new Response('<!DOCTYPE html><html lang="en-AU"><head><meta charset="UTF-8"><title>Page Not Found — Titus CRM</title><meta name="robots" content="noindex"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@800&family=Source+Sans+3:wght@500&display=swap" rel="stylesheet"><style>body{font-family:"Source Sans 3",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FAFAF8;color:#334155;margin:0}div{text-align:center}h1{font-family:"Outfit",sans-serif;font-size:72px;color:#E8570E;margin:0;font-weight:800}p{font-size:18px;color:#64748B;margin:16px 0}a{color:#E8570E;text-decoration:none;font-weight:600}</style></head><body><div><h1>404</h1><p>This page doesn\'t exist.</p><a href="https://www.titus-crm.com">&larr; Back to Titus CRM</a></div></body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...securityHeaders }
    });
  }
};

const DEMO_GATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Access Titus CRM Demo</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAF7EE;font-family:'Plus Jakarta Sans',sans-serif;padding:24px}
.card{background:#fff;border-radius:24px;box-shadow:0 8px 40px rgba(0,0,0,0.08);border:1px solid #e8e0d0;max-width:440px;width:100%;overflow:hidden}
.header{background:linear-gradient(135deg,#9A7B2E,#C8A951);padding:32px 32px 28px;text-align:center}
.header h1{font-family:'Space Grotesk',sans-serif;color:#fff;font-size:28px;font-weight:800;margin-bottom:6px}
.header p{color:rgba(255,255,255,0.85);font-size:14px}
.body{padding:32px}
label{display:block;font-size:12px;font-weight:700;color:#444;margin-bottom:4px}
input{width:100%;padding:11px 14px;border:1px solid #e0e0e0;border-radius:10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;outline:none;transition:border-color 0.2s}
input:focus{border-color:#9A7B2E}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.field{margin-bottom:14px}
.btn{width:100%;padding:15px;background:linear-gradient(135deg,#9A7B2E,#C8A951);color:#fff;border:none;border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:opacity 0.2s;margin-top:6px}
.btn:disabled{opacity:0.5;cursor:not-allowed}
.err{color:#e53e3e;font-size:12px;margin-top:8px}
.note{text-align:center;font-size:12px;color:#999;margin-top:16px;line-height:1.5}
</style>
</head>
<body>
<div class="card">
<div class="header">
<h1>Titus CRM Demo</h1>
<p>Enter your details to access the live demo</p>
</div>
<div class="body">
<form id="gate">
<div class="row">
<div><label>First Name *</label><input id="fn" required placeholder="e.g. Sarah"></div>
<div><label>Last Name *</label><input id="ln" required placeholder="e.g. Johnson"></div>
</div>
<div class="field"><label>Email Address *</label><input id="em" type="email" required placeholder="e.g. sarah@company.com.au"></div>
<button type="submit" class="btn" id="sub">Access Demo</button>
<p class="err" id="err" style="display:none"></p>
</form>
<p class="note">We'll send you the demo credentials.<br>Your data is stored securely and never shared.</p>
</div>
</div>
<script>
document.getElementById('gate').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = document.getElementById('sub');
  const err = document.getElementById('err');
  btn.disabled = true; btn.textContent = 'Setting up access...'; err.style.display = 'none';
  const body = {
    firstName: document.getElementById('fn').value.trim(),
    lastName: document.getElementById('ln').value.trim(),
    email: document.getElementById('em').value.trim(),
    product: 'Titus CRM'
  };
  try {
    const res = await fetch('https://octdvaicofjmaetgfect.supabase.co/functions/v1/agreement-api/demo-lead', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
    // Set cookie via POST to self
    const r2 = await fetch('/demo-register', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ ok: true })
    });
    if (r2.redirected) { window.location.href = r2.url; }
    else { window.location.reload(); }
  } catch(ex) {
    err.textContent = ex.message || 'Something went wrong. Please try again.';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Access Demo';
  }
});
</script>
</body>
</html>`;

async function handleDemoRegister(request) {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': 'https://demo.titus-crm.com/',
      'Set-Cookie': 'titus_demo_access=1; Path=/; Max-Age=604800; Secure; SameSite=Lax; HttpOnly',
      ...securityHeaders,
    }
  });
}

async function proxyToRailway(request, url) {
  const upstream = new URL(url.pathname + url.search, RAILWAY_ORIGIN);

  const headers = new Headers(request.headers);
  headers.set('Host', new URL(RAILWAY_ORIGIN).host);
  headers.set('X-Forwarded-Host', 'demo.titus-crm.com');
  headers.set('X-Forwarded-Proto', 'https');

  // WebSocket upgrade (Socket.io)
  if (request.headers.get('Upgrade') === 'websocket') {
    return fetch(upstream.toString(), {
      method: request.method,
      headers: headers,
      body: request.body
    });
  }

  const response = await fetch(upstream.toString(), {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'manual'
  });

  const respHeaders = new Headers(response.headers);
  respHeaders.delete('strict-transport-security');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders
  });
}
