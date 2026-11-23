<!-- AGENTS-GENERATED-START -->

# AGENTS.md

> Compatible with the [agents.md](https://agents.md) standard. Specific rules in `.agents/rules/` — architecture, frontend-patterns, testing, git-workflow.

## Project Overview

quant.term is a browser-native crypto market intelligence terminal: a Leptos 0.8 UI compiled to WebAssembly on top of a shared `quant-core` Rust engine, fed by public read-only Binance spot/USDⓈ-M feeds, with order-flow signals (OFI/CVD/VPIN), alerts, paper trading, and a deterministic Strategy Lab.

> Detailed docs: @CONTRIBUTING.md — large files linked, not imported: [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/INDICATORS.md](docs/INDICATORS.md)

## Setup commands

- Install JS deps: `npm install` (Node `>=24.15.0`, npm `12.2.2`)
- Dev server: `npm run dev` (Vite, port 3000)
- Full gate: `npm run check` (lint + type-check + coverage + build)
- Rust gate: `npm run wasm:check` (fmt + clippy on `rust/quant-core`, wasm32 target)
- Rust toolchain: `rustup` + `wasm32-unknown-unknown` target + `wasm-bindgen` CLI — only needed when editing `rust/` or `ui/`

## Source Files

```text
quant.term/
├── rust/            # quant-core: indicators, order-flow math, backtest engine (cdylib + rlib)
├── ui/              # quant-ui: Leptos frontend crate → wasm-bindgen bundle
│   └── src/{app,stores,services,data,features,ui}
├── src/             # Thin TypeScript layer (entry, adapters, reference impls, tests)
│   ├── rust-main.ts        # Vite entry — boots the quant-ui WASM app
│   ├── backtest/           # engine.ts (adapter) + engine-reference.ts (TS parity reference)
│   ├── utils/              # indicators(-reference).ts, tradeClassifier, vpinCalculator, format
│   ├── wasm/{quant-core,quant-ui}/  # COMMITTED wasm-bindgen output — regenerate, never edit
│   └── tests/              # Vitest: indicators/, backtest/, utils/ + setup.ts
├── scripts/         # build-wasm.sh, build-ui-wasm.sh, check-wasm.sh, verify-sites-build.mjs, ...
├── build/           # sites-vite-plugin.ts (custom Vite/Cloudflare Sites plugin)
└── .github/workflows/ci.yml
```

## Feature map

| Feature | Files |
|---------|-------|
| UI feature module | `ui/src/features/<name>.rs` (charts, backtest, news, market, trading, command_palette, analytics, debug) |
| Global state | `ui/src/stores/` — Leptos signals (`AppStores`) |
| Data providers | `ui/src/services/` — Binance WS/REST, RSS edge route |
| Indicator math | `rust/src/` (`quant-core`) |
| Backtest runtime | `rust/` via `quant-ui` WASM → `src/backtest/engine.ts` adapter |
| Parity references | `src/utils/indicators-reference.ts`, `src/backtest/engine-reference.ts` |
| WASM glue rebuild | `npm run wasm:build` (quant-core), `./scripts/build-ui-wasm.sh` (quant-ui) |

## Where to edit

- New indicator/order-flow math → `rust/src/` then `npm run wasm:build`
- UI changes → `ui/src/` then `./scripts/build-ui-wasm.sh` (commits the regenerated bundle)
- Never edit `src/wasm/**` or `dist/` by hand — regenerate via the scripts above
- Changing a numeric contract → update the TS reference + parity test together

## Essential Commands

| Command | Purpose | When |
| ------- | ------- | ---- |
| `npm run dev` | Vite dev server :3000 | Local iteration |
| `npm run lint` | ESLint, `--max-warnings=0` | Before committing |
| `npm run type-check` | `tsc --noEmit` | Before committing |
| `npm test` | Vitest single run (18 files / 124 tests) | Before committing |
| `npm run build` | `tsc && vite build` + postbuild Sites verify | Before committing / deploy |
| `npm run wasm:check` | cargo fmt --check + clippy (`-D warnings`) on `rust/` | After editing `rust/` |
| `npm run wasm:build` | Rebuild `quant-core` bundle → `src/wasm/quant-core` | After editing `rust/` |
| `./scripts/build-ui-wasm.sh` | Rebuild `quant-ui` bundle → `src/wasm/quant-ui` | After editing `ui/` |
| `npm run shot` | Playwright screenshot driver | Visual verification |
| `npm run check` | All of the above JS gates | Pre-PR |

## Environment variables

None required — all data sources are public/read-only (`.env.example` documents them).
**Security rule:** every `VITE_*` value ships in the client bundle — never put exchange credentials or private keys in `VITE_*` vars; route authenticated providers through a secured backend/proxy.

## Verification Cycle

After every code change — do not mark a task complete without passing:

```bash
npm run lint && npm run type-check && npm test && npm run build   # JS gates
npm run wasm:check                                                # after rust/ edits
```

Plus, when `rust/` or `ui/` changed: rebuild the corresponding committed wasm bundle and verify the diff is only the expected binary/glue.

## Before committing

- [ ] Verification cycle green
- [ ] Committed wasm bundles regenerated if `rust/`/`ui/` source changed
- [ ] `git status` shows no unintended churn (e.g., repo-wide `cargo fmt` on `ui/`)

## Pre-validate

No pre-commit hooks exist — CI runs `lint`, `type-check`, `test`, `build`. Run `npm run check` before pushing to replicate CI.

## Code Style

- Rust: `cargo fmt` clean + `cargo clippy -D warnings` clean — `check-wasm.sh` enforces both on `rust/`; run `cargo fmt --manifest-path rust/Cargo.toml` to fix
- TypeScript: ESLint flat config, zero warnings allowed; strict `tsc`
- Leptos: signal-based state via `AppStores`; keep feature modules self-contained in `ui/src/features/`

## Hard Rules

1. Editing `rust/` or `ui/` without regenerating the committed bundle in `src/wasm/` leaves the repo inconsistent — always rebuild.
2. The TS reference implementations (`*-reference.ts`) are the parity ground truth — never weaken or remove them; parity tests diff wasm output against them.
3. Parity/golden numbers must match `quant-core` exactly — fix the engine, not the expectation, unless the contract itself is being changed deliberately.

## Prohibitions

- **Never** edit generated files: `src/wasm/quant-core/*`, `src/wasm/quant-ui/*`, `dist/`
- **Never** run blanket `cargo fmt` on `ui/` — that crate isn't fmt-clean; only `rust/` is gated
- **Never** create README/docs unless asked
- **Never** commit secrets or exchange API keys anywhere (see env vars rule)

## Boundaries

Ask first: changing parity test expectations, bumping deps, touching CI branch protection, pushing to `main` (protection prefers PRs).

Never: force-push, rewrite history, edit `src/wasm/**` or `dist/` directly, remove the TS reference engines.

## Generated artifacts

`src/wasm/{quant-core,quant-ui}/` and `dist/` are build output. Source of truth: `rust/`, `ui/src/`, `src/` (non-wasm), `build/`, `scripts/`. Regenerate via `npm run wasm:build` / `./scripts/build-ui-wasm.sh` / `npm run build`. Stage regenerated bundles in the same change as the source edit that produced them.

## Global Conventions

- npm `12.2.2` always (package-lock.json is the lockfile of record); Node `>=24.15.0`
- English everywhere: code, comments, docs, commits
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` with optional scope — e.g. `fix(ui):`, `fix(tests):`
- Alias `@/` → `src/` in Vite
- Two standalone cargo crates (no workspace): `rust/quant-core`, `ui/quant-ui`

## Architecture decisions

- **Why committed wasm bundles**: deploys and JS-only contributors need no Rust toolchain; bundle drift is a real bug vector — always regenerate after Rust edits.
- **Why TS reference engines remain**: they are the deterministic ground truth the wasm↔TS parity tests assert against; they are not dead code.
- **Why Leptos signals, not a TS store lib**: state lives in `AppStores` inside the WASM app; `localStorage` persistence keeps Zustand-compatible keys for migrated users — do not rename persisted keys casually.
- **Why `build-ui-wasm.sh` is a raw script**: not yet wired into npm scripts or CI (open roadmap item); call it directly.

## Documentation checklist

When changing user-facing behavior, update as applicable: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md` (Unreleased), `docs/INDICATORS.md` (indicator changes), `docs/DEPLOYMENT.md` (deploy behavior).

## Gotchas

- `npm run build` prints a `TOLERATED_TRANSFORM` note about top-level await in wasm glue — pre-existing, not an error; postbuild still verifies the Sites artifact.
- Homebrew `rustc` can shadow the rustup toolchain that has the wasm32 std — the build/check scripts prepend the rustup bin dir to PATH for this reason; call them rather than raw `cargo build`.
- `check-wasm.sh` gates `rust/` only; `ui/` is not clippy/fmt-gated and emits pre-existing dead-code warnings.

## Definition of Done

1. `npm run lint` clean (0 warnings)
2. `npm run type-check` clean
3. `npm test` green; new behavior covered by a test
4. `npm run build` + postbuild Sites verify pass
5. `npm run wasm:check` green after `rust/` edits; bundles regenerated after `rust/`/`ui/` edits
6. Docs updated per the checklist above

## Contribution guardrails

- `main` is protected: prefer branch + PR; the PR template requires lint/type-check/test/build plus screenshots for UI changes
- Disclose AI assistance in PR descriptions; no AI attribution inside commit trailers unless the user asks

## PR instructions

- One logical change per PR; title reflects the goal
- Fill every section of `.github/PULL_REQUEST_TEMPLATE.md`; UI changes need a screenshot/recording
- Wait for CI green before requesting review

<!-- AGENTS-GENERATED-END -->
