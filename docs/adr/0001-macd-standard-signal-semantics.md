# ADR-0001: MACD uses standard signal-line semantics

- Status: Accepted
- Date: 2026-08-27

## Context

All three MACD implementations — the Rust canonical engine (`rust/src/lib.rs`),
the kept TypeScript reference (`src/`), and the canvas overlay (`ui/`) — seed the
signal-line EMA from index 0 of the MACD series. They are internally consistent,
so the wasm↔TS parity suite passes — but the result diverges from textbook MACD,
where the signal line is a 9-period EMA over the MACD line with its own warmup
period. Users comparing quant.term's MACD against TradingView or other tools see
different signal and histogram values.

## Decision

Adopt standard MACD semantics before v1.0.0:

- Signal line = `signal_period` EMA of the MACD line, computed only once the MACD
  line itself is valid (after the slow-EMA warmup).
- The change is applied identically in the Rust canonical implementation, the
  TypeScript reference, and the canvas overlay implementation.
- Golden fixtures and parity expectations are regenerated under the new
  semantics; `docs/INDICATORS.md` states the precise warmup behavior.

## Alternatives considered

- Keep index-0 seeding: preserves current golden values and parity history, but
  permanently ships a nonstandard indicator — the kind of quiet inaccuracy a
  research terminal cannot afford once tagged v1.
- Wait until after v1: avoids re-baselining now, but means the first tagged
  release bakes in semantics we already know are wrong, and a post-v1 change is
  a visible behavioral break for users rather than a pre-release correction.

## Consequences

- Historical golden values for MACD change permanently — this is intentionally a
  one-way door, taken before any release is tagged so no shipped version carries
  the old semantics.
- The parity suite and goldens must be regenerated in the same change that lands
  the fix; CI's wasm drift gate keeps the compiled bundle aligned.
- Replay results, equity curves, and metrics produced with the new semantics are
  not comparable to earlier ad-hoc runs.
