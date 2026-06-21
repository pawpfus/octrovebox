# Your own market-data proxy (10 minutes, free)

The Bot Lab pulls real prices from **Yahoo Finance**, which blocks direct
browser calls. By default the app borrows a free **public** relay
(`corsproxy.io`). That works, but it's a shared server that can rate-limit,
go down, or see your requests.

This guide sets up your **own** relay on **Cloudflare Workers** — a tiny
program that fetches Yahoo on the app's behalf and returns the data to your
site only. Free tier is ~100,000 requests/day (far more than you'll use).

Once deployed, the app uses **your** proxy first and falls back to the public
one automatically, so nothing breaks during setup.

---

## Steps

1. **Create a free Cloudflare account** → <https://dash.cloudflare.com/sign-up>

2. **Make a Worker**
   - Dashboard → **Workers & Pages** → **Create application** → **Create Worker**.
   - Give it a name, e.g. `octrovebox-proxy`. Click **Deploy** (it deploys a
     placeholder), then **Edit code**.

3. **Paste the code**
   - Replace everything in the editor with the contents of
     [`cloudflare-worker.js`](cloudflare-worker.js) from this repo.
   - Click **Deploy**.

4. **Copy your Worker URL**
   - It looks like `https://octrovebox-proxy.<your-subdomain>.workers.dev`.

5. **Point the app at it**
   - Open [`app.js`](app.js), find `OWN_PROXY` near the top of the Bot Lab
     module, and set it to your Worker URL **with `/?url=` on the end**:
     ```js
     const OWN_PROXY = 'https://octrovebox-proxy.your-name.workers.dev/?url=';
     ```
   - Bump the `app.js?v=` number in `index.html` and the `CACHE` in `sw.js`,
     then commit + deploy as usual.

6. **(Recommended) Lock it to your site**
   - Back in the Worker code, set:
     ```js
     const ALLOWED_ORIGINS = ['https://pawpfus.github.io'];
     ```
   - Re-deploy. Now only octrovebox can use your proxy.

That's it. The app tries `OWN_PROXY` → `corsproxy.io` → offline sample data,
in that order, so it stays resilient no matter what.

---

## How it works

```
browser ──/?url=<yahoo url>──▶  your Cloudflare Worker
                                      │ (server-to-server: no CORS limits)
                                      ▼
                                Yahoo Finance
                                      │
        data + your CORS header ◀─────┘
```

The worker only forwards requests to `*.finance.yahoo.com`, so it can't be
abused as a general open proxy.
