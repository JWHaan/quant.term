# Bloomberg-isms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt four proven Bloomberg-terminal concepts into quant.term: header command line with mnemonics, chart-docked microstructure ribbon, collapsible TICK-board watchlist, and an amber terminal theme pass.

**Architecture:** All four features compose existing stores/integrations (marketStore, derivatives REST, liquidation WS, command registry) behind thin new UI layers. One shared data hook (`useDerivativesSnapshot`) is extracted so the ribbon and the existing DerivativesPanel share one fetch cycle. No new dependencies.

**Tech Stack:** React 19 + TypeScript strict, Zustand, react-resizable-panels, Vitest + React Testing Library, lucide-react icons, plain CSS custom properties in `src/styles/global.css`.

**Spec:** `docs/superpowers/specs/2026-08-24-bloomberg-isms-design.md`

## Global Constraints

- TypeScript strict mode; no `any`; no new npm dependencies.
- React function components only; hooks rules apply; icons from lucide-react at size 12–16.
- Follow existing BEM-ish class naming (`block__element--modifier`) used across panels.
- Units discipline: funding/basis rendered via `formatBps` (always-signed, 2 decimals, ` bps` suffix); OI/volume via existing `formatVolume`.
- Green/red classes reserved for directional tone only (`positive`/`negative`); interactive accent is amber.
- Tests colocated under `src/tests/**` mirroring source layout; run with `npm run test` (vitest run).
- Every task ends green on: `npm run lint`, `npm run check`, `npm run test`.
- Do NOT touch anything under `src/backtest/**` or engine code; golden equity fixtures must remain untouched.
- Commit style: conventional prefixes (`feat:`, `refactor:`, `polish:`), one commit per logical step.
- Dev-server verification uses port 3000 (Vite pinned): `npm run dev` then probe `http://localhost:3000`.

---

### Task 1: `formatBps` unit helper

**Files:**
- Modify: `src/utils/format.ts`
- Test: `src/tests/utils/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function formatBps(bps: number): string` — e.g. `formatBps(12.5)` → `"+12.50 bps"`, `formatBps(-0.004)` → `"-0.00 bps"`, `formatBps(0)` → `"+0.00 bps"` (zero counts as positive sign).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { formatBps } from '@/utils/format';

describe('formatBps', () => {
    it('formats positive basis points with explicit sign', () => {
        expect(formatBps(12.5)).toBe('+12.50 bps');
    });

    it('formats negative basis points', () => {
        expect(formatBps(-0.004)).toBe('-0.00 bps');
    });

    it('signs zero as positive', () => {
        expect(formatBps(0)).toBe('+0.00 bps');
    });

    it('rounds to two decimals', () => {
        expect(formatBps(1.005)).toBe('+1.01 bps');
    });
});
```

Note: check whether `src/tests/utils/` already has a format test file; if so, append this describe block to it instead of creating a new file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/utils`
Expected: FAIL — `formatBps` is not exported.

- [ ] **Step 3: Implement**

Append to `src/utils/format.ts`:

```ts
/** Format a value already expressed in basis points with an explicit sign. */
export function formatBps(bps: number): string {
    const sign = bps >= 0 ? '+' : '';
    return `${sign}${bps.toFixed(2)} bps`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/utils`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run check
git add src/utils/format.ts src/tests/utils
git commit -m "feat(ui): add signed basis-point formatter"
```

---

### Task 2: Mnemonic field + `TOP` argument parser in the command registry

**Files:**
- Modify: `src/features/command-palette/commands.ts`
- Test: `src/tests/features/commandMnemonic.test.ts`

**Interfaces:**
- Consumes: existing `Command`, `CommandsConfig`, `buildCommands` (unchanged signatures).
- Produces:
  - `Command` gains optional field `mnemonic?: string`.
  - `export function normalizeSymbolArg(raw: string): string | null` — uppercases, trims, strips optional leading `/`, appends `USDT` when the result matches `/^[A-Z0-9]{2,9}$/`, returns `null` for anything that doesn't end up matching `/^[A-Z0-9]{2,10}(USDT|USD)?$/` after processing. Examples: `"btc"` → `"BTCUSDT"`, `"ethusdt"` → `"ETHUSDT"`, `"wld"` → `"WLDUSDT"`, `"!!"` → `null`.
  - Mnemonic constants used by later tasks (exact strings): `MON`, `LAB`, `MW`, `CHART`, `ALPHA`, `NEWS`, `KEYS`, and prefix `TOP`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildCommands, normalizeSymbolArg, type CommandsConfig } from '@/features/command-palette/commands';

const noop = (): void => undefined;
const cfg: CommandsConfig = {
    setShowHelp: noop,
    setSymbol: noop,
    openMonitor: noop,
    openStrategyLab: noop,
    scrollToMarket: noop,
    scrollToChart: noop,
    scrollToAlpha: noop,
    scrollToNews: noop,
};

describe('normalizeSymbolArg', () => {
    it('appends USDT to bare base symbols', () => {
        expect(normalizeSymbolArg('btc')).toBe('BTCUSDT');
        expect(normalizeSymbolArg(' wld ')).toBe('WLDUSDT');
    });

    it('keeps quoted pairs intact', () => {
        expect(normalizeSymbolArg('ethusdt')).toBe('ETHUSDT');
    });

    it('strips a leading slash', () => {
        expect(normalizeSymbolArg('/sol')).toBe('SOLUSDT');
    });

    it('rejects garbage', () => {
        expect(normalizeSymbolArg('!!')).toBeNull();
        expect(normalizeSymbolArg('')).toBeNull();
    });
});

describe('command mnemonics', () => {
    it('assigns the documented mnemonics', () => {
        const commands = buildCommands(cfg);
        const byId = new Map(commands.map((c) => [c.id, c.mnemonic]));
        expect(byId.get('open-monitor')).toBe('MON');
        expect(byId.get('open-strategy-lab')).toBe('LAB');
        expect(byId.get('focus-market')).toBe('MW');
        expect(byId.get('focus-chart')).toBe('CHART');
        expect(byId.get('focus-alpha')).toBe('ALPHA');
        expect(byId.get('focus-news')).toBe('NEWS');
        expect(byId.get('toggle-help')).toBe('KEYS');
    });

    it('marks analyze-* commands with the TOP prefix', () => {
        const commands = buildCommands(cfg);
        const analyze = commands.filter((c) => c.id.startsWith('analyze-'));
        expect(analyze.length).toBeGreaterThan(0);
        analyze.forEach((c) => expect(c.mnemonic).toBe('TOP'));
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/features/commandMnemonic.test.ts`
Expected: FAIL — no `normalizeSymbolArg` export, no `mnemonic` field.

