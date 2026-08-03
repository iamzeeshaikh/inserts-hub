# Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**.
None of them are exposed to the browser: the enquiry endpoint runs as a
serverless function, and the post-build validator fails if any SMTP value
appears in a client asset.

| Variable | Required | Set? | Value | Purpose |
| --- | --- | --- | --- | --- |
| `SMTP_HOST` | **yes** | ✅ | `smtp.gmail.com` | Outgoing mail host |
| `SMTP_PORT` | no (default `465`) | ✅ | `587` | `465` = implicit TLS; anything else requires STARTTLS |
| `SMTP_USER` | **yes** | ✅ | `shanzeeshan571@gmail.com` | SMTP username |
| `SMTP_PASS` | **yes** | ❌ **missing** | — | Gmail **App Password** (16 chars) — never commit |
| `SMTP_TO` | no | ✅ | `shanimazhar82@gmail.com` | Where quote requests are delivered |
| `SMTP_FROM_NAME` | no | ✅ | `Website Ka Kame` | Display name on the notification |
| `SMTP_FROM_EMAIL` | no | ⚠️ not set | — | Only honoured if it shares `SMTP_USER`'s domain (see below) |

`INQUIRY_TO` and `SMTP_FROM` are still accepted as aliases for `SMTP_TO` and the
From identity, so either naming convention works.

### Gmail specifics

- **`SMTP_PASS` must be an App Password**, not the account password. Enable
  2-Step Verification on the Google account, then Google Account → Security →
  App passwords → generate one for "Mail". It is 16 characters.
- Port 587 uses STARTTLS, which the endpoint now *requires* rather than merely
  offers, so credentials are never sent in the clear.
- Gmail refuses to send as an address the authenticated account does not own.
  The supplied `SMTP_FROM_EMAIL=info@websitekaname` is both syntactically invalid
  (no TLD) and on a different domain from `shanzeeshan571@gmail.com`, so it is
  ignored: mail is sent as `shanzeeshan571@gmail.com` with the display name
  `Website Ka Kame`, and the enquirer's address is set as `Reply-To`.
- Gmail caps outbound mail at roughly 500 messages a day.

> **Worth considering:** sending Inserts Hub enquiries from a personal Gmail
> address under an unrelated brand name is likely to be filtered as spam and
> reads oddly to anyone who sees the header. If an `info@insertshub.com` mailbox
> exists, using it for both `SMTP_USER` and `SMTP_FROM_EMAIL` would be more
> deliverable and more consistent with the site.

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
