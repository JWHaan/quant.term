# Contributing

Thanks for helping improve `quant.term`. Keep pull requests focused, explain the user impact, and preserve the read-only safety boundary.

## Set up locally

~~~bash
git clone https://github.com/YOUR_USERNAME/quant.term.git
cd quant.term
npm ci
npm run dev
~~~

Node.js 24.15 or newer within the 24.x LTS line is required. The generated wasm-bindgen bundles under `src/wasm` are committed, so `npm ci` and `npm run dev` work without a Rust toolchain. Editing the Rust crates (`rust/` or `ui/`) additionally requires a stable Rust toolchain with the `wasm32-unknown-unknown` target and the `wasm-bindgen` CLI. The dashboard needs no environment variables.

## Development workflow

1. Create a short-lived branch from an up-to-date `main`.
2. Add or update tests with the behavior change.
3. Run the complete local gate:

~~~bash
npm run check
~~~

   When changing `rust/` or `ui/`, also rebuild the committed bundles and run the Rust gate:

~~~bash
npm run wasm:build              # quant-core
npm run wasm:build:ui           # quant-ui (Leptos frontend)
npm run wasm:check              # cargo fmt --check + clippy -D warnings
~~~

   Rebuild locally so the dev server reflects your changes and commit the result. rustc wasm output is platform-dependent, so the `wasm` CI job re-generates `src/wasm/` on linux-x86_64 and pushes the canonical bytes back to the PR branch — don't be surprised by that extra bot commit.

4. Open a pull request using the repository template.

Use Conventional Commit-style subjects where practical, for example `fix: recover stale candle stream` or `docs: clarify news provider behavior`.

## Engineering expectations

- Keep TypeScript strict and do not add `@ts-nocheck`.
- Treat external JSON as `unknown` and validate it at the integration boundary.
- Keep provider-specific parsing under `ui/src/services` and `ui/src/stores`.
- Keep calculations pure when possible and cover financial math with deterministic fixtures.
- Keep the Rust/WASM engine and the TypeScript reference implementations aligned through the parity suite in `src/tests`.
- Treat synthetic replay output as correctness evidence, never as historical performance.
- Clean up WebSockets, intervals, abort controllers, and subscriptions when components drop.
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
- pass lint, type-check, tests, coverage, and build (plus `wasm:check` for Rust changes)
- avoid unrelated formatting or dependency churn

## Security

Do not report vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md) and use GitHub's private security-advisory flow.

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
