# Lightweight-Charts Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom D3 Canvas chart with TradingView lightweight-charts v5, fixing the symbol-switch glitch and deleting ~900 LOC, with the depth heatmap extracted to a synced strip.

**Architecture:** Only the render layer changes. `ChartContainer` becomes the single `useChartDataFeed` call site and passes candles/heatmap down to a presentational `TerminalChart` (lightweight-charts) and a `HeatmapStrip` canvas. Pure mapping/theme modules sit between the feed and the library and carry the unit tests.

**Tech Stack:** React 19, TypeScript strict, lightweight-charts ^5, Vitest + happy-dom, Zustand (unchanged).

**Spec:** `docs/superpowers/specs/2026-08-22-lightweight-charts-phase1-design.md`

## Global Constraints

- TypeScript strict; `npm run lint` allows zero warnings; 4-space indent, single quotes (match existing files).
- Node 22.x, npm 10. Only new dependency: `lightweight-charts@^5`. `d3` and `@types/d3` are removed before the final commit.
- Coverage floors (lines 26 / functions 25 / branches 17 / statements 25) must stay green; new pure modules must be fully unit-tested. `TerminalChart`/`HeatmapStrip` are canvas-bound and verified manually (happy-dom has no 2D canvas) — do not add jsdom tests for them.
- Feed/store layer (`useChartDataFeed.ts`, `chartDataStore.ts`, `useBinanceWebSocket.ts`) must not change.
- lightweight-charts v5 API only: `chart.addSeries(CandlestickSeries | HistogramSeries | LineSeries, options, paneIndex?)`. No v4 `addCandlestickSeries`-style calls.
- Candle times are seconds (floats from the feed); convert with `Math.floor` to whole-second `UTCTimestamp` at the mapping boundary.
- Branch: `feat/lightweight-charts`. Commit after every task.

---

### Task 1: Install lightweight-charts

**Files:**
- Modify: `package.json` (via npm), `package-lock.json`

**Interfaces:**
- Produces: `lightweight-charts` ^5 available for imports in later tasks.

- [ ] **Step 1: Install and pin**

```bash
npm install lightweight-charts@^5
node -e "console.log(require('lightweight-charts/package.json').version)"
```

Expected: prints `5.x.x`.

- [ ] **Step 2: Verify tree still type-checks**

Run: `npm run type-check`
Expected: PASS (nothing imports the library yet; d3 untouched).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add lightweight-charts v5 dependency"
```

---

### Task 2: Chart data-mapping module (TDD)

**Files:**
- Create: `src/utils/chartDataMapping.ts`
- Test: `src/tests/utils/chartDataMapping.test.ts`

**Interfaces:**
- Consumes: `OHLCV` from `@/types/common` (`{ time: number; open; high; low; close; volume }`, time in seconds).
- Produces (used by Tasks 4–5):
  - `toCandlestickData(candles: readonly OHLCV[]): CandlestickData<UTCTimestamp>[]`
  - `toVolumeHistogramData(candles: readonly OHLCV[], colors?: { up: string; down: string }): HistogramData<UTCTimestamp>[]`
  - `toLineData(points: readonly { time: number; value: number }[]): LineData<UTCTimestamp>[]`
  - `type ChartAction = { type: 'update'; candle: CandlestickData<UTCTimestamp>; volume: HistogramData<UTCTimestamp> } | { type: 'reload' }`
  - `nextChartAction(previous: readonly OHLCV[], next: readonly OHLCV[]): ChartAction`

- [ ] **Step 1: Write the failing tests**

```ts
// src/tests/utils/chartDataMapping.test.ts
import { describe, expect, it } from 'vitest';
import type { OHLCV } from '@/types/common';
import {
    nextChartAction,
    toCandlestickData,
    toLineData,
    toVolumeHistogramData,
} from '@/utils/chartDataMapping';

const candle = (time: number, close: number, open = close - 1): OHLCV => ({
    time,
    open,
    high: close + 2,
    low: open - 2,
    close,
    volume: 10 + close,
});

