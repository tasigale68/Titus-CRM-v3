# SEO Audit Report: www.titus-crm.com

**Date:** 2026-03-25
**Business Type:** SaaS (B2B, NDIS/Aged Care/Community Services)
**Pages Crawled:** 9 (per sitemap)

---

## SEO Health Score: 68 / 100

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Technical SEO | 72/100 | 25% | 18.0 |
| Content Quality | 65/100 | 25% | 16.3 |
| On-Page SEO | 60/100 | 20% | 12.0 |
| Schema / Structured Data | 82/100 | 10% | 8.2 |
| Performance | 70/100 | 10% | 7.0 |
| Images | 50/100 | 5% | 2.5 |
| AI Search Readiness | 75/100 | 5% | 3.8 |
| **TOTAL** | | | **67.8** |

---

## Executive Summary

### Top 5 Critical Issues
1. **Sub-pages missing title tags and meta descriptions** (features, about, blog pages)
2. **Sub-pages missing canonical URLs** (all non-homepage pages)
3. **Pricing page shows outdated pricing** ($249/$499/$749 in schema but homepage now has Contractor $79 + Scale as custom)
4. **Blog posts are stub pages** (titles only, no actual article content)
5. **No Google Search Console verification** (site not submitted for indexing)

### Top 5 Quick Wins
1. Add title tags + meta descriptions to all 8 sub-pages (30 min)
2. Add canonical URLs to all pages (15 min)
3. Update sitemap lastmod dates + add changefreq values (10 min)
4. Add missing alt text to logo and partner images (15 min)
5. Update pricing page schema to match homepage (Contractor $79, Scale custom) (10 min)

---

## Technical SEO (72/100)

