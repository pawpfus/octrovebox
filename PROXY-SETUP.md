# Market-data proxy

The Bot Lab pulls real prices from **Yahoo Finance**, which blocks direct
browser calls (no CORS). So requests go through a small relay. The app picks
one automatically, in this order:

1. **Same-origin Cloudflare Pages Function** at `/api/yf` — used when the site
   is served from Cloudflare Pages. Private, fast, auto-deploys with the repo.
2. **Public proxy** (`corsproxy.io`) — automatic fallback (e.g. on GitHub Pages).
3. **Offline sample data** — if nothing is reachable.

So nothing breaks at any stage; this guide just upgrades you to path #1.

---

## Recommended: Cloudflare Pages (you already linked the repo)

The proxy code already lives in the repo at
[`functions/api/yf.js`](functions/api/yf.js) — Cloudflare Pages turns any file
under `functions/` into an endpoint automatically. You just need to create the
Pages project:

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pick the **octrovebox** repo.
2. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
3. **Save and Deploy.** You'll get a URL like
   `https://octrovebox.pages.dev`.
4. Open `https://octrovebox.pages.dev` and try the Bot Lab — it now uses
   `/api/yf` (same-origin, no CORS). Done. Every `git push` redeploys both the
   site and the proxy.

Nothing to edit in the code: the app auto-detects the Pages domain and uses the
function there, while `github.io` keeps using the public fallback.

### (Optional) lock the proxy to your domain
In `functions/api/yf.js`, change `'access-control-allow-origin': '*'` to your
Pages URL, e.g. `'https://octrovebox.pages.dev'`, and push.

---

## Alternative: a standalone Cloudflare Worker

If you'd rather not host the site on Pages, deploy
[`cloudflare-worker.js`](cloudflare-worker.js) as a Worker instead, then set
`OWN_PROXY` near the top of the Bot Lab module in [`app.js`](app.js):

```js
const OWN_PROXY = 'https://octrovebox-proxy.your-name.workers.dev/?url=';
```

Bump the `app.js?v=` in `index.html` + the `CACHE` in `sw.js`, then push.

---

## Does this affect offline use or other people?

- **Offline:** never affected. The finance tracker + your data are fully offline;
  the Bot Lab just shows labelled *sample data* when there's no connection (no
  live feed can work offline regardless).
- **Community:** the Pages Function only serves traffic on your Pages domain, so
  it only handles your own visitors — and you can lock it to your origin above.
