# Full SEO Audit Report: www.titus-crm.com

**Date:** 2026-03-25
**Auditor:** Claude Code (Opus 4.6)
**Business Type:** B2B SaaS (NDIS/Aged Care/Community Services CRM)
**Pages Crawled:** 9 (all sitemap URLs)
**Previous Audit Score:** 68/100 (2026-03-25 earlier session)

---

## SEO Health Score: 74 / 100

| Category | Score | Weight | Weighted | Change |
|----------|-------|--------|----------|--------|
| Technical SEO | 82/100 | 25% | 20.5 | +10 |
| Content Quality | 68/100 | 25% | 17.0 | +3 |
| On-Page SEO | 78/100 | 20% | 15.6 | +18 |
| Schema / Structured Data | 82/100 | 10% | 8.2 | 0 |
| Performance | 70/100 | 10% | 7.0 | 0 |
| Images | 45/100 | 5% | 2.3 | -5 |
| AI Search Readiness | 78/100 | 5% | 3.9 | +3 |
| **TOTAL** | | | **74.5** | **+6.7** |

---

## Executive Summary

### What Improved Since Last Audit
1. All 9 pages now have proper `<title>` tags and `<meta name="description">`
2. All pages have `<link rel="canonical">` tags with correct URLs
3. All pages have `<meta name="robots" content="index, follow">`
4. Homepage converted from React+Babel SPA to static HTML (crawlable)
5. Sub-pages (features, about, blog, pricing) now have full OG/Twitter meta tags
6. Comprehensive security headers in place (HSTS, CSP, X-Frame-Options, etc.)

### Top 5 Critical Issues (Remaining)
1. **Blog posts are stub pages** with no actual article content (titles/summaries only, no /blog/article-slug routes)
2. **No Google Search Console verification** (site likely not indexed)
3. **Agreement Builder page missing canonical tag** (has all other meta but no canonical in live response)
4. **RoC page uses `lang="en"` instead of `lang="en-AU"`** (inconsistent with all other pages)
5. **No BreadcrumbList schema** on any sub-page (missed rich snippet opportunity)

### Top 5 Quick Wins
1. Submit site to Google Search Console + verify ownership (30 min)
2. Add BreadcrumbList schema to all sub-pages (20 min)
3. Fix RoC page `lang="en"` to `lang="en-AU"` (2 min)
4. Add `alt` text to all partner logos and screenshot images (15 min)
5. Write actual blog article content for the 6 blog post stubs (2-4 hrs)

---

## 1. Technical SEO (82/100)

### Crawlability

| Check | Status | Notes |
|-------|--------|-------|
| robots.txt | PASS | Well configured, blocks AI training crawlers, allows AI search crawlers |
| Sitemap | PASS | 9 URLs, valid XML, referenced in robots.txt |
| HTTP/2 | PASS | Cloudflare serves HTTP/2 |
| SSL/HTTPS | PASS | Valid cert, HSTS enabled with includeSubDomains |
| Internal links | WARN | Sub-pages lack cross-links between each other |
| Redirect chains | PASS | No chains detected |

### Security Headers

| Header | Status | Value |
|--------|--------|-------|
| Strict-Transport-Security | PASS | max-age=31536000; includeSubDomains |
| Content-Security-Policy | PASS | Comprehensive policy with script/style/font/img/connect sources |
| X-Content-Type-Options | PASS | nosniff |
| X-Frame-Options | PASS | DENY |
| X-XSS-Protection | PASS | 1; mode=block |
| Referrer-Policy | PASS | strict-origin-when-cross-origin |
| Permissions-Policy | PASS | camera=(), microphone=(self), geolocation=() |

### Indexability

| Page | Title | Meta Desc | Canonical | Robots | OG Tags | Twitter |
|------|:-----:|:---------:|:---------:|:------:|:-------:|:-------:|
| / (homepage) | PASS | PASS | PASS | PASS | PASS | PASS |
| /features | PASS | PASS | PASS | PASS | PASS | PASS |
| /pricing | PASS | PASS | PASS | PASS | PASS | PASS |
| /about | PASS | PASS | PASS | PASS | PASS | MISSING |
| /blog | PASS | PASS | PASS | PASS | PASS | PASS |
| /agreement-builder | PASS | PASS | PASS | PASS | PARTIAL | MISSING |
| /roc | PASS | PASS | PASS | PASS | PARTIAL | MISSING |
| /privacy-policy | PASS | PASS | PASS | PASS | PARTIAL | MISSING |
| /terms | PASS | PASS | PASS | PASS | PARTIAL | MISSING |

