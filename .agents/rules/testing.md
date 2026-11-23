# Testing Strategy

## Runner

Vitest 5.1 + happy-dom + @vitest/coverage-v8. Rust crates have their own cargo gates (`npm run wasm:check` → fmt + clippy `-D warnings` on `rust/`).

| Command | Purpose |
| ------- | ------- |
| `npm test` | Vitest single run |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Run with V8 coverage |
| `npm run wasm:check` | cargo fmt --check + clippy on `rust/` |

## Test Files

```text
src/tests/
├── setup.ts                # loads WASM artifacts directly from disk (not fetch) — CI-safe
├── indicators.test.ts      # aggregate indicator suite
├── deploymentAdapters.test.ts
├── indicators/             # sma, ema, rsi, macd, atr, bb, vwap, moving_averages, advanced, parity
├── backtest/               # engine.test.ts, schema.test.ts, parity.test.ts
└── utils/                  # format, tradeClassifier, vpinCalculator
```

Total: 18 test files / 124 tests.

## Running Specific Tests

```bash
npm test                                    # all
npm test -- src/tests/indicators/rsi.test.ts   # one file
npx vitest run -t "calculates RSI"          # name pattern
```

## Patterns

- **Parity tests** (`indicators/parity.test.ts`, `backtest/parity.test.ts`): assert the WASM `quant-core` output matches the TypeScript reference implementations bit-for-bit within tolerance. The `*-reference.ts` files are the ground truth — if they disagree with wasm, the wasm is wrong until proven otherwise.
- `src/tests/setup.ts` serves wasm from disk; don't convert it to network fetches (that's what broke CI before — ECONNREFUSED).
- No mocking framework conventions beyond Vitest `vi.*`; pure-math tests dominate.

## When Writing New Tests

- New indicator/backtest behavior → extend the reference impl test AND the parity test together
- Name files `<area>.test.ts` inside the matching `src/tests/` subdir
- Keep tests deterministic — fixed fixtures, no live network

## Verification

After changes to `src/`, `rust/`, or `ui/`:

```bash
npm run lint && npm run type-check && npm test && npm run build
npm run wasm:check   # after rust/ edits
```
