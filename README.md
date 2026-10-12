# softwareequality.com

The Software Equality company website. Static HTML, served from the Oracle
Cloud server (the same one that runs goodhour.shop) by Caddy, with HTTPS from
Let's Encrypt.

- `site/` is the website root. Pages work with or without `.html`
  (`/privacy` and `/privacy.html` are the same page), like on Netlify.
- `overrides/` holds pages that were added or changed during the move from
  Netlify: the updated `privacy.html` and the Business AI Manager app's
  privacy policy and account-deletion pages.
- `api/server.mjs` is the small back end that replaced the Netlify Functions:
  the website AI assistant (`POST /api/chat`, answers from the pages in
  `site/`, with a link-based fallback if the AI provider is down) and the
  bootcamp Stripe checkout (`/.netlify/functions/stripe-checkout?course=`,
  also `/api/checkout`). No dependencies; runs as the `se-api` service on the
  server using the OpenRouter/OpenAI and Stripe keys in the server's `.env`.
  Status: https://softwareequality.com/api/health
- `.github/workflows/mirror.yml` copied the live Netlify site into `site/`
  (one-off, already done). `check-live.yml` tests the live server directly.

## How changes go live

Push to `main`. The server pulls this repo every 2 minutes (the `sitesync`
service in good-hour's `docker-compose.prod.yml`) and Caddy serves the new
files straight away; `se-api` restarts itself when `api/` changes. No build
step. Nothing is hosted on Netlify any more.

## DNS (one-time switch from Netlify)

At your domain registrar, point:

| Name | Type | Value |
|---|---|---|
| `softwareequality.com` (`@`) | A | `143.47.255.104` |
| `www` | A (or CNAME to `softwareequality.com`) | `143.47.255.104` |

Remove the old Netlify records (`75.2.60.5` A record and any
`*.netlify.app` CNAME). Caddy issues the certificates within a few minutes of
DNS resolving to the server. `www` redirects to `https://softwareequality.com`.
Keep email (MX) records as they are.