**Issues:**
- `/about` missing Twitter card meta tags
- `/roc` missing `og:image`, `og:site_name`, `og:locale`, Twitter tags
- `/privacy-policy` and `/terms` missing `og:image` and Twitter tags
- `/roc` uses `lang="en"` (should be `lang="en-AU"`)

### Sitemap Analysis

```
9 URLs found:
/ , /agreement-builder, /roc, /features, /pricing, /about, /blog, /privacy-policy, /terms
```

| Check | Status | Notes |
|-------|--------|-------|
| Valid XML | PASS | |
| All URLs accessible | PASS | All return 200 |
| lastmod dates | WARN | All show 2026-03-25 (same date, should reflect actual modification) |
| priority values | FAIL | Missing on all URLs |
| changefreq | PASS | weekly for content, monthly for legal |
| Sitemap in robots.txt | PASS | |

---

## 2. Content Quality (68/100)

### E-E-A-T Assessment

| Signal | Score | Notes |
|--------|-------|-------|
| Experience | 7/10 | "Built by an NDIS Provider" narrative, 4 named partners |
| Expertise | 6/10 | SCHADS/NDIS terminology used correctly, but no team bios or credentials |
| Authoritativeness | 5/10 | No external citations, no industry body memberships listed, no press mentions |
| Trustworthiness | 7/10 | ABN displayed, privacy policy, terms, real contact details, partner logos |

### Page-by-Page Content Assessment

| Page | Words | Thin? | Quality | Issues |
|------|-------|:-----:|---------|--------|
| / (homepage) | ~8,000 | No | Good | Strong copy, clear value prop, social proof |
| /features | ~1,300 | WARN | Medium | Feature list only, no detail pages per feature |
| /pricing | ~1,300 | No | Good | Clear pricing, FAQ section, trust badges |
| /about | ~700 | YES | Low | Very thin, no team photos, no detailed story |
| /blog | ~2,100 | YES | Low | 6 article stubs with summaries only, no full articles |
| /agreement-builder | ~2,800 | No | Good | Functional tool with clear instructions |
| /roc | ~3,500 | No | Good | Comprehensive tool |
| /privacy-policy | ~1,100 | No | OK | Standard legal content |
| /terms | ~1,200 | No | OK | Standard legal content |

### Critical Content Issues
1. **Blog is a facade** — 6 articles listed but none have actual content pages. No /blog/article-slug routes exist. This is a significant trust/authority gap.
2. **About page is thin** — ~700 words, no team photos, no detailed company story, no certifications or partnerships beyond logos.
3. **Features page lacks depth** — Lists 9 modules with brief descriptions but no individual feature detail pages.

### Readability
- Copy is clear and jargon-appropriate for the NDIS provider audience
- Good use of headings and visual hierarchy
- CTAs are clear and consistent

---

## 3. On-Page SEO (78/100)

### Title Tags

| Page | Title | Length | Keywords | Score |
|------|-------|--------|----------|-------|
| / | Titus CRM — AI-Powered CRM for NDIS & Aged Care Providers | 57 | PASS | 9/10 |
| /features | Features — Titus CRM \| 100+ Features for NDIS Providers | 56 | PASS | 8/10 |
| /pricing | Pricing \| Titus CRM \| From $79/week +GST for NDIS Providers | 59 | PASS | 9/10 |
| /about | About Titus CRM — Built by an NDIS Provider, for NDIS Providers | 62 | PASS | 8/10 |
| /blog | Blog \| Titus CRM \| NDIS Provider Resources & Guides | 51 | PASS | 8/10 |
| /agreement-builder | Free NDIS Service Agreement Builder \| Titus CRM | 49 | PASS | 9/10 |
| /roc | NDIS Roster of Care Builder \| Free Tool \| Titus CRM | 54 | PASS | 9/10 |
| /privacy-policy | Privacy Policy — Titus CRM | 27 | OK | 7/10 |
| /terms | Terms of Service — Titus CRM | 30 | OK | 7/10 |

### Meta Descriptions

| Page | Length | Quality |
|------|--------|---------|
| / | 177 chars | WARN: Over 160 limit, will truncate |
| /features | 148 chars | PASS |
| /pricing | 184 chars | WARN: Over 160 limit |
| /about | 156 chars | PASS |
| /blog | 136 chars | PASS |
| /agreement-builder | 172 chars | WARN: Over 160 limit |
| /roc | 132 chars | PASS |
| /privacy-policy | 119 chars | PASS |
| /terms | 141 chars | PASS |

