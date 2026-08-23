# Strategy Lab v2 — Real Historical Data Design

**Date:** 2026-08-22
**Status:** Approved direction (user): real free data, strictly no generated fluff, C++ engine improved in lockstep.
**Phase:** 3 of the 2026-08-22 quant.term rehaul.

## Problem

Strategy Lab replays exactly one bundled synthetic BTC/USDT 1m fixture. It validates engine
execution and accounting, but produces no evidence about real markets. The ROADMAP "Next" items
this design implements:

- "Add a historical Binance adapter that preserves decimal strings, close times, and closed-candle state"
- "Add language-independent request/result fixtures for byte-stable browser/native parity"

## Goals

1. Replay the existing SMA long/flat strategy against **real Binance Spot klines**: user-chosen
   symbol, interval, and lookback range.
2. Every dataset carries explicit provenance: source, symbol, interval, candle count, time span,
   fetch timestamp, FNV-1a checksum, and a gap report. No silent data massaging.
3. The engine becomes **interval-aware**: Sharpe annualization derives from the dataset's bar
   seconds instead of a hardcoded 1-minute year.
4. The C++20 core, JSON schema, and TypeScript reference move **in lockstep** under the versioned
   `backtest-v1` contract.

## Non-goals (this phase)

- No shorting, funding, or margin modeling (gated behind long-only validation, per ROADMAP).
- No multi-strategy framework, parameter sweeps, or walk-forward.
- No persistence of fetched datasets beyond the session (in-memory only).
- No new dependencies.

## Design

### 1. Contract evolution (`backtest-v1`, additive)

`BacktestDataset` widens in place (schema + TS type + C++ CLI metadata stay aligned):

| Field | Before | After |
|---|---|---|
| `interval` | const `"1m"` | enum of Binance spot intervals (`1m`…`1M`) |
| `source` | const `"SYNTHETIC_FIXTURE"` | enum: `SYNTHETIC_FIXTURE` \| `BINANCE_REST` |
| `symbol` | const `"BTCUSDT"` | string, `^[A-Z0-9]{5,20}$` |
| `intervalSeconds` | — | **added**, integer ≥ 60 (drives Sharpe annualization) |
| `fetchedAt` | — | **added**, epoch ms; `0` for the bundled synthetic fixture |

`contractVersion` remains `backtest-v1` (additive change; both engines ship together).

### 2. Interval-aware engine

- `runSmaCrossBacktest(candles, dataset, config)` keeps its signature; annualization now uses
  `dataset.intervalSeconds`: `barsPerYear = 31_536_000 / intervalSeconds`.
- The bundled synthetic fixture sets `intervalSeconds: 60` → **existing golden values unchanged**
  (TS test and C++ `expect_near` values stay byte-identical).
- Diagnostics warnings become dataset-aware: synthetic keeps the current warning text; Binance
  datasets get a real-data caveat (listed-pair survivorship, exchange outage gaps).

### 3. Historical kline adapter — `src/integrations/binance/klines.ts`

Pure, framework-free, fully unit-tested:

- `fetchKlinesPage({ symbol, interval, startTime?, endTime?, limit }, signal)` → one
  `/api/v3/klines` call against `BINANCE_REST_URL`. Parses **decimal strings** (never floats-from-strings
  lossy paths), keeps open time (ms → s), rejects rows whose close time is in the future
  (unclosed candle), drops malformed rows only when at least one valid row remains.
- `fetchKlinesRange(request, signal)` → pages backward-to-forward (ascending assembly) using
  `startTime` + `limit=1000` until `endTime` or a short page; caps total candles (default 20,000);
  abort- and timeout-aware (8 s per page); returns `{ candles, requests }`.
- `buildDatasetMeta(candles, request, fetchStartedAt)` → `BacktestDataset` with FNV-1a checksum
  (reuses `checksumCandles`), `intervalSeconds` from a shared interval table.
- `detectGaps(candles, intervalSeconds, toleranceSeconds)` → `{ gapCount, longestGapBars, missingBars }`;
  a gap = consecutive-candle delta > interval + tolerance. Missing bars are **reported, never
  interpolated** (no generated fluff).
- `INTERVAL_SECONDS` table shared by adapter, engine tests, and UI.

### 4. Strategy Lab UI

Dataset fieldset becomes a source picker:

- **Validation fixture** (default, unchanged behavior) or **Binance history**.
- Binance form: symbol text (default `BTCUSDT`, validated), interval select (1m/5m/15m/1h/4h/1d),
  lookback select (1d/3d/1w/1m of bars). Fetch button → status line (fetching page N / done /
  error with message). Dataset card then shows real provenance incl. gap report; a run over a
  gappy dataset prepends a warning but is allowed (explicit, not silent).
- AbortController cancelled on unmount/param change; results heading and a11y focus behavior preserved.

### 5. C++20 core (lockstep)

- `BacktestConfig` gains `interval_seconds` (default 60); Sharpe annualization uses it.
- Fixture generator unchanged → 1m golden values unchanged; CTest adds a synthetic 1h case whose
  golden Sharpe differs from the 1m run of identical prices (proves annualization is interval-driven).
- CLI JSON gains `intervalSeconds`/`source`/`fetchedAt` echo in the dataset line (schema-aligned).

### 6. Docs

README (Strategy Lab section), ARCHITECTURE (replay pipeline + dataset table), ROADMAP (tick the
historical-adapter and parity-fixture items) updated in the final task.

## Testing strategy

- TDD throughout; Vitest for adapter/gap/UI-logic, existing suites must stay green.
- Adapter tests use stubbed `fetch` (no network in CI); one optional live smoke test runs only when
  `QUANT_TERM_LIVE_SMOKE=1` is set.
- C++: extend `backtest_test.cpp` with the interval case; `ctest` gate stays mandatory.
- Golden TS↔C++ parity values remain shared and unchanged for the 1m fixture.

## Risks

- **Binance geo/availability:** data-api.binance.vision is the existing, already-used public mirror;
  failures surface as explicit fetch errors with retry, never fabricated data.
- **Schema drift between engines:** both engines change in the same task series; CI runs both suites.
- **Scope creep:** any shorting/funding/multi-strategy request is out of scope by design.
