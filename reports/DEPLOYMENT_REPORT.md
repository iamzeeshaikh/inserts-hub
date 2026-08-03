# Deployment report

| | |
| --- | --- |
| **Vercel project** | `inserts-hub` (newly created — no existing project was touched) |
| **Scope** | `iamzeeshaikhs-projects` |
| **Preview / test URL** | https://inserts-hub.vercel.app |
| **Production URL after cutover** | https://insertshub.com |
| **Indexable right now?** | **No** — `noindex,nofollow` + `robots.txt: Disallow: /` |
| **DNS changed?** | **No.** Cloudflare has not been touched. |
| **Repository** | Local git in `insertshub-astro/`, 4 commits, no remote configured |

---

## Indexing is opt-in

Vercel promoted this project's first deployment to the production target
automatically, which briefly made `inserts-hub.vercel.app` serve `index,follow`.
That is now impossible: indexing requires **both** `VERCEL_ENV=production` **and**
an explicit `SITE_LIVE=true`. Until you set that variable, every deployment —
production target included — is `noindex,nofollow` with a disallow-all
`robots.txt`. `npm run validate` asserts the correct behaviour for whichever mode
the build was made in.

Canonicals, Open Graph URLs, JSON-LD and the sitemap always use
`https://insertshub.com`, on every deployment. No Vercel host appears in any of
them — the validator fails the build if one does.

---

## Verified on the live deployment

### Routes — all 200

`/` · `/products/` · `/products/page/2/` · `/product-category/cardboard-inserts/` ·
`/product-category/product/` · `/product-category/product/page/2/` ·
all 31 `/product/<slug>/` · `/about-us/` · `/contact-us/` · `/privacy-policy/` ·
`/refund_returns/` · `/terms-conditions/` · `/thank-you/` · `/sitemap.xml` ·
`/robots.txt`

### Redirects — every one a single 301 hop to a 200

| From | To | Hops | Final |
| --- | --- | ---: | ---: |
| `/about-us-2/` | `/about-us/` | 1 | 200 |
| `/cart/` | `/products/` | 1 | 200 |
| `/checkout/` | `/products/` | 1 | 200 |
| `/my-account/` | `/contact-us/` | 1 | 200 |
| `/product-category/foam-inserts/` | `/products/` | 1 | 200 |
| `/product/printed-cardboard-inserts/` | `/product/custom-cardboard-inserts/` | 1 | 200 |
| `/product/recycled-cardboard-inserts/` | `/product/custom-kraft-paper-inserts/` | 1 | 200 |
| `/product/White-cardboard-inserts/` | `/product/white-cardboard-inserts/` | 1 | 200 |
| `/sitemap_index.xml` | `/sitemap.xml` | 1 | 200 |

### Error handling

| URL | Status |
| --- | --- |
| `/category/casino/`, `/category/spiele/`, `/category/forex-news/`, `/category/uncategorized/` … (all 33) | **410 Gone** |
| `/category/anything-else/` | 404 |
| `/nope/`, `/product/does-not-exist/` | 404 (custom 404 page) |

### Form endpoint — `/api/inquiry/`

