# SEO Action Plan: www.titus-crm.com

**Generated:** 2026-03-25 | **Current Score:** 74/100 | **Target:** 85+/100

---

## CRITICAL (Fix Immediately)

### 1. Submit to Google Search Console
- **Impact:** Site may not be indexed at all
- **Action:** Verify ownership via DNS TXT record or HTML file upload, submit sitemap
- **Effort:** 30 min

### 2. Add alt text to ALL images
- **Impact:** Accessibility fail, image SEO zero
- **Pages:** Homepage (logo, partner logos, 12+ screenshots), features, all pages with logo
- **Action:** Add descriptive alt attributes to every `<img>` tag
- **Effort:** 30 min
- **Example:** `<img src="/partners/delta-community.png" alt="Delta Community Services logo, Brisbane NDIS provider partner">`

### 3. Write actual blog articles (or remove blog from sitemap)
- **Impact:** Blog facade hurts trust/authority; Google penalises thin content pages
- **Action:** Either write 6 full articles (1,500+ words each) OR remove /blog from sitemap.xml and add `noindex` to blog page until content exists
- **Effort:** 4-8 hrs (write) or 10 min (remove)

---

## HIGH (Fix Within 1 Week)

### 4. Add BreadcrumbList schema to all sub-pages
- **Impact:** Rich snippet opportunity, improves site hierarchy signals
- **Action:** Add JSON-LD BreadcrumbList to features, pricing, about, blog, agreement-builder, roc
- **Effort:** 20 min
- **Template:**
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.titus-crm.com"},
    {"@type": "ListItem", "position": 2, "name": "Features", "item": "https://www.titus-crm.com/features"}
  ]
}
```

### 5. Fix RoC page inconsistencies
- **Action:** Change `lang="en"` to `lang="en-AU"`, add `og:image`, `og:site_name`, `og:locale`, Twitter card tags
- **Effort:** 10 min

### 6. Add missing Twitter card tags
- **Pages:** /about, /roc, /privacy-policy, /terms
- **Action:** Add `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- **Effort:** 15 min

### 7. Add schema to schema-less sub-pages
- **Pages & schema types:**
  - `/features` — ItemList or SoftwareApplication features
  - `/about` — AboutPage + Organization
  - `/blog` — Blog + Article (even for stubs)
  - `/roc` — WebApplication (match agreement-builder pattern)
- **Effort:** 30 min

### 8. Trim over-length meta descriptions
- **Pages:** / (177→160), /pricing (184→160), /agreement-builder (172→160)
- **Effort:** 10 min

---

## MEDIUM (Fix Within 1 Month)

### 9. Improve internal cross-linking
- **Issue:** Sub-pages don't link to each other, all link back to homepage only
- **Action:** Add contextual links: features→pricing, pricing→features, about→blog, blog→features, etc.
- **Also:** Add breadcrumb navigation UI (not just schema)
- **Effort:** 1 hr

### 10. Convert images to WebP format
- **Issue:** All images are PNG, larger file sizes
- **Action:** Convert screenshots to WebP, keep PNG fallback via `<picture>` element
- **Effort:** 1 hr

### 11. Expand About page content
- **Issue:** ~700 words, no team photos, no detailed company story
- **Action:** Add founder bio/photo, team section, company timeline, certifications, industry memberships
- **Target:** 1,500+ words
- **Effort:** 2 hrs

### 12. Add sitemap priority values
- **Action:** Add `<priority>` to sitemap: homepage 1.0, features/pricing 0.8, tools 0.7, blog 0.6, legal 0.3
- **Effort:** 10 min

### 13. Defer Sentry SDK loading
- **Issue:** Sentry loads synchronously in `<head>`, blocks rendering
- **Action:** Add `defer` attribute or move to end of `<body>`
- **Impact:** LCP improvement ~200-400ms
- **Effort:** 10 min

### 14. Add apple-touch-icon
- **Issue:** Only data URI favicon, no apple-touch-icon for iOS home screen
- **Action:** Create 180x180 PNG from logo, add `<link rel="apple-touch-icon">`
- **Effort:** 15 min

---

## LOW (Backlog)

### 15. Build external brand presence (biggest GEO gap)
- Reddit: Post in r/NDIS, r/disability, r/australia subreddits
- YouTube: Create product walkthrough videos (have Loom, need YouTube channel)
- Industry directories: Register on NDIS provider directories
- Press: Pitch to Disability Services Consulting, StartupDaily, etc.
- **Effort:** Ongoing

### 16. Add HowTo schema to free tools
- **Pages:** /agreement-builder, /roc
- **Impact:** Potential rich snippet for "how to create NDIS service agreement"
- **Effort:** 20 min

### 17. Create individual blog article pages
- **Action:** Build /blog/[slug] routes in worker.js for each article
- **Impact:** Long-tail keyword targeting, authority building
- **Effort:** 4-8 hrs per article

### 18. Add structured FAQ to more pages
- **Pages:** /features (common questions about modules), /about (company FAQ)
- **Effort:** 30 min per page

### 19. Consider hreflang for NZ market
- **Issue:** Site targets AU + NZ but no hreflang tags
- **Action:** If NZ-specific content planned, add `hreflang="en-AU"` and `hreflang="en-NZ"`
- **Current impact:** Low (same language, similar market)

---

## Score Projection

| Action | Score Impact |
|--------|-------------|
| Google Search Console | +0 (enables indexing, not scored directly) |
| Image alt text | +3 |
| Blog content or noindex | +3 |
| BreadcrumbList schema | +1 |
| Missing Twitter/OG tags | +1 |
| Sub-page schema | +2 |
| Internal cross-linking | +1 |
| WebP images | +1 |
| About page expansion | +1 |
| **Projected score after all HIGH+CRITICAL** | **~82/100** |
| **After MEDIUM items** | **~85/100** |
