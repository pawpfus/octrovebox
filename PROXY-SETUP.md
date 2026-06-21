# Market-data proxy

The Bot Lab (The Deep → Trading Floor) pulls real prices from **Yahoo Finance**,
which blocks direct browser calls (no CORS). So requests go through a small relay.
The app tries them in this order:

1. **Your private Cloudflare Worker** — fast, locked to this site's origin and to
   Yahoo only, so it can't be abused as an open proxy.
2. **Public proxy** (`corsproxy.io`) — automatic fallback if the Worker is
   unreachable.
3. **Offline sample data** — labelled synthetic series if nothing is reachable.

Nothing breaks at any stage. Everything else in the app (the finance tracker,
the Investment Floor, the Debt Dungeon) is fully offline and never touches the
proxy.

---

## The Worker (already deployed)

The Worker code lives in [`cloudflare-worker.js`](cloudflare-worker.js) and is
deployed at:

```
https://octrovebox-proxy.nightshifter.workers.dev/
```

It is wired into the app via `OWN_PROXY` near the top of the Bot Lab module in
[`app.js`](app.js).

### Locking it to your site
`cloudflare-worker.js` is locked with:

```js
const ALLOWED_ORIGINS = ['https://pawpfus.github.io'];
```

so only the live Octrovebox site can use the Worker. After editing that list
(e.g. to add a custom domain), **redeploy the Worker** in the Cloudflare
dashboard for the change to take effect.

> While testing locally you can temporarily set `ALLOWED_ORIGINS = ['*']`, but
> revert it before shipping so the Worker stays private.

---

## Does this affect offline use or other people?

- **Offline:** never affected. The tracker and all your data work fully offline;
  only the live-price Bot Lab needs a connection, and it falls back to labelled
  sample data when there isn't one.
- **Community:** the Worker is locked to your origin, so it only serves your own
  visitors and can't be reused as a public relay.
