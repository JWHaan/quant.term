# Contributing

Thanks for helping improve `quant.term`. Keep pull requests focused, explain the user impact, and preserve the read-only safety boundary.

## Set up locally

~~~bash
git clone https://github.com/YOUR_USERNAME/quant.term.git
cd quant.term
npm ci
npm run dev
~~~

Node.js 22.12 or newer within the 22.x LTS line is required. The active dashboard needs no environment variables.

## Development workflow

1. Create a short-lived branch from an up-to-date `main`.
2. Add or update tests with the behavior change.
3. Run the complete local gate:

~~~bash
npm run check
~~~

4. Open a pull request using the repository template.

Use Conventional Commit-style subjects where practical, for example `fix: recover stale candle stream` or `docs: clarify news provider behavior`.

## Engineering expectations

- Keep TypeScript strict and do not add `@ts-nocheck`.
- Treat external JSON as `unknown` and validate it at the integration boundary.
- Keep provider-specific parsing under `src/integrations`.
- Keep calculations pure when possible and cover financial math with deterministic fixtures.
- Clean up WebSockets, intervals, abort controllers, and subscriptions on unmount.
- Do not fabricate fallback prices, volume, P&L, risk metrics, or news.
- Never put secrets in `VITE_*` variables; Vite values are shipped to the browser.
- Update README, architecture, deployment, or indicator docs when their contracts change.

Coverage floors in `vitest.config.ts` are a current full-tree baseline, not a definition of sufficient coverage for a new feature. New logic should include focused tests for success, malformed input, upstream failure, and boundary conditions.

## Pull requests

A ready pull request should:

- describe what changed and why
- link the relevant issue when one exists
- include screenshots for visible UI changes
- identify data-provider or deployment impact
- pass lint, type-check, tests, coverage, and build
- avoid unrelated formatting or dependency churn

## Security

Do not report vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md) and use GitHub's private security-advisory flow.

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