### Heading Structure

| Page | H1 Count | H1 Text | Issues |
|------|----------|---------|--------|
| / | 1 | "Stop Drowning in NDIS Admin. Start Living." | PASS |
| /features | 1 | "Everything you need. Nothing you don't." | WARN: No target keyword in H1 |
| /pricing | 1 | "Simple, transparent pricing" | WARN: No target keyword in H1 |
| /about | 1 | "Built by an NDIS Provider, for NDIS Providers" | PASS |
| /blog | 1 | "Titus CRM Blog: Resources for NDIS Providers" | PASS |
| /agreement-builder | 1 | "Free NDIS Service Agreement Builder" | PASS |
| /roc | 1 | "NDIS Roster of Care Builder" | PASS |

### Internal Linking

| From | To | Count |
|------|----|-------|
| Homepage | Sub-pages | 6 (features, pricing, agreement-builder, roc, privacy, terms) |
| Features | Homepage, agreement-builder, roc | 3 |
| Pricing | Homepage | 1 |
| About | Homepage | 1 |
| Blog | Homepage, agreement-builder, roc | 3 |

**Issues:**
- No cross-linking between features ↔ pricing ↔ about ↔ blog
- Sub-pages don't link to each other (siloed navigation)
- No breadcrumb navigation on any page

---

## 4. Schema / Structured Data (82/100)

### Homepage Schema (6 types)

| Schema Type | Status | Quality |
|-------------|--------|---------|
| Organization | PASS | Name, URL, logo, email, phone, ABN, address, areaServed (AU+NZ), sameAs |
| SoftwareApplication | PASS | Pricing tiers, categories, OS support |
| WebSite | PASS | Basic metadata |
| WebPage | PASS | Published/modified dates |
| FAQPage | PASS | 6 Q&A pairs |
| VideoObject | PASS | Loom walkthrough embed |

### Sub-Page Schema

| Page | Schema | Status |
|------|--------|--------|
| /features | None | FAIL |
| /pricing | SoftwareApplication + AggregateOffer | PASS |
| /about | None | FAIL |
| /blog | None | FAIL (should have Blog/Article schema) |
| /agreement-builder | WebApplication | PASS |
| /roc | None | FAIL (should have WebApplication schema) |
| /privacy-policy | None | OK (not critical) |
| /terms | None | OK (not critical) |

### Missing Schema Opportunities
1. **BreadcrumbList** on all sub-pages
2. **Article** schema on blog page (even for stubs)
3. **AboutPage** or **Organization** schema on /about
4. **WebApplication** schema on /roc (matches agreement-builder pattern)
5. **HowTo** schema on free tools (agreement builder + RoC)

---

## 5. Performance (70/100)

### Resource Analysis

| Resource | Impact | Notes |
|----------|--------|-------|
| Google Fonts (2 families) | Medium | 2 preconnects in place, display=swap used |
| Sentry SDK (8.0.0) | Low-Medium | 46KB gzipped, loaded synchronously |
| GA4 gtag | Low | Async loaded |
| CDN libs (xlsx, jspdf) on /roc | High | Multiple large libs loaded on tool pages |
| Loom embed on homepage | Medium | iframe, deferred by click-to-play |

### Observations
- **No render-blocking CSS** (all inline)
- **Images use `loading="lazy"`** on homepage
- **Sentry loads synchronously** in head — could defer for non-critical pages
- **Font preconnect** properly configured
- **No unnecessary JavaScript** on static content pages

### Estimated Core Web Vitals (based on source analysis)

| Metric | Estimate | Status |
|--------|----------|--------|
| LCP | ~1.5-2.5s | WARN (fonts + Sentry blocking) |
| INP | <100ms | PASS (minimal JS on static pages) |
| CLS | <0.05 | PASS (inline CSS, no layout shifts) |

---

## 6. Images (45/100)

### Image Inventory

| Image | Alt Text | Lazy | Optimized Format |
|-------|:--------:|:----:|:----------------:|
| /titus-logo.png | MISSING | No | PNG (should be SVG/WebP) |
| /og-image.png | N/A (meta only) | N/A | PNG OK for social |
| /partners/delta-community.png | MISSING | ? | PNG |
| /partners/meadow-street.png | MISSING | ? | PNG |
| /partners/amaiya-support.png | MISSING | ? | PNG |
| /partners/pineula.png | MISSING | ? | PNG |
| /screenshots/dashboard.png | MISSING | lazy | PNG (should be WebP) |
| /screenshots/rosters.png | MISSING | lazy | PNG (should be WebP) |
| (10+ more screenshots) | MISSING | lazy | PNG (should be WebP) |

