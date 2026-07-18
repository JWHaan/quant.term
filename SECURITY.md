# Security policy

## Supported versions

Until the first tagged release, security fixes are applied to the latest commit on `main` only. Older commits, preview branches, forks, and third-party deployments are not supported.

## Report a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use GitHub's private reporting flow:

[Report a vulnerability privately](https://github.com/JWHaan/quant.term/security/advisories/new)

Include the affected route or component, reproduction steps, impact, browser/runtime details, and a minimal proof of concept when safe. Do not include real credentials, private keys, seed phrases, or personal data.

## Security model

`quant.term` is a read-only market dashboard:

- it does not accept exchange API keys
- it does not connect wallets or hold funds
- it does not submit orders
- active provider endpoints are public and read-only
- preferences, alerts, and paper-trading state remain in browser storage
- news aggregation fetches public RSS and stores no user portfolio data

Browser extensions, a compromised device, an upstream provider, or a modified fork can still observe or alter browser-visible data. Paper positions and alerts are not sensitive credentials, but users should clear site storage on shared devices.

## Secrets and authenticated features

Vite environment values are compiled into client JavaScript. Never place a secret in a `VITE_*` variable or browser storage.

Any future authenticated provider must use a server-side boundary with:

- secrets managed by the hosting platform
- explicit allowlisted upstreams
- authentication and authorization
- request validation and rate limits
- audit logging appropriate to the data handled

## Dependency and code hygiene

The repository uses a lockfile, CI quality gates, and Dependabot configuration. Security-sensitive changes should avoid dynamic code execution, raw HTML rendering, and unvalidated external JSON. Serve production deployments over HTTPS so REST and WebSocket traffic remains encrypted in transit.

This policy does not claim compliance with a particular regulatory framework or guarantee a response timeline.
