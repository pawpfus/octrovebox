/* ============================================================
   OCTROVEBOX — private market-data proxy (Cloudflare Worker)
   --------------------------------------------------------------
   Yahoo Finance blocks direct browser calls (no CORS headers), so the
   Bot Lab needs a relay. This is your OWN relay — deploy it once and the
   app talks to it instead of a shared public proxy. It only forwards
   requests to Yahoo Finance and (optionally) only from your own site.

   Usage from the app:
     https://<your-worker>.workers.dev/?url=<url-encoded Yahoo URL>

   Deploy: see PROXY-SETUP.md (takes ~10 minutes, free tier).
============================================================ */

// Locked to the live Octrovebox site so the worker only serves your own
// visitors and can't be reused as a public proxy. Add more origins (e.g. a
// Pages/preview/custom domain) to this list as needed; use ['*'] only while
// testing. Requests from other origins fall back to the first allowed origin.
const ALLOWED_ORIGINS = ['https://pawpfus.github.io'];
// Only these hosts may be fetched — prevents your worker becoming an open proxy.
const ALLOWED_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes('*')
    ? '*'
    : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'GET') {
      return new Response('method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    const target = new URL(request.url).searchParams.get('url');
    if (!target) return new Response('missing ?url=', { status: 400, headers: corsHeaders(origin) });

    let t;
    try { t = new URL(target); } catch (e) { return new Response('bad url', { status: 400, headers: corsHeaders(origin) }); }
    if (!ALLOWED_HOSTS.includes(t.hostname)) {
      return new Response('host not allowed', { status: 403, headers: corsHeaders(origin) });
    }

    try {
      const upstream = await fetch(t.toString(), {
        headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (octrovebox-proxy)' },
        cf: { cacheTtl: 300, cacheEverything: true },
      });
      const body = await upstream.arrayBuffer();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(origin),
          'content-type': upstream.headers.get('content-type') || 'application/json',
          'cache-control': 'public, max-age=300',
        },
      });
    } catch (e) {
      return new Response('upstream error', { status: 502, headers: corsHeaders(origin) });
    }
  },
};
