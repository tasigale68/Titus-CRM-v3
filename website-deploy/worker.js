// Titus CRM — Cloudflare Worker with hostname-based routing
// www.titus-crm.com  → serve marketing site (static assets)
// demo.titus-crm.com  → reverse proxy to Railway backend

const RAILWAY_ORIGIN = 'https://titus-voice-version-2-production.up.railway.app';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // demo.titus-crm.com → reverse proxy to Railway
    if (url.hostname === 'demo.titus-crm.com') {
      return proxyToRailway(request, url);
    }

    // www.titus-crm.com (and any other hostname) → serve static assets
    return env.ASSETS.fetch(request);
  }
};

async function proxyToRailway(request, url) {
  // Build upstream URL preserving path + query
  const upstream = new URL(url.pathname + url.search, RAILWAY_ORIGIN);

  // Clone headers, set Host to Railway's domain so it accepts the request
  const headers = new Headers(request.headers);
  headers.set('Host', new URL(RAILWAY_ORIGIN).host);
  headers.set('X-Forwarded-Host', 'demo.titus-crm.com');
  headers.set('X-Forwarded-Proto', 'https');

  // Check for WebSocket upgrade (Socket.io)
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

  // Clone response and adjust headers
  const respHeaders = new Headers(response.headers);
  // Remove any strict transport headers from Railway that might conflict
  respHeaders.delete('strict-transport-security');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders
  });
}
