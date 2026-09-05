# Bloomberg-isms Adoption — Design Spec

**Date:** 2026-08-24
**Status:** Approved in chat (Han, 2026-08-24)
**Source research:** OpenBB, FinceptTerminal, Gloomberb, TradeBobbyTerminal, triphopp/bloomberg-terminal, quantumterminal

## Problem

quant.term has Bloomberg-calibre data (order book, liquidations, derivatives, signals) scattered
across tabs and rails, navigated only via ⌘K or mouse, styled generically. The best open-source
terminals concentrate microstructure next to the chart, navigate via an always-visible command
line, present watchlists as dense stacked boards, and hold a strict terminal visual identity.

## Scope

Four features, one theme pass:

1. **Command Line** — always-visible amber command line in `AppHeader`. Mnemonic dispatch over the
   existing command registry (`buildCommands`). ⌘K palette stays.
2. **Microstructure Ribbon** — one dense strip docked under the chart: funding (bps), basis (bps),
   open interest, long/short accounts, last liquidations (compact). Replaces the right-rail
   **Perps** tab. Liquidations deep-view tab stays.
3. **TICK Board** — `MarketGrid` rebuilt in place as collapsible stacked sections:
   **MAJORS** (curated list) · **PERPS** (funding per major from one bulk `premiumIndex` call) ·
   **MOVERS** (top ±5 by 24h change). Search preserved. Row click still selects symbol.
4. **Theme pass** — amber interactive accent on near-black, green/red reserved for up/down,
   tabular numerals, denser rows, bps-unit discipline.

## Non-goals

- No new data sources beyond one bulk Binance `premiumIndex` REST call (already-used host).
- No CVD sparkline in ribbon v1 (would need new aggregation plumbing; the chart already carries
  volume-delta context). Revisit later.
- No layout rearrangement beyond the ribbon slot; no mobile-gate changes; no auth.

## Decisions (approved defaults)

- Command line lives in the header (not footer/palette-only).
- Ribbon docks directly under the chart inside the center column's vertical PanelGroup (~14%,
  resizable), not across the whole workspace.
- Full amber repaint including light-theme coherence; not just density tweaks.
- TICK board replaces Market Watch content in place (no extra tab).

## Architecture

### 1. Command Line (`src/ui/CommandLine.tsx`, new)

- Props: none — reads nothing global; parent passes `commands: Command[]` (the exact array
  `buildCommands` returns) and renders inside `AppHeader`, replacing the current
  `command-trigger` button (⌘K affordance moves into the command line's right edge as a `<kbd>`).
- Internal state: query string, highlighted index. Filter: case-insensitive substring match on
  `mnemonic`, `label`, and `description`.
- Mnemonics added to the registry in `commands.ts`: each command gains an optional
  `mnemonic?: string` field: `MON` open-monitor, `LAB` open-strategy-lab, `MW` focus-market,
  `CHART` focus-chart, `ALPHA` focus-alpha, `NEWS` focus-news, `KEYS` toggle-help,
  `TOP BTC|ETH|SOL` analyze-* (mnemonic prefix `TOP`; argument parsing: `TOP <SYM>` uppercases and
  appends `USDT` if missing, then `setSymbol`). Exact-mnemonic match executes immediately on Enter;
  otherwise Enter runs the highlighted item; Esc clears/blurs.
- Global focus hotkey `` ` `` (Backquote) focuses the input; registered wherever existing global
  shortcuts are registered and listed in `KeyboardShortcutsModal`.
- No new stores; dispatches call the same config callbacks the palette uses.

### 2. Microstructure Ribbon (`src/features/market/MicrostructureRibbon.tsx`, new)

- Extract the fetch/parse cycle of `DerivativesPanel` into a shared hook
  `useDerivativesSnapshot(symbol: string)` returning `{ snapshot, error, refresh }`
  (same `DerivativesSnapshot` type, same 30s cadence, same endpoints). `DerivativesPanel` refactored
  to consume the hook — behavior identical.
- Ribbon layout: horizontal flex strip of labelled cells:
  `FUNDING 8H` (+x.xx bps, tone-colored) · `BASIS` (±x.xx bps vs index) · `OPEN INTEREST`
  (compact volume + asset) · `LONG/SHORT` (mini ratio bar with % labels) · `LIQUIDATIONS`
  (last 3 events, side-colored, from the existing liquidation stream — compact render, no new WS;
  reuse the liquidation integration module used by `LiquidationFeed`).
- Error/loading states collapse to muted cell placeholders (`—`), never blocking the strip.
- `MonitorWorkspace`: insert vertical Panel child (~14%, min 10) between Chart and Market Depth;
  remove the `derivatives` (Perps) entry from `intelligenceTabs`.

### 3. TICK Board (`MarketGrid.tsx` rewrite in place)

- Same WS/seed lifecycle (kept verbatim), same `marketData` map feeding the market store.
- Render becomes three collapsible sections, mono table rows, persisted expand/collapse state in
  `localStorage` key `qt.tickboard.sections`:
  - **MAJORS**: curated `[BTC, ETH, BNB, SOL, XRP, DOGE]` × USDT present in `marketData`;
    columns Symbol · Last · 24H · Vol.
  - **PERPS**: bulk `GET /fapi/v1/premiumIndex` (no symbol param) every 60s; rows for majors'
    futures pairs showing last price (mark) · funding 8h in **bps** tone-colored · next funding
    countdown (mm:ss). Failures degrade the whole section to one muted line.
  - **MOVERS**: top 5 gainers + top 5 losers by 24h % from `marketData`.
- Search input filters within sections; count badge reflects total visible rows. Row click selects
  symbol (unchanged contract `onSelectSymbol?`).

### 4. Theme pass (`global.css` + token consumers)

- New accent ramp on `--accent` family: amber `#ffb020` (interactive) / `#ff9e1b` (hover) /
  dim `#8a6516`; near-black base stays. Green/red remain exclusively directional.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on all metric/table cells; row height
  tightened ~2px in shared terminal table classes.
- Units: `formatBps(value)` helper in `utils/format.ts` (`+12.50 bps`, sign always); adopted by
  ribbon and DerivativesPanel funding display (percent display kept in Strategy Lab contexts only).
- Light theme gets the same amber hue with adjusted contrast values.

## Testing

- Vitest + testing-library, colocated under `src/tests/**` mirroring existing layout.
- New tests: command-line filter/dispatch/hotkeys; mnemonic parsing incl. `TOP <SYM>` normalization;
  ribbon cell rendering from fixture snapshot + degraded states; TICK board section collapse
  persistence, movers partitioning, perps-section degradation; `formatBps`.
- Existing suites must stay green: `npm run test`, `npm run lint`, `npm run check`, build.
- Manual verify: dev server port 3000 (`hermes verify --port 3000`).

## Delivery

Feature branch → PR into `main` (branch protection: 2 required checks). Subagent-driven execution
per approved workflow.
