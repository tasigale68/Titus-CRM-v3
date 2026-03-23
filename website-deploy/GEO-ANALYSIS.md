# GEO Analysis: www.titus-crm.com

> Generated: 2026-03-23
> Domain: www.titus-crm.com
> Hosted: Cloudflare Workers (Edge)

---

## GEO Readiness Score: 52/100 (after updates applied)

| Category | Before | After | Max | Notes |
|----------|--------|-------|-----|-------|
| Citability Score | 12/25 | 18/25 | 25 | Improved noscript with 147-word definition block, question headings, pricing table |
| Structural Readability | 10/20 | 14/20 | 20 | FAQ section, question-based H2s, comparison table in noscript |
| Multi-Modal Content | 10/15 | 10/15 | 15 | 12 screenshots, video, partner logos (unchanged) |
| Authority & Brand Signals | 6/20 | 6/20 | 20 | JSON-LD good, but no Wikipedia/Reddit/YouTube presence yet |
| Technical Accessibility | 4/20 | 10/20 | 20 | Noscript provides full content; robots.txt now explicit for AI crawlers; llms.txt enhanced |

**Previous score before today's changes: ~42/100**

---

## What Already Existed (Good Foundation)

The site had more GEO infrastructure than initially assessed:

| Element | Status | Quality |
|---------|--------|---------|
| Meta description | Present | Good (180 chars, keyword-rich) |
| og:title, og:description, og:image | Present | Good (1200x630 PNG) |
| Twitter cards | Present | summary_large_image |
| Canonical URL | Present | Correct (www.titus-crm.com) |
| JSON-LD Organization | Present | Includes taxID, address, areaServed |
| JSON-LD SoftwareApplication | Present | 3 pricing tiers, featureList |
| JSON-LD WebSite + WebPage | Present | Correct structure |
| robots.txt | Present | Allowed all crawlers |
| sitemap.xml | Present | 9 URLs with lastmod dates |
| llms.txt | Present | Basic version existed |
| Noscript fallback | Present | Full content with headings, lists, FAQ |
| Google Analytics (GA4) | Present | G-J81FRHT53C |
| Sentry error tracking | Present | Production environment |

---

## Changes Applied Today

### 1. robots.txt: Explicit AI Crawler Rules
- **Blocked** training-only crawlers: CCBot, Bytespider, cohere-ai, anthropic-ai
- **Explicitly allowed** AI search crawlers: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot
- Each search crawler gets its own Allow/Disallow rules for clarity

### 2. llms.txt: Comprehensive Enhancement
- Added full page directory with URLs and descriptions
- Added 147-word "What is Titus CRM?" definition block (optimal AI citation length)
- Added all 15 QMS registers listed individually
- Added key statistics section
- Added industries served
- Added current partners list
- Added data hosting location

### 3. FAQPage Schema (JSON-LD)
Added structured FAQ schema with 6 questions:
- What is Titus CRM?
- How much does Titus CRM cost?
- Is Titus CRM NDIS compliant?
- What is the 24/7 AI Voice Agent?
- Does Titus handle SCHADS compliance?
- What tools does Titus CRM replace?

### 4. WebPage Schema: Dates Added
- `datePublished`: 2026-01-15
- `dateModified`: 2026-03-23

### 5. Noscript Fallback: Major Citability Upgrade
Rewrote the entire noscript section with:
- **Question-based H2 headings** matching AI search queries ("What is Titus CRM?", "How much does Titus CRM cost?", "What compliance registers do NDIS providers need?", "What is SCHADS Award compliant rostering?")
- **147-word definition block** in optimal AI citation range (134-167 words)
- **HTML pricing table** (accessible to all crawlers)
- **Self-contained answer blocks** for each section (extractable without surrounding context)
- **Specific statistics with context** ($64,000+ savings, 10+ hours/week, 15 registers, 80% reduction)
- **Additional FAQ items** (small providers, data storage, free trial, demo access)
- **Free tools section** linking to agreement builder and RoC calculator
- **Partner list** for brand authority signals
- **Last updated date** visible in content

---

## Remaining Gaps (Not Fixed Today)

### Critical: Brand Presence (Impact: +15-20 points)

| Platform | Status | Action Needed |
|----------|--------|---------------|
| Wikipedia | None | Too early for own article; contribute to NDIS/SCHADS articles |
| Reddit | None | Post in r/NDIS, r/disability, r/australia about provider technology |
| YouTube | None | Create "NDIS compliance", "SCHADS rostering" explainer videos |
| LinkedIn | Minimal | Build company page with regular NDIS industry content |
| G2/Capterra | None | Create software listing profiles |
| Product Hunt | None | Launch listing when ready |

Brand mentions correlate 3x more strongly with AI citations than backlinks (Ahrefs Dec 2025).

### Medium: Content Pages

The sitemap includes /features, /pricing, /about, /blog pages. Each should have:
- Question-based headings targeting AI search queries
- Self-contained 134-167 word answer blocks
- Comparison content ("Titus CRM vs ShiftCare", "Best NDIS CRM Australia 2026")

### Low: Technical Refinements

- Add IndexNow integration for instant Bing indexing on content updates
- Add BreadcrumbList schema to sub-pages
- Add HowTo schema to agreement-builder and RoC calculator pages
- Consider adding Person schema for company founders/authors on blog content

---

## Platform Visibility Estimate (After Changes)

| AI Platform | Before | After | Reason |
|-------------|--------|-------|--------|
| Google AI Overviews | 25/100 | 35/100 | Better structured data, FAQ schema, dates. JS rendering still a factor. |
| ChatGPT Web Search | 15/100 | 30/100 | Enhanced noscript provides full content. llms.txt guides ChatGPT-User. |
| Perplexity | 10/100 | 25/100 | Noscript content visible. No Reddit presence limits citations. |
| Bing Copilot | 20/100 | 30/100 | Better structured data. No IndexNow yet. |

**Key limitation:** All non-Google AI platforms rely on noscript content since they cannot execute JavaScript. The noscript fallback is now comprehensive, but the primary React-rendered content (interactive calculator, screenshots, animations) is still invisible to these crawlers.

---

## Deployment

Changes are in:
- `~/titus-crm/website-deploy/worker.js` (robots.txt, llms.txt)
- `~/titus-crm/website-deploy/index.html` (JSON-LD FAQPage, noscript rewrite)

Deploy with:
```bash
cd ~/titus-crm/website-deploy && npx wrangler deploy
```
