# Architecture Rules

## Single App Structure

Browser-first terminal: a Leptos frontend crate and a shared quant engine crate both compile to WebAssembly; a thin TypeScript layer wraps them in a Vite app deployed to Cloudflare Sites via a custom plugin.

```text
quant.term/
├── rust/                 # quant-core — indicators, order-flow (OFI/CVD/VPIN), backtest engine
│   ├── Cargo.toml        # cdylib + rlib, wasm32-unknown-unknown target
│   └── src/              # shared math/engine used natively AND via wasm-bindgen
├── ui/                   # quant-ui — Leptos 0.8 CSR frontend crate
│   ├── Cargo.toml
│   └── src/
│       ├── app/          # app shell, routing/boot
│       ├── stores/       # AppStores — Leptos signals + localStorage persistence
│       ├── services/     # Binance spot/USDⓈ-M WS+REST, news RSS edge route, mempool.space
│       ├── data/         # static datasets/config
│       ├── features/     # charts, backtest, news, market, trading, command_palette, analytics, debug
│       └── ui/           # shared presentational components
├── src/                  # thin TypeScript layer
│   ├── rust-main.ts      # Vite entry — mounts the quant-ui WASM app
│   ├── backtest/
│   │   ├── engine.ts           # adapter calling the WASM engine
│   │   ├── engine-reference.ts # TS reference impl — parity-test ground truth
│   │   └── types.ts            # shared strategy/result schemas
│   ├── utils/
│   │   ├── indicators.ts             # wasm adapter
│   │   ├── indicators-reference.ts   # TS reference impl — parity ground truth
│   │   ├── tradeClassifier.ts, vpinCalculator.ts, format.ts
│   ├── wasm/             # COMMITTED generated wasm-bindgen bundles (never hand-edit)
│   │   ├── quant-core/   # from scripts/build-wasm.sh
│   │   └── quant-ui/     # from scripts/build-ui-wasm.sh
│   ├── tests/            # Vitest suite + setup.ts (loads wasm from disk)
│   └── types/, global.css
├── build/                # sites-vite-plugin.ts — custom Cloudflare Sites Vite plugin
├── scripts/              # wasm build/check + deploy-verification scripts
└── dist/                 # build output (gitignored)
```

## Stack

| Layer | Technology | Version |
| ----- | ---------- | ------- |
| UI framework | Leptos (CSR, signals) | 0.8 |
| Engine | Rust `quant-core` → wasm-bindgen | Rust 2021, wasm32 target |
| JS toolchain | Vite | 8.3 |
| TypeScript | tsc strict | 5.9 |
| Tests | Vitest + happy-dom + V8 coverage | 5.1 |
| Deploy | @cloudflare/vite-plugin + `build/sites-vite-plugin.ts` | — |
| Package manager | npm | 12.2.2 (Node >=24.15.0) |

## Runtime Surfaces

| Surface | Type | Description |
| ------- | ---- | ----------- |
| `quant-ui` WASM app | client | Whole UI rendered by Leptos in WASM; boots via `src/rust-main.ts` |
| `quant-core` WASM lib | client | Indicator/backtest math consumed through `src/` adapters |
| `/api/news` edge route | server | Same-origin RSS proxy (CoinDesk, Cointelegraph) via Cloudflare |
| Binance WS/REST | external | Public read-only spot + USDⓈ-M market data |
| mempool.space, Alternative.me | external | Network stats, Fear & Greed |

## Data Flow

```text
Binance WS/REST ──► ui/src/services ──► AppStores (Leptos signals)
                                           ├─► features/* render (charts → Canvas2D)
                                           └─► localStorage persistence (Zustand-compatible keys)
Strategy Lab run ──► src/backtest/engine.ts ──► quant-core WASM
                       └─ parity-checked vs engine-reference.ts
```

## Language

English for all code, UI text, docs, and commits.