### Crawlability
- **robots.txt:** Well configured. Blocks admin, AI training crawlers (CCBot, Bytespider, cohere-ai, anthropic-ai). Allows search crawlers + AI search crawlers (GPTBot, ClaudeBot, PerplexityBot). References sitemap.
- **Sitemap:** 9 URLs listed, all valid. Missing: changefreq, priority values. Dates slightly stale (2026-03-13, should update after today's changes).
- **Internal linking:** Good on homepage. Sub-pages may lack cross-links.

### Indexability
- **Homepage:** Indexable, `robots: index, follow` in meta
- **Sub-pages:** No explicit canonical tags detected on features, about, blog, pricing
- **Duplicate risk:** Pricing page has different schema data than homepage pricing section

### Security
- **HTTPS:** Yes, enforced
- **HSTS:** Yes, max-age=31536000 with includeSubDomains
- **CSP:** Present, recently updated for Loom frame-src
- **X-Frame-Options:** DENY
- **X-Content-Type-Options:** nosniff

### Issues
| Priority | Issue | Fix |
|----------|-------|-----|
| Critical | Sub-pages missing canonical URLs | Add `<link rel="canonical">` to all pages |
| High | Sitemap dates stale (2026-03-13) | Update to current date after changes |
| Medium | No changefreq/priority in sitemap | Add weekly for main pages |
| Low | llms.txt not found (404 or served as HTML) | Verify llms.txt route in worker.js |

---

## Content Quality (65/100)

### E-E-A-T Assessment
- **Experience:** Strong. Founder narrative on About page ("Built by an NDIS Provider")
- **Expertise:** Good. NDIS-specific terminology, SCHADS references, compliance focus
- **Authority:** Moderate. 4 named partners, ABN displayed, Brisbane address. No third-party reviews, Wikipedia presence, or news coverage.
- **Trust:** Good. ABN, contact details, privacy policy, terms. Missing: testimonials with full names, case studies with data.

### Content Depth
| Page | Words | Assessment |
|------|-------|------------|
| Homepage | ~8,500 | Excellent depth |
| Features | ~1,300 | Adequate |
| Pricing | ~1,300 | Adequate |
| About | ~850 | Adequate |
| Blog index | ~850 | Thin (hub page only) |
| Blog articles | 0 | No actual article content (stubs) |
| Agreement Builder | N/A | Tool page |
| RoC Calculator | N/A | Tool page |

### Issues
| Priority | Issue | Fix |
|----------|-------|-----|
| Critical | Blog posts are stubs with no actual article content | Write full articles (800+ words each) or remove from sitemap |
| High | Features page missing meta description | Add unique meta description |
| High | About page missing title tag and meta description | Add both |
| Medium | No customer testimonials with full names | Add 3+ named testimonials |
| Medium | No case studies with measurable outcomes | Create 1-2 case studies |

---

## On-Page SEO (60/100)

### Homepage
- **Title:** "Titus CRM — AI-Powered CRM, HR & Ops for NDIS, Aged Care, Youth & More" (74 chars, slightly long)
- **Meta description:** Present, good length, keyword-rich
- **H1:** "Stop Drowning in Admin. Start Living." (emotional, but no keywords)
- **H2 structure:** 12 H2s, well organised

### Sub-Page Issues
| Page | Title | Meta Desc | H1 | Canonical |
|------|-------|-----------|-----|-----------|
| /features | Missing | Missing | Present | Missing |
| /pricing | Present | Missing | Present | Missing |
| /about | Missing | Missing | Present | Missing |
| /blog | Missing | Missing | Present | Missing |
| /privacy-policy | Unknown | Unknown | Unknown | Missing |
| /terms | Unknown | Unknown | Unknown | Missing |

### Issues
| Priority | Issue | Fix |
|----------|-------|-----|
| Critical | 4 pages missing title tags | Add unique, keyword-rich titles |
| Critical | 5+ pages missing meta descriptions | Add 150-160 char descriptions |
| High | Homepage H1 has no target keywords | Consider "AI-Powered NDIS CRM" in H1 |
| Medium | Homepage title slightly long (74 chars) | Trim to <60 chars |
| Low | No breadcrumb navigation on sub-pages | Add BreadcrumbList schema |

---

## Schema & Structured Data (82/100)

### Current Implementation (Homepage)
- Organization: Complete (name, url, logo, email, phone, ABN, address, areaServed)
- SoftwareApplication: Complete (name, category, features, offers)
- FAQPage: 6 questions
- WebPage + WebSite: Present

### Issues
| Priority | Issue | Fix |
|----------|-------|-----|
| High | Pricing schema inconsistency: homepage shows $79 Contractor + Custom Scale, but SoftwareApplication schema on pricing page still shows $249/$499/$749 only | Sync pricing page schema with homepage |
| Medium | No BreadcrumbList schema on sub-pages | Add to features, pricing, about, blog |
| Medium | No VideoObject schema for Loom embeds | Add VideoObject for each video |
| Low | Blog posts have no Article schema | Add when articles have real content |

---

## Performance (70/100)

- **Static HTML:** Good. Homepage converted from React SPA, no client-side rendering blocking crawlers.
- **Third-party scripts:** Google Analytics, Sentry, Google Fonts, Loom embeds (lazy-loaded on click)
- **Font loading:** Preconnect to fonts.googleapis.com and fonts.gstatic.com
- **Images:** Screenshots lazy-loaded. Partner logos + og-image loaded eagerly.
- **JS-dependent content:** Calculator, pricing cards, comparison table, chatbot all require JS. Noscript fallback exists but is minimal.

### Issues
| Priority | Issue | Fix |
|----------|-------|-----|
| Medium | No explicit image width/height attributes (CLS risk) | Add width/height to all img tags |
| Medium | Google Fonts loaded synchronously | Add `display=swap` to font link (already present) |
| Low | 7 Loom thumbnails loaded from CDN on scroll | Already lazy-loaded, acceptable |

---

## Images (50/100)

### Issues
| Priority | Issue | Fix |
|----------|-------|-----|
| High | Logo (`/titus-logo.png`) missing alt text | Add `alt="Titus CRM Logo"` |
| High | Partner logos missing alt text | Add business name as alt text |
| Medium | No explicit image dimensions (width/height) | Add to prevent CLS |
| Medium | Screenshots served as PNG, could be WebP | Convert to WebP for 30-50% savings |
| Low | og-image is PNG (could be optimised) | Compress or convert |

---

## AI Search Readiness (75/100)

### Strengths
- robots.txt explicitly allows GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot
- Rich FAQ schema (6 questions) for AI citation
- Clear pricing structure (easily parseable)
- Strong homepage content depth (~8,500 words)
- Noscript fallback with structured content

### Gaps
| Priority | Issue | Fix |
|----------|-------|-----|
| High | llms.txt not accessible (404 or serving HTML) | Fix route in worker.js |
| High | No Reddit/YouTube/Wikipedia brand presence | Create brand presence for AI citation authority |
| Medium | Blog articles are stubs (no citeable content) | Write full articles for AI training data |
| Medium | No structured "definition" paragraph for AI snippets | Add "Titus CRM is..." definition in first 150 words |

---

## Prioritised Action Plan

### Critical (Fix Immediately)
1. Add title tags to features, about, blog pages
2. Add meta descriptions to all sub-pages missing them
3. Add canonical URLs to all 9 pages
4. Either write full blog articles or remove stubs from sitemap

### High (Fix Within 1 Week)
5. Sync pricing page schema with homepage (add Contractor $79, update Scale to custom)
6. Add alt text to logo and partner images
7. Fix llms.txt route in worker.js
8. Update sitemap lastmod dates to today
9. Add keyword to homepage H1 (e.g. "Stop Drowning in NDIS Admin")

### Medium (Fix Within 1 Month)
10. Add BreadcrumbList schema to sub-pages
11. Add VideoObject schema for Loom videos
12. Add image width/height attributes
13. Convert screenshots to WebP format
14. Write 2-3 real blog articles (800+ words)
15. Add named customer testimonials
16. Create 1-2 case studies with measurable outcomes
17. Submit to Google Search Console

### Low (Backlog)
18. Add changefreq/priority to sitemap
19. Compress og-image
20. Build Reddit/YouTube brand presence
21. Add Article schema to blog posts
22. Trim homepage title to <60 chars
