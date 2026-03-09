// Titus CRM — Cloudflare Worker with hostname-based routing
// www.titus-crm.com  → serve marketing site (imported HTML)
// www.titus-crm.com/agreement-builder → NDIS Agreement Builder
// demo.titus-crm.com → reverse proxy to Railway backend

import SITE_HTML from './index.html';
import AGREEMENT_HTML from './agreement-builder.html';
import OG_IMAGE_DATA from './og-image.png';

const RAILWAY_ORIGIN = 'https://titus-voice-version-2-production.up.railway.app';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
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
  <text x="140" y="426" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#fff">From $99/wk +GST</text>
  <rect x="380" y="390" width="310" height="56" rx="12" fill="none" stroke="#9A7B2E" stroke-width="2"/>
  <text x="410" y="426" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="600" fill="#9A7B2E">24/7 AI Agent Included</text>
  <line x1="80" y1="490" x2="1120" y2="490" stroke="#E8E6DF" stroke-width="1"/>
  <text x="80" y="530" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="#999">18 QMS Registers · SCHADS Compliance · Browser Softphone · AI Reports</text>
  <text x="80" y="565" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="#999">Voice-to-Text · Digital Agreements · Recruitment ATS · Budget Tracking</text>
  <text x="1120" y="600" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="#9A7B2E" text-anchor="end">www.titus-crm.com</text>
</svg>`;

const ROBOTS_TXT = `User-agent: *
Allow: /

# Sitemaps
Sitemap: https://www.titus-crm.com/sitemap.xml

# Crawl-delay (be polite)
Crawl-delay: 1
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.titus-crm.com/</loc>
    <lastmod>2026-03-08</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.titus-crm.com/agreement-builder</loc>
    <lastmod>2026-03-08</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...securityHeaders,
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // demo.titus-crm.com → reverse proxy to Railway
    if (url.hostname === 'demo.titus-crm.com') {
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

    // /agreement-builder → serve Agreement Builder page
    if (url.pathname === '/agreement-builder' || url.pathname === '/agreement-builder/') {
      return htmlResponse(AGREEMENT_HTML);
    }

    // www.titus-crm.com (and any other hostname) → serve marketing site
    return htmlResponse(SITE_HTML);
  }
};

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
