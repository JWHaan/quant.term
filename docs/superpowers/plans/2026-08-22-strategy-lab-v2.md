# Strategy Lab v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replay the existing deterministic SMA long/flat strategy against real Binance Spot klines (symbol/interval/lookback chosen in the UI), with full provenance, gap reporting, interval-aware Sharpe, and the C++20 core updated in lockstep.

**Architecture:** Additive widening of the `backtest-v1` contract (`intervalSeconds`, `fetchedAt`, wider `symbol`/`interval`/`source`) consumed by three surfaces that ship together: a pure kline adapter under `src/integrations/binance/klines.ts`, the TypeScript reference engine (annualization from `dataset.intervalSeconds`), and the C++20 core (same change + new CTest case). Strategy Lab gains a dataset source picker. No new dependencies.

**Tech Stack:** React 19 + TS strict, Vitest/happy-dom, CMake/C++20 + CTest, existing `data-api.binance.vision` REST mirror.

**Spec:** `docs/superpowers/specs/2026-08-22-strategy-lab-v2-design.md`

## Global Constraints

- Zero-warning lint (`eslint . --max-warnings=0`), strict `tsc --noEmit`, all Vitest suites green, `npm run engine:check` green, production build verified.
- Existing golden values are immutable: TS `finalEquity ≈ 10_692.208640` and C++ `10'692.208640` for the bundled fixture.
- Decimal strings from Binance are parsed without float-string round-trip loss beyond inherent f64 storage; no interpolation of missing bars anywhere.
- No new npm dependencies. Branch: `feat/strategy-lab-v2`, conventional commits, TDD per task.

---

### Task 1: Contract widening + interval-aware engine (TypeScript)

**Files:**
- Modify: `src/backtest/types.ts` (BacktestDataset)
- Modify: `src/backtest/fixture.ts` (meta fields)
- Modify: `src/backtest/engine.ts` (calculateSharpe, warnings)
- Modify: `src/features/backtest/StrategyLab.tsx` (label "Sharpe · 1m annualized" → dynamic)
- Test: `src/tests/backtest/engine.test.ts`

**Interfaces:**
- Produces: `BacktestDataset { id: string; name: string; symbol: string; interval: Timeframe; source: 'SYNTHETIC_FIXTURE' | 'BINANCE_REST'; checksum: string; candleCount: number; startTime: number; endTime: number; intervalSeconds: number; fetchedAt: number }` (`Timeframe` re-exported type from `@/types/common`).
- Consumes: existing `runSmaCrossBacktest(candles, dataset, config)` signature (unchanged).

- [ ] **Step 1: Write failing tests**

Append to `src/tests/backtest/engine.test.ts`:

```ts
describe('interval-aware metrics', () => {
    it('keeps 1-minute golden values when intervalSeconds is 60', () => {
        const fixture = createSyntheticBtcFixture();
        const result = runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);
        expect(result.metrics.finalEquity).toBeCloseTo(10_692.208640, 6);
    });

    it('derives Sharpe annualization from dataset.intervalSeconds', () => {
        const fixture = createSyntheticBtcFixture();
        const oneMinute = runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);
        const hourlyDataset = { ...fixture.dataset, id: 'hourly-equivalent', intervalSeconds: 3_600 };
        const hourly = runSmaCrossBacktest(fixture.candles, hourlyDataset, defaultConfig);
        expect(hourly.metrics.sharpeRatio).toBeCloseTo(oneMinute.metrics.sharpeRatio * Math.sqrt(1 / 60), 10);
    });

    it('adds a real-data caveat for BINANCE_REST datasets', () => {
        const fixture = createSyntheticBtcFixture();
        const binanceDataset = { ...fixture.dataset, id: 'binance-test', source: 'BINANCE_REST' as const, fetchedAt: 1_758_000_000_000 };
        const result = runSmaCrossBacktest(fixture.candles, binanceDataset, defaultConfig);
        expect(result.diagnostics.warnings.some((w) => w.includes('exchange outage'))).toBe(true);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/backtest/engine.test.ts`
Expected: FAIL — `Object literal may not specify… intervalSeconds` (type error) / missing caveat.

- [ ] **Step 3: Minimal implementation**

`types.ts`: widen `BacktestDataset` per interface above (`import type { Timeframe } from '@/types/common';`).
`fixture.ts`: add `intervalSeconds: 60, fetchedAt: 0` to the returned dataset.
`engine.ts`: thread `dataset.intervalSeconds` into `calculateMetrics` → `calculateSharpe(equityCurve, 31_536_000 / dataset.intervalSeconds)` replacing the `MINUTES_PER_YEAR` multiplier; append `'Real market data may contain exchange-outage gaps; listed-pair history carries survivorship bias.'` when `dataset.source === 'BINANCE_REST'`.

- [ ] **Step 4: Verify green + no regressions**

