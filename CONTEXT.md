# Context

Domain vocabulary for quant.term — the shared language used across docs, code, and reviews.
Terms here describe the product's domain, not its implementation.

## Product

- **quant.term** — a browser-native crypto research terminal. Read-only by design: no orders, no custody, no exchange credentials, and no account is ever required for existing functionality.

## Workspaces and surface

- **Monitor** — the live-market workspace: watchlist, candlestick chart, depth/DOM, order-flow, derivatives, news, Bitcoin network intelligence, alerts, and paper trading.
- **Strategy Lab** — the research workspace: deterministic replay of bundled candle fixtures with equity curve, metrics, and a trade ledger.
- **Workspace** — a top-level app mode (Monitor | Strategy Lab). **Panel** — a dockable region inside a workspace.
- **Terminal chrome** — the shared shell: header, workspace tabs, status line, and news ticker.
- **Command palette** — the ⌘K/Ctrl-K overlay. Distinct from the **command line**, the header input that accepts mnemonics such as `top eth`.
- **Mobile gate** — the small-viewport guard that blocks the terminal UI when the dense layout cannot fit; not a substitute for the planned compact layout.

## Market data

- **Depth** — order-book levels (price × quantity). **DOM** — the ladder view of that book.
- **OFI / CVD / VPIN** — order-flow signals: order-flow imbalance, cumulative volume delta, and volume-synchronized probability of informed trading.
- **Degraded provider** — a feed or panel whose upstream source is unreachable. The required behavior is an explicit unavailable/offline surface plus reconnecting backoff — never a fabricated fallback value.

## Simulation

- **Paper trading** — browser-local simulated positions (long/short with leverage and PnL), labeled "Paper" in the UI and explicitly marked "SIMULATED EXECUTION · NO ORDERS ARE SENT". User-driven and live-priced; distinct from replay.
- **Replay** — deterministic backtest execution over fixed candle data with next-bar fills, fees, and slippage. "Deterministic" means identical inputs produce identical outputs in both the Rust/WASM engine and the TypeScript reference.
- **Fixture** — fixed input data for a replay or parity check. **Golden** — the expected output computed from a fixture; regenerated whenever indicator semantics intentionally change.

## Engine and contracts

- **quant-core** — the canonical Rust engine (`rust/`): indicators, order-flow math, replay. Compiled to WASM.
- **quant-ui** — the Leptos frontend crate (`ui/`), compiled to WASM and embedding quant-core.
- **TypeScript reference layer** — `src/`: integration adapters, kept reference implementations used by the parity suite, and the test harness.
- **`backtest-v1`** — the versioned JSON contract for replay requests and results exchanged between UI, engine, and harness. Versioned independently of the app release.
- **Parity** — agreement between the WASM engine and the TypeScript reference on shared inputs. Today: schema and result parity; byte-stable fixture comparison is planned.

## Verification

- **Smoke gate** — the asserting Playwright smoke check (`scripts/smoke.mjs`) run in CI against the preview build; required to pass for the v1.0.0 release.
- **WASM drift gate** — the CI job that rebuilds the committed `src/wasm/` bundles and fails on any diff, keeping them in sync with `rust/` and `ui/` sources.

## Decisions

Resolved design decisions are recorded as ADRs under `docs/adr/`:

- [ADR-0001](docs/adr/0001-macd-standard-signal-semantics.md) — MACD uses textbook signal-line semantics.
- [ADR-0002](docs/adr/0002-no-accounts-boundary.md) — "no accounts" stays the permanent default; opt-in sync is in-bounds.

Release ordering decisions live in `ROADMAP.md` (v1.0.0 gate, then hardening, then expansion).