| Test | Result |
| --- | --- |
| `GET` | 405 Method Not Allowed |
| Cross-origin `POST` | 403 (also blocked by Vercel's own cross-site POST guard) |
| Invalid email | 400 with a specific message |
| Honeypot filled | 200 `{"ok":true}` — silently dropped |
| PHP webshell renamed `shell.jpg`, `Content-Type: image/jpeg` | **400 — "That file is not a valid JPG."** (magic bytes checked) |
| Double extension `logo.php.pdf` | **400 — "must have exactly one extension"** |
| `bad.exe` | **400 — extension not allowed** |
| 6th request in 10 minutes from one IP | 429 rate-limited |

### Lighthouse — local live-mode build, desktop

| Page | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| `/` | 100 | 100 | 100 | 100 |
| `/products/` | 100 | 100 | 100 | 100 |
| `/product/white-cardboard-inserts/` | 100 | 100 | 100 | 100 |
| `/product-category/cardboard-inserts/` | 100 | 100 | 100 | 100 |
| `/contact-us/` | 100 | 100 | 100 | 100 |

Mobile: homepage 99 / 100 / 100 / 100 (LCP 2.3 s, CLS 0, TBT 0 ms); product page
100 / 100 / 100 / 100 (LCP 1.8 s, CLS 0, TBT 0 ms).

On the deployed preview the SEO score is 69 for exactly one reason —
`is-crawlable` fails because the page is deliberately `noindex`. Every other
audit passes. Setting `SITE_LIVE=true` takes it to 100.

### Responsive QA

11 pages × 5 breakpoints (320 / 375 / 768 / 1024 / 1440) = **55 combinations,
all clean**, run against both the local build and the deployed URL. Zero
horizontal overflow, zero overflowing elements, zero undersized touch targets,
one `<h1>` per page, no image without explicit dimensions, no console errors.
See `RESPONSIVE_QA_REPORT.md` and `reports/screenshots/`.

---

## ⚠️ Not yet tested: email delivery

SMTP environment variables are **not set**, so no quote request has actually been
delivered. The endpoint refuses to pretend otherwise: with SMTP unconfigured it
returns **HTTP 503** and tells the visitor to email `info@insertshub.com`, and
the browser only shows success after the SMTP server accepts the message.

**Before cutover:** add the variables from `ENVIRONMENT_VARIABLES.md`, redeploy,
and send one real enquiry through the form on `/contact-us/`.

---

## DNS cutover instructions

**Do not apply these until you tell me to, or until you are ready.** Nothing
below has been executed.

### 1. Add the domains in Vercel

Vercel → `inserts-hub` → Settings → Domains → add:

- `insertshub.com`
- `www.insertshub.com`

### 2. Cloudflare DNS records

Replace the existing records that point at the WordPress host:

| Type | Name | Value | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| `A` | `@` | `76.76.21.21` | **DNS only (grey cloud)** | Auto |
| `CNAME` | `www` | `cname.vercel-dns.com` | **DNS only (grey cloud)** | Auto |

Delete the old `A`/`AAAA`/`CNAME` records for `@` and `www` that point at the
WordPress server.

> Use **DNS only** while the certificate issues. You can re-enable the orange
> cloud afterwards, but if you do, set Cloudflare SSL/TLS mode to **Full
> (strict)** — "Flexible" would create a redirect loop.

Confirm the current values Vercel shows you in the Domains panel before applying;
they occasionally change and the panel is authoritative.

### 3. Remove obsolete records

Delete any DNS record still pointing at the old host — old `A` records, mail
records for services no longer used, and any verification `TXT` records added by
WordPress plugins. **Leave MX and SPF/DKIM records alone** unless you are also
moving email; the form's SMTP account depends on them.

### 4. After propagation

```bash
curl -sSI https://insertshub.com/ | head -1                    # expect 200
curl -sS  https://insertshub.com/robots.txt                     # expect Allow: /
curl -sSI https://insertshub.com/cart/ | grep -i location       # expect /products/
curl -sS -o /dev/null -w '%{http_code}\n' \
     https://insertshub.com/category/casino/                    # expect 410
```

Then set `SITE_LIVE=true`, redeploy, and purge the Cloudflare cache.

---

## Rollback

The old WordPress site is untouched and still running, so rollback is a DNS
change and nothing else.

### Immediate rollback (minutes)

1. In Cloudflare, restore the original `A`/`CNAME` records for `@` and `www`
   (the values you noted in step A of `SECURITY_CUTOVER_CHECKLIST.md`).
2. Purge the Cloudflare cache.
3. Verify: `curl -sSI https://insertshub.com/ | head -1`.

DNS TTL is the only delay. Lower the TTL to 300 seconds a day *before* cutover to
shorten it.

> Rolling back restores the compromised site, spam included. Treat it as an
> emergency measure, not a resting state.

### Rolling back a bad deploy without touching DNS

```bash
cd insertshub-astro
vercel ls inserts-hub                 # find the last good deployment
vercel promote <deployment-url>       # instant, no DNS change
```

Or in the Vercel dashboard: Deployments → the previous build →
**Promote to Production**.

### Rolling back a code change

```bash
git log --oneline
git revert <commit>
npm run verify && vercel deploy --prod
```

---

## Manual steps that remain

1. Add the SMTP variables and send a real test enquiry.
2. Decide whether the WooCommerce cart flow needs rebuilding on a payment
   provider, or whether quote-only is correct (see `MIGRATION_CONFLICTS.md` §5).
3. Tell me when to run the DNS cutover, or run it yourself using the records
   above.
4. Set `SITE_LIVE=true` **after** DNS has moved.
5. Work through `SECURITY_CUTOVER_CHECKLIST.md` — especially isolating the old
   server and rotating credentials.
6. Optionally add a git remote and connect it to Vercel for push-to-deploy.