- [ ] **Step 3: Implement**

In `src/features/command-palette/commands.ts`:

1. Extend the interface:

```ts
export interface Command {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    action: () => void;
    category: string;
    /** Bloomberg-style short code shown in the command line. */
    mnemonic?: string;
}
```

2. Add the parser above `buildCommands`:

```ts
const SYMBOL_PATTERN = /^[A-Z0-9]{2,10}(USDT|USD)?$/;

/** Normalize free text like " btc " or "/sol" into a tradable spot symbol. */
export function normalizeSymbolArg(raw: string): string | null {
    const cleaned = raw.trim().replace(/^\//, '').toUpperCase();
    if (!cleaned) return null;
    const candidate = SYMBOL_PATTERN.test(cleaned)
        ? cleaned
        : `${cleaned}USDT`;
    return SYMBOL_PATTERN.test(candidate) ? candidate : null;
}
```

3. Add `mnemonic` to each existing command object exactly: `open-monitor` → `'MON'`, `open-strategy-lab` → `'LAB'`, `focus-market` → `'MW'`, `focus-chart` → `'CHART'`, `focus-alpha` → `'ALPHA'`, `focus-news` → `'NEWS'`, `toggle-help` → `'KEYS'`, and every `analyze-*` → `'TOP'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/features/commandMnemonic.test.ts`
Expected: PASS.

- [ ] **Step 5: Full gates + commit**

```bash
npm run lint && npm run check && npm run test
git add src/features/command-palette/commands.ts src/tests/features/commandMnemonic.test.ts
git commit -m "feat(commands): Bloomberg-style mnemonics + symbol arg parser"
```

---

### Task 3: Header command line

**Files:**
- Create: `src/ui/CommandLine.tsx`
- Modify: `src/ui/AppHeader.tsx` (replace the `command-trigger` button block, lines ~72–83)
- Modify: `src/app/App.tsx` (pass `commands` into `AppHeader`; register the backquote shortcut)
- Test: `src/tests/ui/commandLine.test.tsx`

**Interfaces:**
- Consumes: `Command[]` from `buildCommands` (Task 2 mnemonics), `normalizeSymbolArg`.
- Produces: `CommandLine` props `{ commands: Command[]; onOpenPalette: () => void }`. The header input carries `id="qt-command-input"` (used by the global backquote shortcut). Dispatch rule implemented as exported pure helper for tests:
  `export function resolveCommandInput(query: string, commands: Command[]): { kind: 'exact'; command: Command } | { kind: 'filtered'; items: Command[] }` — trims query; if a command's `mnemonic` equals the query case-insensitively → exact; if the mnemonic is `TOP` and the query starts with `TOP ` (case-insensitive) → exact on the first `TOP` command (argument handled by caller); otherwise case-insensitive substring filter over `mnemonic ?? ''`, `label`, `description`, keeping registry order.

- [ ] **Step 1: Write the failing tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandLine, resolveCommandInput } from '@/ui/CommandLine';
import type { Command } from '@/features/command-palette/commands';

const makeCommand = (id: string, mnemonic?: string, label = id): Command => ({
    id,
    label,
    description: `desc-${id}`,
    icon: null,
    action: vi.fn(),
    category: 'Test',
    mnemonic,
});

describe('resolveCommandInput', () => {
    const commands = [
        makeCommand('a', 'MON'),
        makeCommand('b', 'TOP'),
        makeCommand('c'),
    ];

    it('matches an exact mnemonic', () => {
        const result = resolveCommandInput('mon', commands);
        expect(result).toEqual({ kind: 'exact', command: commands[0] });
    });

    it('routes "TOP <arg>" to the TOP command', () => {
        const result = resolveCommandInput('top btc', commands);
        expect(result).toEqual({ kind: 'exact', command: commands[1] });
    });

    it('filters by label substring otherwise', () => {
        const result = resolveCommandInput('des', commands);
        expect(result).toEqual({ kind: 'filtered', items: commands });
    });
});