### Critical Issues
1. **ZERO images have alt text** — severe accessibility and SEO failure
2. **All images are PNG** — should be WebP with PNG fallback
3. **Partner logos have no descriptive alt attributes**
4. **No `<picture>` elements** for responsive/format switching
5. **Favicon is a data URI SVG** — acceptable but no apple-touch-icon PNG

---

## 7. AI Search Readiness (78/100)

### Crawler Access

| Crawler | Status | Notes |
|---------|--------|-------|
| GPTBot | ALLOWED | Can crawl all pages except /administrator |
| OAI-SearchBot | ALLOWED | |
| ChatGPT-User | ALLOWED | |
| ClaudeBot | ALLOWED | |
| PerplexityBot | ALLOWED | |
| CCBot | BLOCKED | Training crawler, correctly blocked |
| Bytespider | BLOCKED | Training crawler, correctly blocked |
| anthropic-ai | BLOCKED | Training crawler, correctly blocked |

### llms.txt

| Check | Status |
|-------|--------|
| Exists | PASS (200 response) |
| Content-Type | PASS (text/plain) |
| Contains site description | PASS |
| Contains page directory | PASS |
| Contains pricing/stats | PASS |

### Citability Assessment

| Signal | Score | Notes |
|--------|-------|-------|
| Definitive statements | 7/10 | Clear pricing, feature claims, company info |
| Quotable passages | 6/10 | FAQ answers are good, but body copy is marketing-heavy |
| Structured facts | 8/10 | Pricing tables, feature lists, partner names |
| Attribution-ready content | 5/10 | No research, stats, or original data beyond cost calculator |
| External brand presence | 2/10 | No Reddit, YouTube, Wikipedia, industry directory presence |

### Biggest GEO Gap
**No third-party brand presence.** AI search engines weight external mentions heavily. Titus CRM has zero Reddit threads, no YouTube content, no industry directory listings, no press coverage, no Wikipedia mention. This is the single biggest barrier to AI search visibility.

---

## Page-by-Page Summary

### Homepage (/)
- **Score: 88/100** — Strong. Good copy, 6 schema types, full meta tags, converted to static HTML
- **Fix:** Add image alt text, trim meta description to 160 chars

### Features (/features)
- **Score: 72/100** — Good meta tags, but no schema, no images with alt, thin content
- **Fix:** Add schema, expand feature descriptions, add screenshots with alt text

### Pricing (/pricing)
- **Score: 80/100** — Good schema, clear pricing, FAQ section
- **Fix:** Trim meta description, add BreadcrumbList schema

### About (/about)
- **Score: 55/100** — Thin content (~700 words), no schema, missing Twitter tags
- **Fix:** Add team bios, company story detail, Organization schema, Twitter tags

### Blog (/blog)
- **Score: 35/100** — Facade page with article stubs, no actual content, no schema
- **Fix:** Write full articles or remove from sitemap until content exists

### Agreement Builder (/agreement-builder)
- **Score: 82/100** — Good tool, WebApplication schema, functional content
- **Fix:** Add BreadcrumbList + HowTo schema, fix meta description length

### RoC (/roc)
- **Score: 70/100** — Good tool, but missing schema, missing OG image, wrong lang
- **Fix:** Add WebApplication schema, fix lang="en-AU", add OG/Twitter tags

### Privacy Policy (/privacy-policy)
- **Score: 68/100** — Adequate legal content, basic meta tags
- **Fix:** Add OG image, Twitter tags (low priority)

### Terms (/terms)
- **Score: 68/100** — Adequate legal content, basic meta tags
- **Fix:** Add OG image, Twitter tags (low priority)

---

## Comparison: Previous Audit vs. Now

| Issue from Previous Audit | Status |
|---------------------------|--------|
| Sub-pages missing title tags | FIXED |
| Sub-pages missing meta descriptions | FIXED |
| Sub-pages missing canonical URLs | FIXED |
| Blog posts are stub pages | STILL OPEN |
| No Google Search Console | STILL OPEN |
| Pricing inconsistency (schema vs display) | PARTIALLY FIXED (Contractor $79 added) |
| Missing alt text | STILL OPEN |
| Sitemap missing priority values | STILL OPEN |
