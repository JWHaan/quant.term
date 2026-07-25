# quant.term native replay engine

This directory contains the deterministic C++20 reference core for the first
`quant.term` backtesting slice. It intentionally starts with one bounded model:

- one BTC/USDT candle stream
- long/flat SMA crossover
- signals evaluated at candle close
- fills at the next candle open
- explicit fee and slippage basis points
- mark-to-market equity, drawdown, exposure, Sharpe, and trade accounting

The browser Strategy Lab uses a TypeScript reference implementation of the same
`backtest-v1` contract so it can run on the existing static deployment. The
native engine is compiled and tested by the repository quality gate. Native
remote execution is deliberately deferred until parity fixtures and benchmarks
justify the additional service.

Run the native checks from the repository root:

~~~bash
npm run engine:check
~~~

The `quant-backtest` executable prints a deterministic JSON summary for the
bundled synthetic fixture. Synthetic results validate accounting and execution
semantics; they are not evidence of live strategy performance.
