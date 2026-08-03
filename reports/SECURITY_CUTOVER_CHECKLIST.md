# Security cutover checklist

The old WordPress install was serving injected gambling spam at audit time.
**Assume the server is still compromised.** The new Astro site removes the
malware from what visitors and crawlers see; it does not clean the old server.

⚠️ Nothing in this checklist has been executed. I have no access to the hosting
panel, WordPress admin, Cloudflare, Search Console or the mail account, and DNS
has deliberately not been touched. These are the steps for you to run.

---

## A. Before cutover

- [ ] Take **one full offline backup** of the old site (files + database) and
      store it off-server. Keep it for forensics and for the rollback path.
- [ ] **Never import that backup into Astro.** It is evidence, not a source.
- [ ] Note the current DNS records for insertshub.com so they can be restored.
- [ ] Confirm the preview at https://inserts-hub.vercel.app renders correctly.
- [ ] Add SMTP environment variables in Vercel (see `ENVIRONMENT_VARIABLES.md`)
      and send one real test enquiry. **Email delivery is currently untested.**

## B. Cutover

- [ ] Point DNS at Vercel (exact records in `DEPLOYMENT_REPORT.md`).
- [ ] Add `insertshub.com` and `www.insertshub.com` as domains on the
      `inserts-hub` Vercel project and wait for the certificate to issue.
- [ ] Set `SITE_LIVE=true` in Vercel → Production, then redeploy.
      **Until this is set, every page stays `noindex` — including production.**
- [ ] Verify `https://insertshub.com/robots.txt` shows `Allow: /` and the sitemap
      line, and that the homepage shows `index,follow`.
- [ ] Purge the Cloudflare cache.

## C. Contain the old server — do this the same day

- [ ] **Isolate or terminate the old WordPress server.** While it is reachable,
      it can still be used to serve spam or re-attack.
- [ ] If it must stay up briefly, block all public traffic at the firewall.
- [ ] Review and remove any unknown WordPress administrator accounts.
- [ ] Review `wp_cron` / system cron for tasks that re-inject content.
- [ ] Search `wp-content/uploads` for `.php`, `.phtml` and double-extension files
      — a webshell there is the most likely persistence mechanism.
- [ ] Retain access and error logs for at least 90 days before decommissioning.

## D. Rotate every credential the old server could have held

Treat all of these as compromised.

- [ ] WordPress administrator passwords
- [ ] Hosting control-panel password
- [ ] Database username and password
- [ ] FTP / SFTP / SSH credentials and keys
- [ ] SMTP credentials — **issue a new password for the Vercel form rather than
      reusing whatever the old plugin stored**
- [ ] Cloudflare account password + API tokens; enable 2FA
- [ ] Any third-party API keys stored in WordPress plugins
- [ ] Vercel account password; enable 2FA

## E. Review access to connected accounts

- [ ] Google Search Console — remove unknown owners and users
- [ ] Google Analytics — remove unknown users
- [ ] Google Tag Manager — remove unknown users and check for injected tags
- [ ] Cloudflare — remove unknown members
- [ ] Email — check for forwarding rules or filters added by an attacker
- [ ] Google Merchant Center, if the `_wc_gla_*` product fields indicate it was
      connected

## F. Search Console follow-up

- [ ] Submit `https://insertshub.com/sitemap.xml`.
- [ ] Remove the old `sitemap_index.xml` submission (it now 301s).
- [ ] Use **Removals** on the spam URLs listed in `SPAM_URL_MAP.csv` to speed up
      their disappearance — the 410s will handle it eventually, removals are
      faster.
- [ ] Check **Security Issues** and request a review if a manual action is shown.
- [ ] Use **URL Inspection → Request indexing** on the homepage, `/products/` and
      the top product pages.
- [ ] Remove the hand-added `# Block spam paths` rules from the old robots.txt
      mindset — the new robots.txt does not need them, because the spam URLs now
      return 410 rather than being merely disallowed. (`Disallow` prevents
      recrawling, which actually *slows* deindexing.)

## G. Monitor for 30 days

- [ ] Watch Search Console **Pages** for any `/category/` URL reappearing.
- [ ] Watch **Coverage** for unexpected new URLs.
- [ ] Run a `site:insertshub.com` search weekly and look for gambling terms.
- [ ] Confirm the 410s are still returning 410:
      `curl -o /dev/null -w '%{http_code}' https://insertshub.com/category/casino/`

---

## What the new site does *not* need

Because it is a static build with one server endpoint, there is no database, no
admin login, no plugin surface, no theme editor and no file-upload directory.
The only writable path is the enquiry endpoint, which never persists an upload —
it validates the bytes, attaches them to an email and discards them.