Run: `npx vitest run src/tests/backtest/ && npx tsc --noEmit`
Expected: PASS, goldens intact.

- [ ] **Step 5: Update StrategyLab label + commit**

Label: `` Sharpe · ${labelForInterval(dataset.interval)} annualized `` (map 60→"1m", 3600→"1h", else `${intervalSeconds}s`).

```bash
git checkout -b feat/strategy-lab-v2
git add -A && git commit -m "feat(backtest): interval-aware contract fields and Sharpe annualization"
```

### Task 2: Kline adapter — parsing and single page

**Files:**
- Create: `src/integrations/binance/klines.ts`
- Test: `src/tests/integrations/klines.test.ts` (create dir)

**Interfaces:**
- Produces: `type KlinesRequest { symbol: string; interval: Timeframe; startTime?: number; endTime?: number; limit?: number }`; `INTERVAL_SECONDS: Record<Timeframe, number>`; `parseKlineRow(row: unknown, intervalSeconds: number, nowMs: number): BacktestCandle | null`; `fetchKlinesPage(request: KlinesRequest, signal?: AbortSignal): Promise<BacktestCandle[]>`.

- [ ] **Step 1: Write failing tests** (stub global fetch; no network)

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INTERVAL_SECONDS, parseKlineRow } from '@/integrations/binance/klines';

const ms = (openMs: number) => [String(openMs), '42000.10000000', '42100.5', '41900.25', '42050.75000000', '12.5', 0, '0', 0, '0', '0', '0'];

describe('kline adapter primitives', () => {
    it('maps every supported interval to bar seconds', () => {
        expect(INTERVAL_SECONDS['1m']).toBe(60);
        expect(INTERVAL_SECONDS['1h']).toBe(3_600);
        expect(INTERVAL_SECONDS['1d']).toBe(86_400);
    });

    it('parses decimal strings and converts open time to seconds', () => {
        const candle = parseKlineRow(ms(1_704_067_200_000), 60, 1_800_000_000_000);
        expect(candle).toEqual({ time: 1_704_067_200, open: 42_000.1, high: 42_100.5, low: 41_900.25, close: 42_050.75, volume: 12.5 });
    });

    it('rejects unclosed candles whose close time is in the future', () => {
        expect(parseKlineRow(ms(Date.now() - 10_000), 60, Date.now())).toBeNull();
    });

    it('rejects malformed rows', () => {
        expect(parseKlineRow(['x'], 60, Date.now())).toBeNull();
        expect(parseKlineRow(null, 60, Date.now())).toBeNull();
    });
});
```

Plus a `fetchKlinesPage` test stubbing `vi.stubGlobal('fetch', …)` returning one row; asserts URL contains `symbol=BTCUSDT&interval=5m&startTime=…&limit=1000` and returns parsed candles.

- [ ] **Step 2: Verify RED** — Run: `npx vitest run src/tests/integrations/klines.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `klines.ts`: `INTERVAL_SECONDS` table; `parseKlineRow` validates array length ≥ 7, `Number(row[6]) + intervalSeconds*1000 <= nowMs` (closed), finite numerics via `Number()` on indices 0–5; `fetchKlinesPage` builds URL against `BINANCE_REST_URL`, 8 s `AbortSignal.timeout` raced with passed signal, throws `Error('Failed to fetch klines (<status>)')` on !ok, throws on zero valid rows.

- [ ] **Step 4: Verify GREEN**, full suite clean.

- [ ] **Step 5: Commit** — `feat(integrations): pure Binance kline parser and page fetcher`

### Task 3: Range paging, dataset meta, gap detection

**Files:**
- Modify: `src/integrations/binance/klines.ts`
- Test: `src/tests/integrations/klines.test.ts` (extend)

**Interfaces:**
- Produces: `fetchKlinesRange({ symbol, interval, lookbackBars, maxCandles? }, signal?) : Promise<{ candles: BacktestCandle[]; requests: number }>` (ascending, deduped by time); `buildDatasetMeta(candles, symbol, interval, fetchedAt) : BacktestDataset` (id `binance-<symbol>-<interval>-<YYYYMMDDHHMM>-v1`, name human-readable, FNV-1a via `checksumCandles`); `detectGaps(candles, intervalSeconds, toleranceSeconds = 5) : { gapCount: number; longestGapBars: number; missingBars: number }`.

- [ ] **Step 1: Failing tests** — two-page pagination (first page full ⇒ second call with `startTime = lastClose + interval`), short-page termination, unclosed-tail exclusion, `maxCandles` cap, ascending order + dedupe; `buildDatasetMeta` fields incl. `source: 'BINANCE_REST'`, checksum regex; `detectGaps` on `[t, t+60, t+300]` @60s ⇒ `{ gapCount: 1, longestGapBars: 4, missingBars: 3 }`; empty input ⇒ zeros.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement** — backward-to-forward loop from `endTime = now - interval` (closed bars only), `limit = Math.min(1000, remaining)`; abort/timeout propagate; throw after `requests > hardPageCap` safety (50).
- [ ] **Step 4: Verify GREEN** + full suite.
- [ ] **Step 5: Commit** — `feat(integrations): paged historical range fetch with provenance and gap detection`