describe('CommandLine', () => {
    it('dispatches the highlighted command on Enter and clears', () => {
        const action = vi.fn();
        const commands = [makeCommand('monitor', 'MON', 'Open Market Monitor'), { ...makeCommand('lab', 'LAB'), action }];
        const onOpenPalette = vi.fn();
        render(<CommandLine commands={commands} onOpenPalette={onOpenPalette} />);
        const input = screen.getByLabelText('Command line');
        fireEvent.change(input, { target: { value: 'LAB' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(action).toHaveBeenCalledTimes(1);
        expect((input as HTMLInputElement).value).toBe('');
    });

    it('parses TOP arguments into a symbol switch', () => {
        const setSymbol = vi.fn();
        const topCommand: Command = {
            ...makeCommand('analyze', 'TOP', 'Switch symbol'),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            action: (() => {}) as unknown as () => void,
        };
        render(
            <CommandLine
                commands={[topCommand]}
                onOpenPalette={vi.fn()}
                onSymbolArg={setSymbol}
            />,
        );
        const input = screen.getByLabelText('Command line');
        fireEvent.change(input, { target: { value: 'top eth' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(setSymbol).toHaveBeenCalledWith('ETHUSDT');
    });

    it('Escape clears the query then blurs', () => {
        render(<CommandLine commands={[makeCommand('a', 'MON')]} onOpenPalette={vi.fn()} />);
        const input = screen.getByLabelText('Command line') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'mo' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(input.value).toBe('');
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(document.activeElement).not.toBe(input);
    });

    it('shows a no-match hint instead of executing garbage', () => {
        render(<CommandLine commands={[makeCommand('a', 'MON')]} onOpenPalette={vi.fn()} />);
        const input = screen.getByLabelText('Command line');
        fireEvent.change(input, { target: { value: 'zzz' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByText(/no match/i)).toBeInTheDocument();
    });
});
```

Note: adapt assertion details to testing-library idioms the repo already uses (see any `*.test.tsx` under `src/tests` for provider/wrapper conventions); the behavioral contracts above are binding.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/ui/commandLine.test.tsx`
Expected: FAIL — module `@/ui/CommandLine` does not exist.

- [ ] **Step 3: Implement `CommandLine.tsx`**

```tsx
import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { normalizeSymbolArg, type Command } from '@/features/command-palette/commands';

type Resolved =
    | { kind: 'exact'; command: Command }
    | { kind: 'filtered'; items: Command[] };

export function resolveCommandInput(query: string, commands: Command[]): Resolved {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith('top ') || lower === 'top') {
        const top = commands.find((c) => c.mnemonic?.toUpperCase() === 'TOP');
        if (top) return { kind: 'exact', command: top };
    }

    const exact = commands.find((c) => c.mnemonic?.toLowerCase() === lower);
    if (exact) return { kind: 'exact', command: exact };

    const items = commands.filter((c) =>
        c.label.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower) ||
        (c.mnemonic ?? '').toLowerCase().includes(lower),
    );
    return { kind: 'filtered', items };
}

interface CommandLineProps {
    commands: Command[];
    onOpenPalette: () => void;
    /** When provided, "TOP <sym>" routes here instead of the command action. */
    onSymbolArg?: (symbol: string) => void;
}

/**
 * Bloomberg-style always-visible command line.
 * Exact mnemonics execute directly; other queries filter the command registry.
 */
const CommandLine: React.FC<CommandLineProps> = ({ commands, onOpenPalette, onSymbolArg }) => {
    const [query, setQuery] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const resolved = useMemo(() => resolveCommandInput(query, commands), [query, commands]);
    const items = resolved.kind === 'filtered'
        ? resolved.items
        : resolved.command
            ? [resolved.command]
            : [];
    const safeIndex = Math.min(highlightIndex, Math.max(items.length - 1, 0));

    const execute = (command: Command) => {
        const lower = query.trim().toLowerCase();
        if (onSymbolArg && command.mnemonic?.toUpperCase() === 'TOP' && lower.startsWith('top')) {
            const arg = query.trim().slice(lower.startsWith('top ') ? 4 : 3);
            const symbol = normalizeSymbolArg(arg);
            if (symbol) {
                onSymbolArg(symbol);
                setQuery('');
                setHighlightIndex(0);
                inputRef.current?.blur();
                return;
            }
            setQuery('Bad symbol');
            return;
        }
        command.action();
        setQuery('');
        setHighlightIndex(0);
        inputRef.current?.blur();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
            case 'Enter': {
                event.preventDefault();
                if (resolved.kind === 'exact') {
                    execute(resolved.command);
                } else if (items[safeIndex]) {
                    execute(items[safeIndex]);
                } else if (query.trim()) {
                    setQuery(`No match: ${query.trim()}`);
                }
                break;
            }
            case 'ArrowDown':
                event.preventDefault();
                setHighlightIndex((i) => Math.min(i + 1, items.length - 1));
                break;
            case 'ArrowUp':
                event.preventDefault();
                setHighlightIndex((i) => Math.max(i - 1, 0));
                break;
            case 'Escape':
                event.preventDefault();
                if (query) {
                    setQuery('');
                    setHighlightIndex(0);
                } else {
                    inputRef.current?.blur();
                }
                break;
        }
    };

    return (
        <div className="command-line" role="search">
            <Search size={13} aria-hidden="true" />
            <label className="visually-hidden" htmlFor="qt-command-input">Command line</label>
            <input
                id="qt-command-input"
                ref={inputRef}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Command… e.g. TOP BTC, LAB, NEWS"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlightIndex(0);
                }}
                onKeyDown={handleKeyDown}
                aria-expanded={items.length > 0 && query.trim().length > 0}
                aria-controls="command-line-results"
            />
            {query.trim() && resolved.kind === 'filtered' && items.length > 0 && (
                <ul id="command-line-results" className="command-line__results" role="listbox">
                    {items.slice(0, 7).map((item, index) => (
                        <li key={item.id} role="option" aria-selected={index === safeIndex}>
                            <button
                                type="button"
                                className={`command-line__option${index === safeIndex ? ' is-active' : ''}`}
                                onMouseEnter={() => setHighlightIndex(index)}
                                onClick={() => execute(item)}
                            >
                                {item.mnemonic && <kbd>{item.mnemonic}</kbd>}
                                <span>{item.label}</span>
                                <ChevronRight size={12} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                className="command-line__palette-trigger"
                onClick={onOpenPalette}
                aria-label="Open command palette"
                title="Command palette (⌘K)"
            >
                <kbd>⌘K</kbd>
            </button>
        </div>
    );
};

export default CommandLine;
```

- [ ] **Step 4: Wire into `AppHeader` and `App.tsx`**

In `src/ui/AppHeader.tsx`:
- Replace prop `onOpenCommandPalette: () => void` with `commands: Command[]; onOpenCommandPalette: () => void;` (import `Command` type from `@/features/command-palette/commands`).
- Replace the entire `<button className="command-trigger">…</button>` block with `<CommandLine commands={commands} onOpenPalette={onOpenCommandPalette} />`.

In `src/app/App.tsx`:
- Pass `commands={commands}` to `<AppHeader … />`.
- In the `useKeyboardShortcuts` array add:

```ts
{
    key: '`',
    description: 'Focus command line',
    action: () => document.getElementById('qt-command-input')?.focus(),
    category: 'actions',
},
```

(The modal listing updates automatically because it renders from this same array.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/tests/ui/commandLine.test.tsx`
Expected: PASS.

- [ ] **Step 6: Full gates + manual smoke + commit**

```bash
npm run lint && npm run check && npm run test
npm run dev  # probe http://localhost:3000 — header shows amber command line; `, MON, TOP BTC work
git add src/ui/CommandLine.tsx src/ui/AppHeader.tsx src/app/App.tsx src/tests/ui/commandLine.test.tsx
git commit -m "feat(ui): Bloomberg-style header command line"
```

---

### Task 4: `useDerivativesSnapshot` hook + DerivativesPanel refactor

**Files:**
- Create: `src/hooks/useDerivativesSnapshot.ts`
- Modify: `src/features/market/DerivativesPanel.tsx` (consume the hook; switch funding display to `formatBps`)
- Test: `src/tests/hooks/useDerivativesSnapshot.test.ts`

**Interfaces:**
- Consumes: `getBinanceFuturesContract(symbol)`, `parseDerivativesSnapshot(...)`, `BINANCE_FUTURES_REST_URL` — all existing exports.
- Produces:
  ```ts
  export interface DerivativesSnapshotState {
      snapshot: DerivativesSnapshot | null;
      error: string | null;
      isLoading: boolean;
      refresh: () => void;
  }
  export function useDerivativesSnapshot(spotSymbol: string): DerivativesSnapshotState
  ```
  Semantics (moved verbatim from today's DerivativesPanel): 30s auto-refresh interval; 8s fetch timeout; endpoints `/fapi/v1/premiumIndex?symbol=<futures>`, `/fapi/v1/openInterest?symbol=<futures>`, `/futures/data/globalLongShortAccountRatio?symbol=<futures>&period=5m&limit=1`; state keyed by `contract.spotSymbol` so late responses for old symbols are dropped.

- [ ] **Step 1: Write the failing tests**

Mock `@/integrations/binance/contracts`' `getBinanceFuturesContract` to return `{ spotSymbol: 'BTCUSDT', futuresSymbol: 'BTCUSDT', multiplier: 1 }` and stub `global.fetch` resolving JSON payloads:

```ts
const premium = { markPrice: '100.5', indexPrice: '100.0', lastFundingRate: '0.0001', nextFundingTime: Date.now() + 60_000 };
const interest = { openInterest: '123.45' };
const ratios = [{ longAccount: '0.6', shortAccount: '0.4' }];
```

Cases:
1. resolves and exposes snapshot fields (markPrice 100.5, longAccount 0.6) with `error === null`;
2. surfaces error message when fetch rejects (`isLoading` false, `error` contains thrown message);
3. `refresh()` triggers a new fetch round (fetch call count increases);
4. unmount clears the 30s interval (use `vi.useFakeTimers()`; advance 31s after unmount → fetch count unchanged beyond prior rounds).

Use `renderHook` from `@testing-library/react`. Mirror fake-timer conventions already used in `src/tests/services` or `src/tests/hooks` if present.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/hooks/useDerivativesSnapshot.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the hook**

Move the body of the two effects in `DerivativesPanel` into:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { BINANCE_FUTURES_REST_URL } from '@/constants/config';
import {
    parseDerivativesSnapshot,
    type DerivativesSnapshot,
} from '@/integrations/binance/derivatives';
import { getBinanceFuturesContract } from '@/integrations/binance/contracts';

export interface DerivativesSnapshotState {
    snapshot: DerivativesSnapshot | null;
    error: string | null;
    isLoading: boolean;
    refresh: () => void;
}

const REFRESH_INTERVAL_MS = 30_000;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Polls Binance USDⓈ-M derivatives metrics for a spot symbol.
 * Shared by DerivativesPanel and MicrostructureRibbon so both never double-fetch.
 */
export function useDerivativesSnapshot(spotSymbol: string): DerivativesSnapshotState {
    const contract = getBinanceFuturesContract(spotSymbol);
    const [snapshotState, setSnapshotState] = useState<{
        symbol: string;
        snapshot: DerivativesSnapshot;
    } | null>(null);
    const [errorState, setErrorState] = useState<{ symbol: string; message: string | null }>({
        symbol: '',
        message: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

    useEffect(() => {
        const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [refresh]);

    useEffect(() => {
        const controller = new AbortController();
        let timedOut = false;
        let disposed = false;
        setIsLoading(true);
        const timeoutId = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, FETCH_TIMEOUT_MS);

        const request = async (path: string): Promise<unknown> => {
            const response = await fetch(`${BINANCE_FUTURES_REST_URL}${path}`, { signal: controller.signal });
            if (!response.ok) throw new Error(`Binance Futures returned ${response.status}`);
            return response.json() as Promise<unknown>;
        };

        Promise.all([
            request(`/fapi/v1/premiumIndex?symbol=${contract.futuresSymbol}`),
            request(`/fapi/v1/openInterest?symbol=${contract.futuresSymbol}`),
            request(`/futures/data/globalLongShortAccountRatio?symbol=${contract.futuresSymbol}&period=5m&limit=1`),
        ])
            .then(([premium, interest, ratios]) => {
                if (disposed) return;
                const next = parseDerivativesSnapshot(premium, interest, ratios, contract.futuresSymbol, contract.multiplier);
                setSnapshotState({ symbol: contract.spotSymbol, snapshot: next });
                setErrorState({ symbol: contract.spotSymbol, message: null });
            })
            .catch((caught: unknown) => {
                if (disposed || (controller.signal.aborted && !timedOut)) return;
                setErrorState({
                    symbol: contract.spotSymbol,
                    message: timedOut
                        ? 'Binance Futures request timed out'
                        : caught instanceof Error
                            ? caught.message
                            : 'Derivatives data unavailable',
                });
            })
            .finally(() => {
                window.clearTimeout(timeoutId);
                if (!disposed) setIsLoading(false);
            });

        return () => {
            disposed = true;
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, [contract.futuresSymbol, contract.multiplier, contract.spotSymbol, refreshKey]);

    const snapshot = snapshotState?.symbol === contract.spotSymbol ? snapshotState.snapshot : null;
    const error = errorState.symbol === contract.spotSymbol ? errorState.message : null;

    return { snapshot, error, isLoading, refresh };
}
```

- [ ] **Step 4: Refactor `DerivativesPanel` to consume it**

Replace the component's local state + both effects with `const { snapshot, error, refresh } = useDerivativesSnapshot(symbol);` (keep `isLoading` unused or render the existing spinner against it). Preserve every JSX node and aria attribute. Change the funding card from percent to basis points:

```tsx
<div className="metric-card"><span>Funding / 8h</span><strong className={snapshot.fundingRate >= 0 ? 'positive' : 'negative'}>{formatBps(snapshot.fundingRate * 10_000)}</strong><small>Next {new Date(snapshot.nextFundingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>
```

Add `formatBps` to the existing `@/utils/format` import.

- [ ] **Step 5: Run tests + full gates**

Run: `npx vitest run src/tests/hooks && npm run lint && npm run check && npm run test`
Expected: PASS (existing suites unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDerivativesSnapshot.ts src/features/market/DerivativesPanel.tsx src/tests/hooks/useDerivativesSnapshot.test.ts
git commit -m "refactor(market): extract useDerivativesSnapshot hook; funding in bps"
```

---

### Task 5: Microstructure ribbon

**Files:**
- Create: `src/features/market/MicrostructureRibbon.tsx`
- Modify: `src/app/MonitorWorkspace.tsx` (insert ribbon panel; remove Perps tab)
- Test: `src/tests/features/microstructureRibbon.test.tsx`

**Interfaces:**
- Consumes: `useDerivativesSnapshot(spotSymbol)` (Task 4), `subscribeLiquidations`/`Liquidation` from `@/integrations/binance/liquidations`, `formatBps`, `formatVolume`, `getBinanceFuturesContract`.
- Produces: `MicrostructureRibbon` props `{ symbol: string }`. Renders inside whatever parent box it's given (fills height, horizontal flex, `overflow hidden`). Cells carry stable test ids: `data-cell="funding" | "basis" | "oi" | "ls" | "liq"`.

- [ ] **Step 1: Write the failing tests**

Stub `useDerivativesSnapshot` via `vi.mock('@/hooks/useDerivativesSnapshot', …)` returning a fixture snapshot (`markPrice 100.0, indexPrice 99.9, fundingRate 0.00012, openInterest 850_000_000, longAccount 0.62, shortAccount 0.38, updatedAt Date.now()`). Stub `subscribeLiquidations` capturing its callback and invoking it with three synthetic `Liquidation` objects (`BTCUSDT SELL`, `ETHUSDT BUY`, `SOLUSDT SELL`).

Cases:
1. renders five labelled cells with computed values: funding cell shows `formatBps(0.00012 * 10_000)` i.e. `+1.20 bps`; basis shows `formatBps(((100/99.9)-1)*10_000)` ≈ `+10.01 bps`; OI cell contains `850.00M`; LS bar widths `62%`/`38%` (assert via inline style strings on elements inside `[data-cell="ls"]`);
2. liq cell lists the three events newest-first with side coloring classes (`positive` for BUY, `negative` for SELL) and compact values;
3. degraded mode: hook returns `{ snapshot: null, error: 'boom', isLoading: false }` → every cell renders the muted placeholder `—` and an accessible status line mentions the error;
4. unmount closes the liquidation subscription (close spy called).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/features/microstructureRibbon.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { formatBps, formatVolume } from '@/utils/format';
import { getBinanceFuturesContract } from '@/integrations/binance/contracts';
import { subscribeLiquidations, type Liquidation } from '@/integrations/binance/liquidations';
import { useDerivativesSnapshot } from '@/hooks/useDerivativesSnapshot';
import { BINANCE_FUTURES_REST_URL } from '@/constants/config';

interface MicrostructureRibbonProps {
    symbol: string;
}

const LIQ_BUFFER_SIZE = 8;
const LIQ_VISIBLE = 3;

const MutedCell = ({ label }: { label: string }) => (
    <div className="ribbon__cell" data-cell={label}>
        <span className="ribbon__label">{label.toUpperCase()}</span>
        <span className="ribbon__value ribbon__value--muted">—</span>
    </div>
);

/**
 * MicrostructureRibbon — dense derivatives strip docked under the chart.
 * Funding · basis · open interest · long/short · latest liquidations.
 */
const MicrostructureRibbon: React.FC<MicrostructureRibbonProps> = ({ symbol }) => {
    const contract = getBinanceFuturesContract(symbol);
    const { snapshot, error } = useDerivativesSnapshot(contract.spotSymbol);
    const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
    const ownerRef = useRef<object>({});

    useEffect(() => {
        const subscription = subscribeLiquidations((event) => {
            setLiquidations((previous) => [event, ...previous].slice(0, LIQ_BUFFER_SIZE));
        });
        return () => subscription.close();
    }, []);

    const basis = snapshot && snapshot.indexPrice
        ? ((snapshot.markPrice / snapshot.indexPrice) - 1) * 10_000
        : null;
    const fundingBps = snapshot ? snapshot.fundingRate * 10_000 : null;
    const visibleLiquidations = liquidations.slice(0, LIQ_VISIBLE);

    return (
        <section
            className="ribbon"
            aria-label={`${contract.spotSymbol} microstructure`}
            data-testid="microstructure-ribbon"
        >
            {fundingBps === null ? (
                <MutedCell label="funding" />
            ) : (
                <div className="ribbon__cell" data-cell="funding">
                    <span className="ribbon__label">FUNDING 8H</span>
                    <span className={`ribbon__value ${fundingBps >= 0 ? 'positive' : 'negative'}`}>
                        {formatBps(fundingBps)}
                    </span>
                </div>
            )}

            {basis === null || !snapshot ? (
                <MutedCell label="basis" />
            ) : (
                <div className="ribbon__cell" data-cell="basis">
                    <span className="ribbon__label">BASIS</span>
                    <span className={`ribbon__value ${basis >= 0 ? 'positive' : 'negative'}`}>
                        {formatBps(basis)}
                    </span>
                </div>
            )}

            {!snapshot ? (
                <MutedCell label="oi" />
            ) : (
                <div className="ribbon__cell" data-cell="oi">
                    <span className="ribbon__label">OPEN INTEREST</span>
                    <span className="ribbon__value">
                        ${formatVolume(snapshot.openInterest)} {contract.spotSymbol.replace('USDT', '')}
                    </span>
                </div>
            )}

            {!snapshot ? (
                <MutedCell label="ls" />
            ) : (
                <div className="ribbon__cell ribbon__cell--wide" data-cell="ls">
                    <span className="ribbon__label">LONG/SHORT</span>
                    <div
                        className="ratio-bar ratio-bar--mini"
                        aria-label={`Long accounts ${(snapshot.longAccount * 100).toFixed(1)} percent, short accounts ${(snapshot.shortAccount * 100).toFixed(1)} percent`}
                    >
                        <div style={{ width: `${snapshot.longAccount * 100}%` }} />
                    </div>
                    <span className="ribbon__sub">
                        <span className="positive">{(snapshot.longAccount * 100).toFixed(0)}%</span>
                        {' / '}
                        <span className="negative">{(snapshot.shortAccount * 100).toFixed(0)}%</span>
                    </span>
                </div>
            )}

            <div className="ribbon__cell ribbon__cell--wide" data-cell="liq">
                <span className="ribbon__label">LIQUIDATIONS</span>
                {visibleLiquidations.length === 0 ? (
                    <span className="ribbon__value ribbon__value--muted">—</span>
                ) : (
                    <ul className="ribbon__liqs">
                        {visibleLiquidations.map((event) => (
                            <li key={`${event.time}-${event.symbol}-${event.price}`} className={event.isBuy ? 'positive' : 'negative'}>
                                {event.isBuy ? '▲' : '▼'} {event.symbol.replace('USDT', '')} ${formatVolume(event.value)}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {error && (
                <span className="ribbon__status" role="status">{error}</span>
            )}
        </section>
    );
};

export default MicrostructureRibbon;
```

Note: `BINANCE_FUTURES_REST_URL` import above is intentionally listed for removal if unused after your final pass — do not ship an unused import (lint will catch it; delete the line).

- [ ] **Step 4: Wire into `MonitorWorkspace`**

Inside the center column's vertical `PanelGroup`, between the chart Panel and the Market Depth Panel insert:

```tsx
<PanelResizeHandle className="resize-handle" />

<Panel defaultSize={14} minSize={10}>
    <div id="panel-ribbon" tabIndex={-1} style={{ height: '100%' }}>
        <DashboardPanel title={`Microstructure - ${selectedSymbol}`}>
            <PanelErrorBoundary>
                <MicrostructureRibbon symbol={selectedSymbol} />
            </PanelErrorBoundary>
        </DashboardPanel>
    </div>
</Panel>
```

Reduce the chart Panel `defaultSize` from 68 to 58 (keep minSize 40) so the column still sums sensibly. Remove the `derivatives` (Perps) entry from `intelligenceTabs` and its now-unused `Radio` icon import. Add the `MicrostructureRibbon` import.

- [ ] **Step 5: Run tests + full gates**

Run: `npx vitest run src/tests/features/microstructureRibbon.test.tsx && npm run lint && npm run check && npm run test`

- [ ] **Step 6: Manual smoke + commit**

`npm run dev` → probe localhost:3000: ribbon visible under chart with live funding/OI once futures REST responds; Perps tab gone from right rail.

```bash
git add src/features/market/MicrostructureRibbon.tsx src/app/MonitorWorkspace.tsx src/tests/features/microstructureRibbon.test.tsx
git commit -m "feat(market): microstructure ribbon under chart; retire Perps tab"
```

---

### Task 6: TICK board (MarketGrid rebuild)

**Files:**
- Modify: `src/features/market/MarketGrid.tsx` (rewrite render layer; keep the entire `useEffect` WS/seed lifecycle verbatim)
- Test: `src/tests/features/tickBoard.test.tsx`

**Interfaces:**
- Consumes: existing `WatchlistMarketData`, `useMarketStore`, `formatPrice/formatVolume/formatPercent`, `formatBps` (Task 1).
- Produces: same external contract — `MarketGrid({ onSelectSymbol? })`. Internal additions:
  - `const MAJOR_BASES = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE'] as const;`
  - `export type TickSectionId = 'majors' | 'perps' | 'movers';`
  - `export function partitionTickSections(data: MarketData[]): { majors: MarketData[]; moversUp: MarketData[]; moversDown: MarketData[] }` — majors ordered by `MAJOR_BASES` order (only those present in data); movers sorted by `priceChangePercent` desc/asc, top 5 each, excluding symbols already shown in majors.
  - localStorage key `qt.tickboard.sections` storing `Record<TickSectionId, boolean>` (true = expanded). Defaults all expanded. Wrap access in try/catch like `App.tsx` does.
  - Perps polling: `GET ${BINANCE_FUTURES_REST_URL}/fapi/v1/premiumIndex` (bulk, no symbol param) on mount + every 60s while the PERPS section is expanded; response is an array of records with `symbol`, `markPrice`, `lastFundingRate`, `nextFundingTime`; filter rows to `MAJOR_BASES.map(b => \`${b}USDT\`)`. Failure collapses section body to one muted line `Perps data unavailable`. Countdown text recomputed on a 1s ticker active only while expanded.

- [ ] **Step 1: Write the failing tests**

Fixture: build 12 `WatchlistMarketData` records — the six majors with known prices/volumes plus six alts with extreme `priceChangePercent` (+12.4, +9.1, +7.7, +5, −11.3, −8.2 spread across alts; give one major a mid value like +2). Cases:

1. `partitionTickSections` returns majors in MAJOR_BASES order; movers exclude majors; `moversUp` is the 5 highest remaining by change desc; `moversDown` the 5 lowest asc.
2. Renders three section headers `MAJORS`, `PERPS`, `MOVERS`; MAJORS body shows fixture prices via `formatPrice`.
3. Clicking `MOVERS` header toggles its body and persists `{ movers: false }` (merged with defaults) to `qt.tickboard.sections`; re-render picks it up (assert collapsed body absent).
4. Mock fetch for bulk premiumIndex returning two records (`BTCUSDT` funding `0.00015`, next funding `Date.now()+90_000`; `ETHUSDT`) → PERPS section shows `1.50 bps` and a mm:ss countdown for BTC row; ETH row shows its own funding.
5. Bulk fetch rejecting renders `Perps data unavailable` muted line inside PERPS section.
6. Search input filters rows across sections (type `btc` → majors shows BTC row only among visible rows).

Mock WebSocket minimally (the component opens one on mount): assign `vi.stubGlobal('WebSocket', class { close() {} /* noop */ })` unless existing tests already provide a harness for the watchlist stream — reuse that if found.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/features/tickBoard.test.tsx`
Expected: FAIL — sections/partition not present.

- [ ] **Step 3: Rewrite the render layer**

Keep lines 46–246 of the current file (state, effect, `sortedData` memo, handlers) essentially verbatim except:
- delete the sort-state UI concerns that no longer apply (`sortBy`, `sortDir`, `handleSort`, `renderSortIndicator`, `getAriaSort`) — sections replace sortable columns; keep `sortedData` memo only for search filtering (rename `visibleData`).
- add `perpsState` (`{ rows: PerpsRow[] | null; error: string | null }`), the 60s poll effect gated on perps-section expansion, the 1s countdown ticker state, and persisted-collapse state via a small reducer.

Render skeleton (replace everything currently returned):

```tsx
return (
    <div className="tickboard">
        <div className="market-grid__toolbar">
            {/* keep the existing search input + count badge JSX exactly as-is */}
        </div>
        {error && (/* keep existing feed-status block */)}
        <div className="tickboard__scroller">
            <TickSection id="majors" title="MAJORS" ... >{majorsTable}</TickSection>
            <TickSection id="perps" title="PERPS" ...>{perpsBody}</TickSection>
            <TickSection id="movers" title="MOVERS" ...>{moversBody}</TickSection>
        </div>
    </div>
);
```

`TickSection` is a local component: header button (`aria-expanded`, chevron rotate) + collapsible body div. Section tables reuse the existing `market-grid__table` classes with the existing 4-col layout (Symbol · Last · 24H · Vol); PERPS table columns: Symbol · Mark · Funding · Next. Reuse `MarketRow` for majors/movers rows unchanged. PERPS row:

```tsx
<tr className="market-grid__row" aria-label={`${base} perpetual funding ${formatBps(row.fundingBps)}`}>
    <td className="market-grid__symbol">{row.base}</td>
    <td className="market-grid__price">{formatPrice(row.markPrice)}</td>
    <td className={row.fundingBps >= 0 ? 'market-grid__change positive' : 'market-grid__change negative'}>{formatBps(row.fundingBps)}</td>
    <td className="market-grid__volume">{countdown(row.nextFundingTime)}</td>
</tr>
```

with `countdown(ms)` → `mm:ss` clamped at `00:00`.

MOVERS body: two stacked groups with tiny group labels `TOP ↑` / `TOP ↓`, each rendering up to five `MarketRow`s.

CSS goes in this task as appended rules in `src/styles/global.css` using existing variables (final polish happens in Task 7): `.tickboard__scroller { overflow-y: auto; }`, `.tickboard__section-header` styles mirroring `DashboardPanel` header typography, chevron rotation transition.

- [ ] **Step 4: Run tests + full gates**

Run: `npx vitest run src/tests/features/tickBoard.test.tsx && npm run lint && npm run check && npm run test`

- [ ] **Step 5: Manual smoke + commit**

`npm run dev` → localhost:3000: left rail shows MAJORS/PERPS/MOVERS; clicking headers collapses; selection still switches the chart symbol.

```bash
git add src/features/market/MarketGrid.tsx src/tests/features/tickBoard.test.tsx src/styles/global.css
git commit -m "feat(market): rebuild Market Watch as collapsible TICK board"
```

---

### Task 7: Amber theme pass

**Files:**
- Modify: `src/styles/global.css`
- Test: `src/tests/styles/theme.test.ts` (extend existing styles test dir if present)

**Interfaces:**
- Consumes: existing CSS custom properties (locate the accent tokens — `--accent-primary` is referenced by `CommandPalette.tsx`; find its definition and siblings in `global.css`).
- Produces: updated token values + utility rules. Binding values:
  - Dark theme interactive accent ramp: `#ffb020` base, `#ff9e1b` hover/active, dim `#8a6516` for borders/subtle backgrounds.
  - Light theme equivalents tuned for ≥4.5:1 contrast on white cards (e.g. `#a06a00` family — pick final values by checking contrast, document chosen hexes in the commit message).
  - Directional tones untouched semantically: green up / red down stay the only colors allowed on delta/funding/liq values.
  - `font-variant-numeric: tabular-nums` applied to: `.market-grid__price`, `.market-grid__change`, `.market-grid__volume`, `.ribbon__value`, `.metric-card strong`, `.tickboard td`.
  - Density: reduce padding on `.market-grid__row td` by ~2px vertical; `.ribbon` cells gap tightened; `.command-line` input styled amber-bordered (border-color `#8a6516`, focus ring `#ffb020`).

- [ ] **Step 1: Write the failing test**

If `src/tests/styles/` has an existing CSS-token test harness, extend it. Otherwise create a regex-based guard test:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../../styles/global.css'), 'utf8');

describe('amber theme tokens', () => {
    it('defines the amber interactive ramp', () => {
        expect(css).toMatch(/#ffb020/i);
        expect(css).toMatch(/#ff9e1b/i);
    });

    it('keeps directional colors out of the accent ramp', () => {
        // accent token declarations must not reference greens/reds
        const accentBlock = css.match(/--accent-primary:[^;]+;/)?.[0] ?? '';
        expect(accentBlock.toLowerCase()).not.toMatch(/#(0f0|00c853|26a69a|ef5350|f6465d)/);
    });

    it('applies tabular numerals to metric surfaces', () => {
        expect(css).toMatch(/tabular-nums/);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/styles/theme.test.ts`
Expected: FAIL — hexes not yet present.

- [ ] **Step 3: Apply the CSS changes**

In `global.css`: locate the `:root`/theme variable blocks; repoint accent-family tokens to the ramp above (both themes); add the `tabular-nums` rule group; adjust the density paddings named above; add `.command-line`, `.command-line__results`, `.command-line__option`, `.ribbon`, `.ribbon__cell`, `.ribbon__label`, `.ribbon__value`, `.ribbon__liqs`, `.tickboard` section-header/body styles if Task 5/6 left them minimal. Do not alter any color used by Strategy Lab replay charts or the order-book depth gradient semantics.

- [ ] **Step 4: Run tests + full gates**

Run: `npx vitest run && npm run lint && npm run check && npm run build`

- [ ] **Step 5: Manual visual pass + commit**

`npm run dev` → localhost:3000 in both themes: accents amber, deltas green/red only, numerals aligned in columns, no contrast regressions in header/footer.

```bash
git add src/styles/global.css src/tests/styles
git commit -m "polish(theme): amber interactive ramp, tabular numerals, density pass"
```

---

## Self-Review Notes

- Spec coverage: command line (Tasks 2–3), ribbon (Tasks 4–5), TICK board (Task 6), theme (Task 7), units discipline (Tasks 1, 4, 5, 6), light-theme coherence (Task 7). CVD sparkline explicitly out of scope per spec.
- Type consistency: `formatBps(number): string` used identically in Tasks 4/5/6; `useDerivativesSnapshot` signature fixed in Task 4 and consumed unchanged in Task 5; `Command.mnemonic` introduced Task 2, consumed Task 3.
- Known cross-task risk: Task 6 deletes sort UI from MarketGrid — confirm no other module imports `SortKey`/sort-related exports from MarketGrid before deleting (it exports none today; default export only — verified 2026-08-24).
