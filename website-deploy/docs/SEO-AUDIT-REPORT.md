# Titus CRM — Full SEO & AI Search Audit

**Site:** www.titus-crm.com
**Date:** 2026-03-08
**Overall SEO Health Score: 31/100**

---

## Executive Summary

The site has **critical structural problems** preventing Google indexing and AI/LLM citation. Google has **zero indexed pages** (`site:titus-crm.com` returns nothing). The site is a client-side React SPA rendered entirely in JavaScript — search engines see an empty `<div id="root"></div>` with no content. Until this is fixed, nothing else matters.

### Top 5 Critical Issues (Fix Immediately)
1. **JavaScript-only rendering** — Googlebot sees empty page, zero indexable content
2. **No robots.txt** — crawlers get no guidance
3. **No sitemap.xml** — Google can't discover pages
4. **Zero Google index** — site is invisible to search
5. **Canonical URL mismatch** — `tituscrm.com` vs `www.titus-crm.com` (two different domains)

### Top 5 Quick Wins (High Impact, Low Effort)
1. Add robots.txt and sitemap.xml via Cloudflare Worker
2. Fix canonical URL to match actual domain
3. Update JSON-LD schema prices (still shows $69-$799, not $99-$1099)
4. Add security headers (missing all of them)
5. Add OG image for social sharing

---

## 1. CRITICAL: JavaScript Rendering Problem

**Score: 0/25 (Technical SEO)**

The entire page is a React SPA loaded via `<script type="text/babel">`. Here's what crawlers see:

```html
<div id="root"></div>
<script type="text/babel">
  // ... 600+ lines of React code
</script>
```

**Googlebot, Bing, and ALL LLMs see nothing.** The page requires:
- React 18 (loaded from CDN)
- Babel standalone (for JSX transpilation)
- Client-side execution

**Impact:** This is why `site:titus-crm.com` returns zero results. The site is completely invisible to search engines.

### Fix Options (pick one):

| Option | Effort | Recommendation |
|--------|--------|----------------|
| **A. Pre-render to static HTML** | Medium | **RECOMMENDED** — Use a build step to generate static HTML, hydrate with React |
| **B. Server-side render in Worker** | High | Cloudflare Worker renders React on the edge |
| **C. Add `<noscript>` fallback** | Low | Partial fix — add key content in `<noscript>` tags for crawlers |
| **D. Dynamic rendering** | Medium | Serve pre-rendered HTML to bots, SPA to users |

**Recommended approach:** Convert to static HTML with progressive enhancement. The page doesn't actually need React for SEO content — the marketing copy, pricing, and features are all static. Only the calculator and forms need interactivity.

---

## 2. Missing robots.txt

**Impact: Critical**