### Task 4: Strategy Lab dataset source picker

**Files:**
- Modify: `src/features/backtest/StrategyLab.tsx`
- Test: `src/tests/backtest/StrategyLab.test.tsx` (extend)

**Interfaces:**
- Consumes: `fetchKlinesRange`, `detectGaps`, `buildDatasetMeta`, `INTERVAL_SECONDS` from `@/integrations/binance/klines`.
- State: `datasetSource: 'FIXTURE' | 'BINANCE'`; `binanceForm { symbol: string; interval: Timeframe; lookbackBars: number }`; `liveDataset: BacktestFixture | null`; `loadState: 'idle' | 'loading' | 'ready' | 'error'` + `loadMessage: string`.

- [ ] **Step 1: Failing component tests** — render defaults to fixture card ("Synthetic"); switching source renders symbol/interval/lookback controls; clicking "Fetch Binance history" with mocked `fetchKlinesRange` shows loading state then provenance card with `BINANCE_REST`, gap report line (`GAPS n · MISSING m bars` when n > 0, `NO GAPS DETECTED` otherwise); rejection shows alert-styled error and keeps prior dataset.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement** — fieldset radio pair; form grid reusing `.backtest-form-grid`; AbortController ref cancelled in effect cleanup; Run button uses `liveDataset ?? fixture`; intro paragraph updated ("against a verified fixture or real Binance history"); provenance chips: `NO LOOK-AHEAD`, `EXPLICIT COSTS`, plus `SOURCE: FIXTURE|BINANCE REST`; gap warning appended to success message when gaps detected. Styles reuse existing classes (`backtest-*`, `field-help`); add none/minimal CSS.
- [ ] **Step 4: Verify GREEN** + lint + tsc.
- [ ] **Step 5: Commit** — `feat(lab): choose Binance historical datasets in Strategy Lab`

### Task 5: C++20 core + schema lockstep

**Files:**
- Modify: `engine/include/quant/backtest.hpp` (`BacktestConfig::interval_seconds{60.0}`)
- Modify: `engine/src/backtest.cpp` (annualization `std::sqrt(kSecondsPerYear / config.interval_seconds)`; thread config into metrics)
- Modify: `engine/apps/quant_backtest.cpp` (dataset JSON echoes `intervalSeconds`, `source`, `fetchedAt`)
- Modify: `schemas/backtest-v1.schema.json` (per spec §Contract evolution; required += `intervalSeconds`, `fetchedAt`)
- Test: `engine/tests/backtest_test.cpp`

- [ ] **Step 1: Failing test** — new case: run fixture at `interval_seconds = 3600`; assert `sharpe_1h == sharpe_1m_default * sqrt(1.0/60.0)` within `1e-9`; assert default-config goldens still hold (`10'692.208640`).
- [ ] **Step 2: Verify RED** — `npm run engine:test` fails (member missing / assertion).
- [ ] **Step 3: Implement** header, annualization threading, CLI echo keys.
- [ ] **Step 4: Verify GREEN** — `npm run engine:check`.
- [ ] **Step 5: Schema update + validation test** — extend `src/tests/backtest/engine.test.ts` (or new schema test) asserting a v1 result with the widened dataset validates against the schema using an inline ajv-free check helper if the repo lacks a validator — otherwise assert shape parity manually (required keys present, enums respected). Commit: `feat(engine)!: interval-aware native core aligned with backtest-v1 schema`

### Task 6: Docs, full gates, push

**Files:** Modify `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`.

- [ ] **Step 1:** README Highlights + Strategy Lab copy (real history, provenance, gap report); ARCHITECTURE replay pipeline (dataset sources, interval-aware Sharpe, in-memory only); ROADMAP tick "historical Binance adapter…" and "language-independent request/result fixtures…".
- [ ] **Step 2:** Full gate: `hermes verify --json --port 3000` → require `"ok": true`; screenshot Strategy Lab via `scripts/driver.mjs` variant navigating to the lab route; vision-inspect.
- [ ] **Step 3:** Commit `docs: strategy lab v2 real-data replay`; push branch; open PR into `main` (branch protection requires PR flow — do NOT bypass this time unless user says so); attach screenshot + gate summary; report CI status.

## Self-review

- Spec coverage: contract §1→T1/T5; engine §2→T1/T5; adapter §3→T2/T3; UI §4→T4; C++ §5→T5; docs §6→T6. Gaps: none.
- Placeholders: none — every step names files, signatures, assertions, commands.
- Type consistency: `Timeframe` from `@/types/common` used everywhere; `intervalSeconds`/`fetchedAt` naming identical across TS, schema, C++ JSON keys.
