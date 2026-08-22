# Phase 1 Design: Chart Swap to TradingView Lightweight-Charts

Part of the quant.term phased rehaul (Approach A: polish-first vertical slices).
Phase 1 replaces the custom D3 Canvas chart with `lightweight-charts` v5.

## Problem

The custom D3 Canvas renderer (`src/features/charts/CustomChart.tsx`, ~668 lines +
264 in `ChartContainer.tsx`) carries a hand-rolled zoom model, index-based x-axis,
manual section layout, and per-frame y-refits. Observed defect: after switching
symbols the chart shows wrong prices / appears to "switch between other coins"
(stale zoom transform mapped onto a different series' index space), plus
empty-state remount churn during history loads. ROADMAP.md already flagged this
renderer for decomposition; the user prefers TradingView lightweight-charts over
maintaining a custom implementation.

## Goal

Replace the render layer with lightweight-charts v5, eliminating the bug class,
while keeping the data layer (`useChartDataFeed`, `chartDataStore`,
`useBinanceWebSocket`) untouched. Preserve every user-facing feature: candles,
volume, EMA9/EMA21/MACD/RSI toggles, depth heatmap, timeframe selector, live
updates, themes.

## Non-goals (this phase)

- No workspace/layout restructuring (Phase 2 owns chrome polish).
- No changes to feed/store logic, symbols, intervals, or provider contracts.
- No Strategy Lab work (Phase 3) or hygiene refactor (Phase 4).

## Decisions

1. **Library**: `lightweight-charts` v5 (Apache-2.0). v5 API: unified
   `chart.addSeries(CandlestickSeries | HistogramSeries | LineSeries, options, paneIndex?)`;
   native multi-pane support; `autoSize` handling; built-in DPR-crisp rendering.
   Removes `d3` + `@types/d3` from dependencies entirely.
2. **Indicator placement**: EMA overlays share the main price pane. RSI and MACD
   each get a dedicated native pane (properly synced crosshair/time axis),
   replacing the fragile manual vertical-section layout. Panes are created
   lazily when a toggle switches on and removed when off.
3. **Depth heatmap extraction**: the heatmap leaves the chart canvas and becomes
   a slim synced strip below the chart (own small canvas, ~72px), driven by the
   existing `orderBookHistoryStore` snapshots and `buildHeatmap` aggregation.
   Time alignment uses the chart's visible logical range so the strip tracks
   pan/zoom; crosshair stays synced through a shared `createChartGroup`… fallback:
   if grouping proves brittle, the strip syncs to the visible time window only.
   Hidden via the existing toolbar toggle (capture stops when hidden).
4. **Symbol switching**: no remount hacks. A pure diffing function decides
   between incremental `series.update()` (live tick / bar append) and full
   `setData()` + `fitContent()` (symbol/interval/history change). Fresh
   autoscale on every reload fixes the stale-viewport glitch.
5. **Toolbar**: rebuilt with CSS classes in `global.css` instead of inline style
   objects (full token/polish pass remains Phase 2; this is incidental cleanup in
   a rewritten file).

## Architecture

~~~text
ChartContainer.tsx        (rewritten, slim: state + toolbar + composition)
├── TerminalChart.tsx     (owns createChart, series lifecycle, live updates)
│   └── chartDataMapping.ts (pure: OHLCV[] ↔ lightweight-charts data, diffing)
├── HeatmapStrip.tsx      (canvas strip; consumes heatmap result + visible range)
├── useChartTheme.ts      (CSS-var → chart options; reacts to theme changes)
└── useChartDataFeed.ts   (unchanged)
~~~

- `chartDataMapping.ts` — pure functions, unit-tested:
  - `toCandlestickData(candles)`, `toVolumeHistogramData(candles)`,
    `toLineData(points)` (seconds → whole-second `UTCTimestamp`, non-finite rows dropped)
  - `nextChartAction(prev, next)` → `{type:'update', candle, volume}` or `{type:'reload'}`
- `TerminalChart.tsx` — creates one chart: candle series (pane 0), volume
  histogram overlaid at 80% height (pane 0), EMA line overlays (pane 0), RSI
  pane, MACD pane (histogram + macd/signal lines). Applies
  `nextChartAction` on every `candles` change; indicators follow the same
  update-vs-reload rule tracked per series length.
- Loading/empty/error states render the existing message pattern when the
  selected series has no candles yet.
- Accessibility parity: `role="img"` aria-label with symbol/interval/count,
  sr-only latest-OHLCV summary, keyboard-focusable canvas region preserved.

## Error handling

- Malformed candles are filtered at the mapping boundary (never reach the chart).
- Feed errors/loading surface through the existing `useChartDataFeed` states —
  same UX as today, no new error paths.
- Theme variables missing → hardcoded fallbacks (same palette constants as the
  current renderer).

## Testing

- Unit (Vitest): mapping module — timestamp conversion, row filtering, volume
  coloring, all five `nextChartAction` branches (initial, tick, append,
  reshaped-history, shrink).
- Regression: existing suite + coverage floors stay green after deletions.
- Acceptance (manual, dev server): BTCUSDT → SOLUSDT → back; chart autoscales
  correctly each switch, no foreign-price frames, live ticks continue, toggles
  and heatmap behave, light/dark themes both legible.

## Docs

README highlights/chart bullet, ARCHITECTURE.md chart pipeline diagram and
source-ownership wording, and ROADMAP.md chart-decomposition item updated to
reflect the swap.
