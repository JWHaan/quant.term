# Frontend Patterns

## File Structure

```text
ui/src/
├── app/        # shell + boot
├── stores/     # AppStores — signal-based global state
├── services/   # external feeds (Binance, RSS edge route, mempool.space)
├── data/       # static data
├── features/   # one module per surface
│   ├── charts/        # Canvas2D charting
│   ├── backtest/      # Strategy Lab UI
│   ├── news/          # news feed
│   ├── market/        # market overview
│   ├── trading/       # paper trading
│   ├── command_palette/
│   ├── analytics/     # OFI/CVD/VPIN surfaces
│   └── debug/
└── ui/         # shared presentational components
```

## Component Rules

- Leptos 0.8 client-side rendering; the entire app lives in the `quant-ui` WASM bundle — there is no TS component layer
- Feature modules are self-contained under `ui/src/features/`; shared widgets go in `ui/src/ui/`
- UI text in English; terminal aesthetic — dense, keyboard-first (`command_palette` exists for a reason)
- After ANY `ui/` source edit: `./scripts/build-ui-wasm.sh` and commit the regenerated `src/wasm/quant-ui/` bundle alongside the source change

## State Management

- `AppStores` in `ui/src/stores/` — Leptos signals, not a TS store library
- Persistence writes `localStorage` under **Zustand-compatible keys** carried over from the React port — do not rename persisted keys (it's a migration contract with existing users' browsers)
- Persisted settings/state live in stores; transient stream state lives in services

## Toast / Notification System

Alert system is in-app (alerts feature on live prices). No external toast lib detected.

## Analytics

None detected — no GA/GTM/Plausible. Keep it that way unless the user asks.

## Trust Boundaries

- All market data is public and read-only — the app holds **no exchange credentials** and cannot trade; "paper trading" is simulated locally
- Anything in `src/wasm/` is generated — trust boundary is `rust/` + `ui/` source → wasm-bindgen output; verify behavior via TS parity tests, not by reading the bundle
- `VITE_*` vars are embedded in the bundle — public values only, never secrets
