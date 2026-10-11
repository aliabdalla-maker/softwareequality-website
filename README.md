# softwareequality.com

The Software Equality company website. Static HTML, served from the Oracle
Cloud server (the same one that runs goodhour.shop) by Caddy, with HTTPS from
Let's Encrypt.

- `site/` is the website root. Pages work with or without `.html`
  (`/privacy` and `/privacy.html` are the same page), like on Netlify.
- `overrides/` holds pages that were added or changed during the move from
  Netlify: the updated `privacy.html` and the Business AI Manager app's
  privacy policy and account-deletion pages.
- `.github/workflows/mirror.yml` copied the live Netlify site into `site/`.
  Run it once from the Actions tab before switching DNS.

## How changes go live

Push to `main`. The server pulls this repo every 2 minutes (the `sitesync`
service in good-hour's `docker-compose.prod.yml`) and Caddy serves the new
files straight away. No build step.

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