describe('toCandlestickData', () => {
    it('maps OHLCV rows to whole-second candlestick data', () => {
        const rows = [candle(1700000000.5, 100)];
        const result = toCandlestickData(rows);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ time: 1700000000, open: 99, high: 102, low: 97, close: 100 });
    });

    it('drops rows with non-finite fields', () => {
        const rows = [candle(1, 100), { time: 2, open: NaN, high: 3, low: 1, close: 2, volume: 5 }];
        expect(toCandlestickData(rows)).toHaveLength(1);
    });
});

describe('toVolumeHistogramData', () => {
    it('colors by candle direction and floors the timestamp', () => {
        const rows = [candle(1700000000.9, 100), candle(1700000060, 90)];
        const result = toVolumeHistogramData(rows);
        expect(result[0]!.color).toBe('#22c55e');
        expect(result[1]!.color).toBe('#ef4444');
        expect(result[0]!.time).toBe(1700000000);
        expect(result[1]!.value).toBe(100);
    });

    it('accepts custom colors', () => {
        const result = toVolumeHistogramData([candle(1, 100)], { up: '#aaa', down: '#bbb' });
        expect(result[0]!.color).toBe('#aaa');
    });
});

describe('toLineData', () => {
    it('maps points and drops non-finite values', () => {
        const result = toLineData([
            { time: 1700000000.5, value: 1 },
            { time: 1700000060, value: NaN },
            { time: 1700000120, value: 3 },
        ]);
        expect(result).toEqual([
            { time: 1700000000, value: 1 },
            { time: 1700000120, value: 3 },
        ]);
    });
});

