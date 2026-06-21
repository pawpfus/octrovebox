/* ============================================================
   OCTROVEBOX — same-origin market-data proxy (Cloudflare Pages Function)
   --------------------------------------------------------------
   Served at  /api/yf?url=<url-encoded Yahoo URL>  when the site is hosted on
   Cloudflare Pages. Yahoo Finance blocks direct browser calls (no CORS); this
   relays the request server-side and returns it to the app. Only forwards to
   Yahoo Finance, so it can't be abused as an open proxy. Auto-deploys with the
   site — nothing to configure once the Pages project exists.
============================================================ */
const ALLOWED_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request }) {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) return new Response('missing ?url=', { status: 400, headers: CORS });

  let t;
  try { t = new URL(target); } catch (e) { return new Response('bad url', { status: 400, headers: CORS }); }
  if (!ALLOWED_HOSTS.includes(t.hostname)) {
    return new Response('host not allowed', { status: 403, headers: CORS });
  }

  try {
    const upstream = await fetch(t.toString(), {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (octrovebox)' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...CORS,
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch (e) {
    return new Response('upstream error', { status: 502, headers: CORS });
  }
}
