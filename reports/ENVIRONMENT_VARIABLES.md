# Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**.
None of them are exposed to the browser: the enquiry endpoint runs as a
serverless function, and the post-build validator fails if any SMTP value
appears in a client asset.

| Variable | Required | Environments | Example | Purpose |
| --- | --- | --- | --- | --- |
| `SMTP_HOST` | **yes** | Production, Preview | `smtp.hostinger.com` | Outgoing mail host |
| `SMTP_PORT` | no (default `465`) | Production, Preview | `465` | `465` uses implicit TLS; any other port uses STARTTLS |
| `SMTP_USER` | **yes** | Production, Preview | `info@insertshub.com` | SMTP username |
| `SMTP_PASS` | **yes** | Production, Preview | `••••••••` | SMTP password — **never commit this** |
| `SMTP_FROM` | no | Production, Preview | `"Inserts Hub website" <info@insertshub.com>` | From header; defaults to `SMTP_USER` |
| `INQUIRY_TO` | no | Production, Preview | `info@insertshub.com` | Where quote requests are delivered |

Vercel sets `VERCEL` and `VERCEL_ENV` automatically. `VERCEL_ENV !== 'production'`
is what switches every page to `noindex,nofollow` and `robots.txt` to
`Disallow: /`. Do not override them.

## Local development

Copy `.env.example` to `.env` (git-ignored) and fill it in.

## Behaviour when SMTP is not configured

The endpoint returns **HTTP 503** with a message directing the visitor to
`info@insertshub.com`. It never reports success for mail it did not send —
the browser only shows success after the SMTP server has accepted the message.

## Rotation

If the old WordPress host had SMTP credentials stored in a plugin, treat them as
compromised and issue a **new** password for this site rather than reusing them.
See `SECURITY_CUTOVER_CHECKLIST.md`.

---

## `SITE_LIVE` — the indexing switch

| Variable | Required | Environments | Value | Purpose |
| --- | --- | --- | --- | --- |
| `SITE_LIVE` | to enable indexing | Production only | `true` | Allows `index,follow` and a crawlable `robots.txt` |

**Leave this unset until insertshub.com's DNS points at this Vercel project.**

Indexing requires **both** `VERCEL_ENV=production` **and** `SITE_LIVE=true`.
Vercel promotes the first deployment of a new project to the production target
automatically, so `VERCEL_ENV` on its own would let `inserts-hub.vercel.app`
serve an indexable copy of the site before cutover. With this switch:

| State | `robots.txt` | Page meta |
| --- | --- | --- |
| Any preview deployment | `Disallow: /` | `noindex,nofollow` |
| Production target, `SITE_LIVE` unset | `Disallow: /` | `noindex,nofollow` |
| Production target, `SITE_LIVE=true` | `Allow: /` + sitemap | `index,follow` |

Setting it is a deliberate step in the cutover runbook, performed **after** DNS
has moved. `npm run validate` asserts the correct behaviour for whichever mode
the build was made in.