describe('nextChartAction', () => {
    it('returns reload when either side is empty', () => {
        expect(nextChartAction([], [candle(1, 100)])).toEqual({ type: 'reload' });
        expect(nextChartAction([candle(1, 100)], [])).toEqual({ type: 'reload' });
    });

    it('returns update when only the last candle changed in place', () => {
        const previous = [candle(1, 100), candle(60, 200)];
        const next = [candle(1, 100), candle(60, 210)];
        const action = nextChartAction(previous, next);
        expect(action.type).toBe('update');
        if (action.type === 'update') {
            expect(action.candle.close).toBe(210);
            expect(action.volume.value).toBe(220);
        }
    });

    it('returns update when exactly one candle is appended', () => {
        const previous = [candle(1, 100)];
        const next = [candle(1, 100), candle(60, 200)];
        expect(nextChartAction(previous, next).type).toBe('update');
    });

    it('returns reload when history is reshaped (different symbol or backfill)', () => {
        const previous = [candle(1, 100), candle(60, 200), candle(120, 300)];
        const next = [candle(500, 100), candle(560, 200), candle(620, 300)];
        expect(nextChartAction(previous, next).type).toBe('reload');
    });

    it('returns reload when the series shrinks', () => {
        const previous = [candle(1, 100), candle(60, 200), candle(120, 300)];
        expect(nextChartAction(previous, [candle(120, 300)])).toEqual({ type: 'reload' });
    });

    it('returns reload when an interior candle changes', () => {
        const previous = [candle(1, 100), candle(60, 200)];
        const next = [candle(1, 150), candle(60, 200)];
        expect(nextChartAction(previous, next).type).toBe('reload');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/utils/chartDataMapping.test.ts`
Expected: FAIL — cannot resolve `@/utils/chartDataMapping`.

- [ ] **Step 3: Implement the module**

```ts
// src/utils/chartDataMapping.ts
import type {
    CandlestickData,
    HistogramData,
    LineData,
    UTCTimestamp,
} from 'lightweight-charts';
import type { OHLCV } from '@/types/common';

export interface VolumeColors {
    up: string;
    down: string;
}

const DEFAULT_VOLUME_COLORS: VolumeColors = { up: '#22c55e', down: '#ef4444' };

const toUnixSecond = (time: number): UTCTimestamp => Math.floor(time) as UTCTimestamp;

const isFiniteRow = (row: OHLCV): boolean =>
    [row.time, row.open, row.high, row.low, row.close, row.volume].every((value) =>
        Number.isFinite(value),
    );

export const toCandlestickData = (candles: readonly OHLCV[]): CandlestickData<UTCTimestamp>[] =>
    candles.filter(isFiniteRow).map((row) => ({
        time: toUnixSecond(row.time),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
    }));

export const toVolumeHistogramData = (
    candles: readonly OHLCV[],
    colors: VolumeColors = DEFAULT_VOLUME_COLORS,
): HistogramData<UTCTimestamp>[] =>
    candles.filter(isFiniteRow).map((row) => ({
        time: toUnixSecond(row.time),
        value: row.volume,
        color: row.close >= row.open ? colors.up : colors.down,
    }));

export const toLineData = (
    points: readonly { time: number; value: number }[],
): LineData<UTCTimestamp>[] =>
    points
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
        .map((point) => ({ time: toUnixSecond(point.time), value: point.value }));

export type ChartAction =
    | {
          type: 'update';
          candle: CandlestickData<UTCTimestamp>;
          volume: HistogramData<UTCTimestamp>;
      }
    | { type: 'reload' };

/**
 * Decides between an incremental series.update() and a full setData() reload.
 * An update is valid only when the previous series is a strict prefix of the
 * next one and at most the trailing candle changed or one candle appended.
 */
export const nextChartAction = (
    previous: readonly OHLCV[],
    next: readonly OHLCV[],
): ChartAction => {
    if (previous.length === 0 || next.length === 0) return { type: 'reload' };

    const shared = Math.min(previous.length, next.length);
    let prefix = 0;
    while (prefix < shared && previous[prefix]!.time === next[prefix]!.time) prefix += 1;

    if (prefix < shared) return { type: 'reload' };

    if (next.length === previous.length) {
        if (prefix !== previous.length - 1) return { type: 'reload' };
    } else if (next.length === previous.length + 1) {
        if (prefix !== previous.length) return { type: 'reload' };
    } else {
        return { type: 'reload' };
    }

    const last = next[next.length - 1]!;
    if (!isFiniteRow(last)) return { type: 'reload' };

    return {
        type: 'update',
        candle: toCandlestickData([last])[0]!,
        volume: toVolumeHistogramData([last])[0]!,
    };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/utils/chartDataMapping.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/utils/chartDataMapping.ts src/tests/utils/chartDataMapping.test.ts
git commit -m "feat: pure chart data mapping with update/reload diffing"
```

---

### Task 3: Chart theme resolver (TDD)

**Files:**
- Create: `src/features/charts/chartTheme.ts`
- Test: `src/tests/utils/chartTheme.test.ts`

**Interfaces:**
- Produces (used by Task 4): `resolveChartTheme(getVar: (name: string) => string): ChartTheme` where

```ts
export interface ChartTheme {
    background: string;
    textColor: string;
    gridColor: string;
    borderColor: string;
    upColor: string;
    downColor: string;
    crosshairColor: string;
    ema9: string;
    ema21: string;
    macd: string;
    signal: string;
    rsi: string;
}
```

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/utils/chartTheme.test.ts
import { describe, expect, it } from 'vitest';
import { resolveChartTheme } from '@/features/charts/chartTheme';

describe('resolveChartTheme', () => {
    it('uses CSS variable values when present', () => {
        const theme = resolveChartTheme((name) => (name === '--chart-bg' ? '#101010' : ''));
        expect(theme.background).toBe('#101010');
    });

    it('falls back to the terminal palette when variables are missing', () => {
        const theme = resolveChartTheme(() => '');
        expect(theme.background).toBe('#0f172a');
        expect(theme.upColor).toBe('#22c55e');
        expect(theme.downColor).toBe('#ef4444');
        expect(theme.ema9).toBe('#3b82f6');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/utils/chartTheme.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/features/charts/chartTheme.ts
export interface ChartTheme {
    background: string;
    textColor: string;
    gridColor: string;
    borderColor: string;
    upColor: string;
    downColor: string;
    crosshairColor: string;
    ema9: string;
    ema21: string;
    macd: string;
    signal: string;
    rsi: string;
}

const FALLBACK = {
    background: '#0f172a',
    textColor: '#94a3b8',
    gridColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    upColor: '#22c55e',
    downColor: '#ef4444',
    crosshairColor: 'rgba(255, 255, 255, 0.4)',
    ema9: '#3b82f6',
    ema21: '#8b5cf6',
    macd: '#3b82f6',
    signal: '#f59e0b',
    rsi: '#a855f7',
} as const;

export const resolveChartTheme = (getVar: (name: string) => string): ChartTheme => ({
    background: getVar('--chart-bg').trim() || FALLBACK.background,
    textColor: getVar('--text-secondary').trim() || FALLBACK.textColor,
    gridColor: FALLBACK.gridColor,
    borderColor: FALLBACK.borderColor,
    upColor: getVar('--accent-success').trim() || FALLBACK.upColor,
    downColor: getVar('--accent-danger').trim() || FALLBACK.downColor,
    crosshairColor: FALLBACK.crosshairColor,
    ema9: FALLBACK.ema9,
    ema21: FALLBACK.ema21,
    macd: FALLBACK.macd,
    signal: FALLBACK.signal,
    rsi: FALLBACK.rsi,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/utils/chartTheme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/charts/chartTheme.ts src/tests/utils/chartTheme.test.ts
git commit -m "feat: chart theme resolver with terminal palette fallbacks"
```

---

### Task 4: TerminalChart component

**Files:**
- Create: `src/features/charts/TerminalChart.tsx`

**Interfaces:**
- Consumes: mapping module + `ChartTheme` from Tasks 2–3; `calculateEMA`, `calculateMACD`, `calculateRSI` from `@/utils/indicators` (same call shapes the old chart used); `OHLCV` from `@/types/common`.
- Produces (used by Task 5):

```ts
export interface IndicatorToggles {
    ema9: boolean;
    ema21: boolean;
    macd: boolean;
    rsi: boolean;
}

interface TerminalChartProps {
    symbol: string;
    interval: string;
    candles: readonly OHLCV[];
    isLoading: boolean;
    error: string | null;
    indicatorToggles: IndicatorToggles;
    onVisibleRangeChange?: (range: { fromTime: number; toTime: number } | null) => void;
}
```

Note: no unit test for this file (canvas-bound; happy-dom has no 2D context). Correctness gate is type-check, lint, and the Task 7 manual acceptance.

- [ ] **Step 1: Implement the component**

Key requirements (write the full component):
- `createChart(container, { autoSize: true, layout: { background: { type: ColorType.Solid, color: theme.background }, textColor: theme.textColor }, grid, crosshair, rightPriceScale: { borderColor: theme.borderColor }, timeScale: { borderColor: theme.borderColor, timeVisible: true, secondsVisible: false } })`.
- Pane 0: candlestick series; volume histogram with `priceScaleId: 'volume'` and `priceScale.applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })`; EMA9/EMA21 `LineSeries` overlays (`lineWidth: 1`, no price line, `crosshairMarkerVisible: false`, `lastValueVisible: false`, `priceLineVisible: false`).
- RSI pane (`paneIndex: 1`) and MACD pane (`paneIndex: 2`) created lazily on toggle-on via `chart.addSeries(...)`, removed via `chart.removeSeries(...)` on toggle-off. MACD pane = histogram (macd/signal colors by sign, alpha 0.6) + macd line + signal line + 30/70 lines omitted (RSI pane gets `createPriceLine({ price: 30 })`, `70`). After creating a pane: `chart.panes()[index]?.setHeight(90)`.
- Data application: a `useEffect` on `[candles, seriesKey]` where `seriesKey = symbol + ':' + interval`. Keep `previousCandlesRef` and `previousKeyRef`. If key changed or `nextChartAction` returns `reload` → `setData` on candle+volume series, `timeScale.fitContent()` **only** when the key changed (plain history backfill keeps the user's viewport), then set indicator series data. On `update` → `candleSeries.update(action.candle)`, `volumeSeries.update(action.volume)`, and `.update()` the last point of each active EMA line.
- Indicators recompute from `candles` with the same minimum-length guards as before (EMA ≥9/≥21, MACD ≥35, RSI ≥15).
- Visible-range sync: `chart.timeScale().subscribeVisibleLogicalRangeChange(...)` → `range?.from`/`to` are logical indices; map them to times via the candles array (`Math.floor(from)`/`Math.ceil(to)` clamped into `[0, candles.length-1]`, take `.time`), pass `{ fromTime, toTime }` to `onVisibleRangeChange`; pass `null` when candles are empty. Re-subscribe when `candles` identity changes.
- Theme: `resolveChartTheme((name) => getComputedStyle(document.documentElement).getPropertyValue(name))`, re-applied via `chart.applyOptions` + series `applyOptions` when the component re-renders with a changed theme (listen to `document.documentElement` attribute changes via `MutationObserver` on `class`/`data-theme` if ThemeProvider toggles a class — check `src/ui/ThemeProvider.tsx` for the mechanism and match it).
- Empty state: when `candles.length === 0`, render the existing message pattern (`error ? 'Chart data unavailable' : isLoading ? 'Loading chart data…' : 'Awaiting live candles…'`) instead of the chart; destroy the chart instance when entering/leaving this state (simplest: early-return branch renders the message div and the chart effect no-ops).
- A11y: wrapper `role="img"` + `aria-label={\`${symbol} ${interval} candlestick chart with ${candles.length} candles\`}`, `tabIndex={0}`, sr-only latest-OHLCV paragraph (reuse the old wording), `.chart-feed-state` LIVE badge fed by a new `isConnected` prop — add `isConnected: boolean` to `TerminalChartProps` (Task 5 passes it from the feed).
- Cleanup: on unmount remove all series, unsubscribe range observer, `chart.remove()`.

- [ ] **Step 2: Type-check and lint**

Run: `npm run type-check && npx eslint src/features/charts/TerminalChart.tsx --max-warnings=0`
Expected: PASS. (Chart will not render anywhere yet — fine.)

- [ ] **Step 3: Commit**

```bash
git add src/features/charts/TerminalChart.tsx
git commit -m "feat: TerminalChart on lightweight-charts v5 with native indicator panes"
```

---

### Task 5: HeatmapStrip + ChartContainer rewrite + toolbar CSS

**Files:**
- Create: `src/features/charts/HeatmapStrip.tsx`
- Rewrite: `src/features/charts/ChartContainer.tsx`
- Modify: `src/styles/global.css` (append toolbar/strip classes near the `.chart-feed-state` block, ~line 1062)

**Interfaces:**
- Consumes: `TerminalChart` (Task 4), `useChartDataFeed` (unchanged), `useOrderBookHistoryStore` + `buildHeatmap` (unchanged), `HeatmapAggregationResult` from `@/utils/heatmap`, `provenanceRegistry` (unchanged badge polling).
- Produces:

```ts
// HeatmapStrip.tsx
interface HeatmapStripProps {
    heatmap: HeatmapAggregationResult | null;
    visibleRange: { fromTime: number; toTime: number } | null;
    height?: number; // default 72
}
```

- [ ] **Step 1: Implement HeatmapStrip**

- Own `<canvas>`; `useEffect` draws whenever `heatmap`, `visibleRange`, or size change (ResizeObserver on the wrapper, DPR-scaled like the old renderer: `canvas.width = w * devicePixelRatio`, `ctx.scale(dpr, dpr)`).
- X position: cells map linearly across the strip by time within `visibleRange` (`x = W * (cell.time - fromTime) / max(1, toTime - fromTime)`); cells outside the range are skipped; when `visibleRange` is null, spread all cells evenly across the width in time order.
- Y position: price bins map within `[minPrice, maxPrice]` across all cells (inverted, price up = top). Intensity = `size / max(maxBidSize, maxAskSize)`, bid cells `rgba(34,197,94,a*0.55)`, ask cells `rgba(239,68,68,a*0.55)`.
- Empty state: clear canvas, draw nothing (strip keeps its height; a `HeatmapStrip` with no cells renders a subtle "depth heatmap warming up" centered label in `--text-secondary` 10px mono).

- [ ] **Step 2: Rewrite ChartContainer**

Structure (single `useChartDataFeed` call site — this is what keeps one WS subscription):

```tsx
const [interval, setInterval] = useState('1m');
const [indicatorToggles, setIndicatorToggles] = useState<IndicatorToggles>({ ema9: true, ema21: false, macd: false, rsi: false });
const [showHeatmap, setShowHeatmap] = useState(true);
const [visibleRange, setVisibleRange] = useState<{ fromTime: number; toTime: number } | null>(null);

const feed = useChartDataFeed(symbol, interval, { heatmapEnabled: showHeatmap });
```

- Keep the existing `provenanceRegistry` polling effect and `DataQualityBadge` exactly as-is.
- Layout: outer div (100% height, `var(--chart-bg)`) → `TerminalChart` (flex: 1, min-height 0) → `HeatmapStrip` (fixed 72px, hidden when `!showHeatmap`) → absolutely-positioned `.chart-toolbar` on top (same spot as today).
- Toolbar buttons get classes (`.chart-tool-btn`, `.chart-tool-btn.is-active`) instead of inline style objects; behavior (interval set, indicator toggle, heatmap toggle) identical, labels identical.
- Pass `feed.candles`, `feed.isLoading`, `feed.error`, `feed.isConnected`, `indicatorToggles`, `onVisibleRangeChange={setVisibleRange}` to `TerminalChart`; pass `feed.heatmap` + `visibleRange` to `HeatmapStrip`.

- [ ] **Step 3: Add CSS**

Append to `global.css` after the `.chart-feed-state` rules:

```css
.chart-toolbar {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    z-index: 20;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
}

.chart-toolbar__group {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(51, 255, 0, 0.2);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.chart-tool-btn {
    padding: 4px 10px;
    background: transparent;
    border: none;
    border-radius: 2px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}

.chart-tool-btn:hover {
    background: rgba(51, 255, 0, 0.1);
    color: var(--text-primary);
}

.chart-tool-btn.is-active {
    background: var(--accent-primary);
    color: #000;
    font-weight: 600;
}

.chart-heatmap-strip {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
}
```

(If `--accent-primary`/`--font-mono`/`--text-primary` differ in this codebase's token names, grep `global.css` for the real names and use those — verify before committing.)

- [ ] **Step 4: Wire into the app and verify in dev**

Run: `npm run dev`, open http://localhost:3000.
Expected: chart renders candles + volume; EMA9 on by default; toggles create/remove RSI and MACD panes; heatmap strip appears below the chart and tracks pan/zoom; symbol switching (BTC→SOL→BTC) autoscales cleanly with no foreign-price frames; LIVE badge behaves.

- [ ] **Step 5: Lint, types, tests**

Run: `npm run lint && npm run type-check && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/charts/HeatmapStrip.tsx src/features/charts/ChartContainer.tsx src/styles/global.css
git commit -m "feat: heatmap strip + slim ChartContainer wiring TerminalChart"
```

---

### Task 6: Delete CustomChart, drop d3, update docs

**Files:**
- Delete: `src/features/charts/CustomChart.tsx`
- Modify: `package.json` (remove `d3`, `@types/d3` via npm), `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`

- [ ] **Step 1: Confirm nothing references the old chart**

Run: `grep -rn "CustomChart" src/ --include='*.ts*'`
Expected: no matches outside `CustomChart.tsx` itself.

- [ ] **Step 2: Delete and uninstall**

```bash
git rm src/features/charts/CustomChart.tsx
npm uninstall d3 @types/d3
```

- [ ] **Step 3: Update docs**
- `README.md`: replace the "Custom Canvas chart…" highlight bullets (lines ~29–31) with lightweight-charts wording (candles/volume/EMA overlays, native RSI/MACD panes, synced depth strip); drop `d3` from any tech mentions.
- `ARCHITECTURE.md`: chart pipeline diagram node `CustomChart` → `TerminalChart`; "D3 scales and Canvas render" → "lightweight-charts v5 series updates"; source-ownership table unchanged otherwise.
- `ROADMAP.md`: mark the "Split the chart renderer…" Next item done with a one-line note (replaced by lightweight-charts swap); leave other items.

- [ ] **Step 4: Full gate**

Run: `npm run check`
Expected: PASS (lint, types, tests + coverage floors, engine CTest gate, build). Fix any fallout before committing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat!: replace custom D3 canvas chart with lightweight-charts v5"
```

---

### Task 7: Manual acceptance + merge prep

- [ ] **Step 1: Dev-server acceptance run** — `npm run dev`; walk the spec's acceptance list: BTC→SOL→BTC switching (the original bug), each interval, each indicator toggle on/off, heatmap toggle, light + dark themes, disconnect behavior (throttle network, expect RECONNECTING badge and recovery).
- [ ] **Step 2: Production build smoke** — `npm run build && npm run preview`; confirm the chart works on the production bundle.
- [ ] **Step 3: Commit any stragglers, summarize diff stats** (`git diff --stat main...HEAD`) and report. PR/merge only on user instruction.
