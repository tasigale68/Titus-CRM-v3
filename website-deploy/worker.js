// Titus CRM — Cloudflare Worker with hostname-based routing
// www.titus-crm.com  → serve marketing site (imported HTML)
// demo.titus-crm.com → reverse proxy to Railway backend

import SITE_HTML from './index.html';

const RAILWAY_ORIGIN = 'https://titus-voice-version-2-production.up.railway.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // demo.titus-crm.com → reverse proxy to Railway
    if (url.hostname === 'demo.titus-crm.com') {
      return proxyToRailway(request, url);
    }

    // www.titus-crm.com (and any other hostname) → serve marketing site
    return new Response(SITE_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
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