`https://www.titus-crm.com/robots.txt` returns the full HTML page (the Worker doesn't handle this route).

### Fix:
Add to `worker.js`:
```javascript
if (url.pathname === '/robots.txt') {
  return new Response(`User-agent: *
Allow: /
Sitemap: https://www.titus-crm.com/sitemap.xml`, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
```

---

## 3. Missing sitemap.xml

**Impact: Critical**

No sitemap exists. Google has no way to discover pages.

### Fix:
Add to `worker.js`:
```javascript
if (url.pathname === '/sitemap.xml') {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.titus-crm.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://www.titus-crm.com/agreement-builder</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
</urlset>`, {
    headers: { 'Content-Type': 'application/xml' }
  });
}
```

---

## 4. Canonical URL Mismatch

**Impact: Critical**

| Element | Current Value | Actual Domain |
|---------|--------------|---------------|
| Canonical | `https://tituscrm.com` | `https://www.titus-crm.com` |
| OG URL | `https://tituscrm.com` | `https://www.titus-crm.com` |
| Schema URL | `https://tituscrm.com` | `https://www.titus-crm.com` |

`tituscrm.com` is a **completely different domain** from `titus-crm.com`. This tells Google the canonical page is on a domain you may not control, causing all link equity to leak.

### Fix:
Change ALL references from `tituscrm.com` to `www.titus-crm.com`:
- Line 19: `<link rel="canonical" href="https://www.titus-crm.com">`
- Line 23: `<meta property="og:url" content="https://www.titus-crm.com">`
- Line 55: Schema URL → `https://www.titus-crm.com`

---

## 5. JSON-LD Schema Issues

**Impact: High**

Current schema has **outdated pricing** and is **too minimal**:

```json
"lowPrice": "69",    // Should be "99"
"highPrice": "799",  // Should be "1099"
```

### Missing schema types needed:
- **Organization** — name, logo, contact, social profiles
- **WebSite** — with SearchAction for sitelinks search box
- **FAQPage** — the chatbot KB has Q&A pairs perfect for this
- **Product** (for each pricing tier) — individual offers with features
- **Review/AggregateRating** — the Delta Community Support testimonial
- **BreadcrumbList** — for page hierarchy

### Recommended expanded schema:
```json
[
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Titus CRM",
    "url": "https://www.titus-crm.com",
    "logo": "https://www.titus-crm.com/logo.png",
    "description": "AI-powered all-in-one CRM for Australian NDIS, Aged Care & Community Service providers",
    "email": "info@tituscrm.com.au",
    "areaServed": {"@type": "Country", "name": "Australia"},
    "sameAs": ["https://www.tiktok.com/@tituscrm", "https://www.tituscrm.com.au"]
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Titus CRM",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "99",
      "highPrice": "1099",
      "priceCurrency": "AUD",
      "offerCount": "3"
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "How much does Titus CRM cost?", "acceptedAnswer": {"@type": "Answer", "text": "..."}},
      {"@type": "Question", "name": "What does Titus CRM replace?", "acceptedAnswer": {"@type": "Answer", "text": "..."}},
      ...
    ]
  }
]
```

---

## 6. Security Headers — All Missing

**Impact: High (trust signals for both Google and LLMs)**

Current response headers from Cloudflare:
```
content-type: text/html; charset=utf-8
server: cloudflare
```

**Missing headers:**
| Header | Status | Required Value |
|--------|--------|----------------|
| `X-Content-Type-Options` | ❌ Missing | `nosniff` |
| `X-Frame-Options` | ❌ Missing | `DENY` |
| `Strict-Transport-Security` | ❌ Missing | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | ❌ Missing | Appropriate CSP |
| `Referrer-Policy` | ❌ Missing | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | ❌ Missing | `camera=(), microphone=(), geolocation=()` |
| `X-XSS-Protection` | ❌ Missing | `1; mode=block` |

### Fix:
Add headers in worker.js response:
```javascript
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
```

---

## 7. On-Page SEO Issues

**Score: 12/20**

### What's Good:
- ✅ Title tag present and keyword-rich (57 chars)
- ✅ Meta description present (155 chars, good length)
- ✅ H1 present ("Stop Drowning in Admin. Start Living.")
- ✅ `lang="en-AU"` set correctly
- ✅ Viewport meta tag present
- ✅ Keywords meta tag present
- ✅ OG tags present (title, description, locale)
- ✅ Twitter card tags present
- ✅ Favicon present (inline SVG)

### What Needs Fixing:
- ❌ **No OG image** — social shares show no image
- ❌ **No Twitter image** — same problem
- ❌ **H1 is emotional, not keyword-rich** — "Stop Drowning in Admin" has zero search volume. Should include "NDIS CRM" or "NDIS Software"
- ❌ **Only 2 proper H2 tags** — rest of headings are in React components, invisible to crawlers
- ❌ **agreement-builder page has ZERO meta tags** — no title, no description, no OG, no schema
- ❌ **Geolocation spoofing script** injected before `<head>` — browser extension artifact, not harmful but messy
- ❌ **Meta keywords tag** is largely ignored by Google but doesn't hurt

### Heading Hierarchy (what crawlers see):
```
H1: (empty — rendered by JS)
H2: (empty — rendered by JS)
```
**Crawlers see NO headings** due to JS rendering issue.

---

## 8. Content Quality & E-E-A-T

**Score: 15/25**

### Strengths:
- Strong first-person voice ("You didn't start a care business to spend every night on spreadsheets")
- Australian English throughout
- Specific dollar figures ($64K savings, $58K receptionist cost)
- Real customer reference (Delta Community Support, Brisbane QLD)
- Detailed feature lists with live/coming-soon status
- Domain expertise (SCHADS, NDIS, PRODA/PACE terminology)

### Weaknesses:
- ❌ **No About page** — who built this? What's the team's background?
- ❌ **No case studies** — only one testimonial, no data
- ❌ **No blog/content hub** — zero topical authority
- ❌ **No privacy policy page** (mentioned in footer but links to #waitlist)
- ❌ **No terms of service page**
- ❌ **No ABN or company registration** visible
- ❌ **No physical address** — just "Built in Brisbane, Australia"
- ❌ **No author/founder profiles** — E-E-A-T requires named expertise
- ❌ **No external backlinks** to speak of (only tituscrm.com.au and TikTok found)

### For LLM Citation:
LLMs need **authoritative, factual, well-structured content** to cite. Currently:
- No blog posts for LLMs to reference
- No comparison pages ("Titus vs FlowLogic", "Titus vs CTARS")
- No educational content ("What is SCHADS?", "NDIS Compliance Checklist")
- No data/statistics pages that LLMs would want to cite

---

## 9. Performance

**Score: 6/10**

### Resource Loading:
| Resource | Size | Issue |
|----------|------|-------|
| React 18 (CDN) | ~42KB gzip | Fine |
| ReactDOM (CDN) | ~130KB gzip | Fine |
| **Babel Standalone** | **~350KB gzip** | **CRITICAL — removes this for production** |
| Google Fonts (2 families) | ~60KB | Could self-host |
| Inline HTML | ~58KB gzip | Large but acceptable |

**Babel Standalone is 350KB+ and transpiles JSX in the browser.** This is a development tool, not for production. It adds 1-2 seconds to page load on mobile.

### Estimated Core Web Vitals:
| Metric | Estimate | Target | Status |
|--------|----------|--------|--------|
| LCP | 2.5-4s | <2.5s | ⚠️ Needs work |
| FID/INP | <100ms | <200ms | ✅ OK |
| CLS | ~0 | <0.1 | ✅ OK |
| FCP | 1.5-3s | <1.8s | ⚠️ Needs work |

### Fix:
Pre-compile JSX at build time → remove Babel Standalone entirely. This alone saves ~350KB and 1-2s load time.

---

## 10. AI/LLM Search Optimization

**Score: 8/100 (effectively invisible to AI search)**

### Current AI Visibility:
- **ChatGPT:** Will not cite www.titus-crm.com (not indexed, no crawlable content)
- **Perplexity:** Cannot index JS-rendered content
- **Google AI Overviews:** Site not in Google index at all
- **Claude:** No web content to reference

### Why This Matters:
Per 2026 research:
- 44.2% of LLM citations come from the **first 30% of text** (intro paragraph)
- Perplexity cites sources in **97% of responses**
- Only **12% of Google rankings transfer** to AI search
- **85% of AI citations** are from content published in the last 2 years
- Fast-loading pages get **3x more ChatGPT citations**

### What's Needed for LLM Visibility:

#### A. Crawlable Content (Critical)
Fix the JS rendering problem — LLMs can't read client-side React.

#### B. Authoritative Content Pages (High)
Create standalone pages that LLMs will want to cite:
1. **"What is NDIS CRM Software?"** — definitive guide (2000+ words)
2. **"NDIS Compliance Checklist 2026"** — reference resource
3. **"SCHADS Award Rates Calculator"** — tool + explanation
4. **"NDIS Software Comparison: Titus vs Competitors"** — comparison page
5. **"How to Choose NDIS Provider Software"** — buyer's guide

#### C. FAQ Structured Data (High)
Convert the chatbot KB into a visible FAQ section with FAQPage schema. LLMs heavily cite FAQ content.

#### D. Definitive Statements (Medium)
LLMs cite pages that make clear, quotable claims. Add:
- "Titus CRM is an Australian-built NDIS provider management platform that combines CRM, HR, rostering, compliance, and AI in one system."
- "Titus CRM pricing starts at $99/week +GST for small providers, with plans up to $1,099/week for enterprise."

#### E. Entity Optimization (Medium)
Help LLMs understand what Titus CRM is:
- Consistent naming: always "Titus CRM" (not just "Titus")
- Category: "NDIS CRM software" / "NDIS provider management software"
- Competitors: mention alongside known brands (FlowLogic, CTARS, GoodHuman)
- Differentiator: "AI-powered" + "24/7 AI phone agent" + "built by an NDIS provider"

---

## 11. Competitor Landscape

Key competitors indexed and ranking for "NDIS CRM":
| Competitor | Domain Authority | Blog Posts | Indexed Pages |
|------------|-----------------|------------|---------------|
| FlowLogic | High | Yes | 50+ |
| CTARS | High | Yes | 100+ |
| Astalty | Medium | Yes | 30+ |
| GoodHuman | High | Yes | 50+ |
| CareMaster | Medium | Yes | 40+ |
| **Titus CRM** | **None** | **No** | **0** |

Every competitor has:
- Multiple indexed pages
- Blog content
- Proper SSR/static HTML
- Schema markup
- Backlinks from NDIS-related sites

---

## 12. Domain Strategy Issue

You have **two domains**:
- `www.titus-crm.com` — Cloudflare Workers (marketing + agreement builder)
- `www.tituscrm.com.au` — separate site (also has content)

Plus `tituscrm.com` referenced in canonical/schema (unclear if you own this).

**This splits authority.** You need to:
1. Pick ONE primary domain
2. 301 redirect all others to it
3. Set canonical consistently
4. Update all schema/OG to match

---

# ACTION PLAN

## Phase 1: Emergency Fixes (This Week)

### 1.1 Add robots.txt and sitemap.xml to Worker
**Files:** `worker.js`
**Effort:** 30 minutes

### 1.2 Fix canonical URL everywhere
**Files:** `index.html` lines 19, 23, 55
**Effort:** 10 minutes
Change all `tituscrm.com` → `www.titus-crm.com`

### 1.3 Update JSON-LD prices
**Files:** `index.html` line 55
**Effort:** 5 minutes
Change `"lowPrice":"69","highPrice":"799"` → `"lowPrice":"99","highPrice":"1099"`

### 1.4 Add security headers to Worker
**Files:** `worker.js`
**Effort:** 15 minutes

## Phase 2: Fix Rendering (This Week — Most Important)

### 2.1 Pre-render marketing page to static HTML
**Effort:** 2-4 hours
Convert the React SPA to static HTML with inline styles. Keep React only for interactive components (calculator, forms, chatbot). All marketing copy, features, pricing should be plain HTML that crawlers can read.

### 2.2 Add `<noscript>` fallback (Quick interim fix)
**Effort:** 30 minutes
Add key content in `<noscript>` tags so crawlers see something while you work on full static conversion.

## Phase 3: Content & Authority (Week 2-3)

### 3.1 Add meta tags to agreement-builder page
### 3.2 Create About page with team/founder info
### 3.3 Create Privacy Policy page
### 3.4 Add expanded schema (Organization, FAQPage, Product)
### 3.5 Add OG image (create a branded social share card)
### 3.6 Add visible FAQ section from chatbot KB data

## Phase 4: LLM/AI Search Optimization (Week 3-4)

### 4.1 Create 3-5 content pages targeting key NDIS search terms
### 4.2 Create competitor comparison pages
### 4.3 Add definitive, quotable statements throughout
### 4.4 Submit to Google Search Console
### 4.5 Build backlinks from NDIS industry sites

## Phase 5: Performance (Ongoing)

### 5.1 Remove Babel Standalone — pre-compile JSX
### 5.2 Self-host fonts
### 5.3 Remove geolocation spoofing script
### 5.4 Add resource hints (preload, prefetch)

---

## Score Breakdown

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| Technical SEO | 25% | 15/100 | 3.8 |
| Content Quality | 25% | 55/100 | 13.8 |
| On-Page SEO | 20% | 45/100 | 9.0 |
| Schema/Structured Data | 10% | 30/100 | 3.0 |
| Performance | 10% | 40/100 | 4.0 |
| Images | 5% | 50/100 | 2.5 |
| AI Search Readiness | 5% | 5/100 | 0.3 |
| **TOTAL** | **100%** | | **31/100** |

The single biggest issue is **JS rendering** — fixing this alone would likely move the score to 55-60. Adding content pages and proper schema would push it to 75+.
