# softwareequality.com

The Software Equality company website. Static HTML is served from the Oracle Cloud Infrastructure server at `143.47.255.104` by the Caddy service in `aliabdalla-maker/good-hour`, with automatic HTTPS from Caddy/Let's Encrypt.

## Production architecture

`GitHub -> OCI uk-london-1 -> Caddy -> https://softwareequality.com/`

- `site/` is the company website root. Clean URLs such as `/privacy` are resolved by Caddy to the corresponding HTML file.
- `overrides/` contains the privacy and Business AI Manager policy/account-deletion pages retained from the migration work.
- `api/server.mjs` provides the website AI assistant (`POST /api/chat`) and checkout endpoint (`/api/checkout`, with the legacy function path retained for compatibility). It runs as the `se-api` service in the Good Hour production compose stack.
- `.github/workflows/check-live.yml` is the authoritative production smoke test. It checks DNS, HTTPS, key pages, AEP-X, API health, redirects, security headers and the 404 path twice per hour and on demand.

Netlify is no longer part of production hosting or deployment.

## AEP-X

AEP-X is intentionally deployed separately from this repository so the two-minute company-site Git sync cannot overwrite application releases.

Production URL:

`https://softwareequality.com/aep-x/`

Source repository:

`https://github.com/aliabdalla-maker/aepx-core`

The AEP-X self-hosted GitHub Actions runner on OCI publishes versioned releases under `/srv/aepx`, while Caddy mounts that path read-only and serves `/aep-x/`.

## How company-site changes go live

Push to `main`. The OCI `sitesync` service in `aliabdalla-maker/good-hour/docker-compose.prod.yml` fetches and hard-resets this repository to `origin/main` every two minutes. Caddy serves `site/` directly; `se-api` restarts itself when `api/server.mjs` changes.

There is no website build step and no Netlify deployment step.

## DNS

The expected production records are:

| Name | Type | Value |
|---|---|---|
| `softwareequality.com` (`@`) | A | `143.47.255.104` |
| `www` | A | `143.47.255.104` |

`www.softwareequality.com` redirects permanently to the apex hostname. Keep mail-related MX/TXT records unchanged.

## TLS and edge

Caddy terminates HTTPS and renews certificates automatically. The shared security-header policy is defined in `aliabdalla-maker/good-hour/deploy/Caddyfile` and includes HSTS, `X-Content-Type-Options`, Referrer Policy and a restrictive Permissions Policy.

## Operational checks

Run the GitHub workflow manually from Actions when needed, or verify directly:

```bash
curl -fsSI https://softwareequality.com/
curl -fsSL https://softwareequality.com/api/health
curl -fsSL https://softwareequality.com/aep-x/ | grep -q 'AEP-X'
```
