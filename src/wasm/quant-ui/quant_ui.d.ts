/* tslint:disable */
/* eslint-disable */
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */

export type ReadableStreamType = "bytes";

export class IntoUnderlyingByteSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableByteStreamController): Promise<any>;
    start(controller: ReadableByteStreamController): void;
    readonly autoAllocateChunkSize: number;
    readonly type: ReadableStreamType;
}

export class IntoUnderlyingSink {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    abort(reason: any): Promise<any>;
    close(): Promise<any>;
    write(chunk: any): Promise<any>;
}

export class IntoUnderlyingSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableStreamDefaultController): Promise<any>;
}

export class OfiBookCalculator {
    free(): void;
    [Symbol.dispose](): void;
    calculate(snapshot: any): any;
    detectSignificantEvent(): any;
    getHistory(count: number): any;
    getOFIMovingAverage(window_size: number): number;
    getOFIStdDev(window_size: number): number;
    constructor();
    reset(): void;
}

export class TradeClassifierCore {
    free(): void;
    [Symbol.dispose](): void;
    calculateVolumeDelta(window_ms: number): any;
    classifyByLeeReady(trade: any, current_mid_price: number): any;
    classifyByTickRule(trade: any): any;
    classifyFromExchange(trade: any): any;
    detectDivergence(price_data: any): any;
    getBuySellRatio(window_ms: number): number;
    getCumulativeVolumeDelta(interval_ms: number): any;
    getHistory(count: number): any;
    constructor();
    reset(): void;
}

export class VpinCalculatorCore {
    free(): void;
    [Symbol.dispose](): void;
    addTrade(trade: any): any;
    detectSpike(threshold: number): boolean;
    getCurrentBucketProgress(): number;
    getVPINHistory(count: number): any;
    getVPINTrend(lookback: number): any;
    constructor(bucket_size: number, num_buckets: number);
    reset(): void;
}

export function aggregateOrderBookHeatmap(snapshots: any, config: any, now: number): any;

/**
 * Build dataset provenance. `checksum` is computed in TS (checksumCandles)
 * because it depends on JS number-to-string formatting.
 * Mirrors `buildDatasetMeta` in src/integrations/binance/klines.ts.
 */
export function build_dataset_meta(candles: any, symbol: string, interval: string, interval_seconds: number, fetched_at: number, checksum: string): any;

export function calculate_adx(data: any, period: number): any;

export function calculate_atr(data: any, period: number): any;

export function calculate_bollinger_bands(data: any, period: number, std_dev: number): any;

export function calculate_ema(data: any, period: number): any;

export function calculate_hurst(data: any): any;

export function calculate_macd(data: any, fast_period: number, slow_period: number, signal_period: number): any;

export function calculate_obv(data: any): any;

export function calculate_ofi(data: any): any;

export function calculate_rsi(data: any, period: number): any;

export function calculate_sma(data: any, period: number): any;

export function calculate_vwap(data: any): any;

/**
 * Detect missing bars between consecutive candles.
 * Mirrors `detectGaps` in src/integrations/binance/klines.ts.
 */
export function detect_gaps(candles: any, interval_seconds: number, tolerance_seconds?: number | null): any;

/**
 * Unwrap a combined-stream WS payload: array payloads pass through, objects
 * with a `data` record yield [data], everything else yields [].
 * Mirrors `extractTickerValues` in src/integrations/binance/watchlist.ts.
 */
export function extract_ticker_values(payload: any): any;

/**
 * Resolve a spot instrument to its USDⓈ-M contract and unit multiplier.
 * Mirrors `getBinanceFuturesContract` in src/integrations/binance/contracts.ts.
 */
export function futures_contract(symbol: string): any;

export function normalize_futures_price(price: number, multiplier: number): number;

export function normalize_futures_quantity(quantity: number, multiplier: number): number;

/**
 * Parse and validate the three Binance Futures REST payloads into a
 * DerivativesSnapshot. Throws Error on malformed input, matching
 * `parseDerivativesSnapshot` in src/integrations/binance/derivatives.ts.
 */
export function parse_derivatives_snapshot(premium_payload: any, interest_payload: any, ratios_payload: any, expected_futures_symbol: string, contract_multiplier: number, received_at?: number | null): any;

/**
 * Parse one raw Binance REST kline row. Returns a candle object or JS null.
 * Mirrors `parseKlineRow` in src/integrations/binance/klines.ts.
 */
export function parse_kline_row(row: any, interval_seconds: number, now_ms: number): any;

/**
 * Batch variant: parse an array of kline rows, dropping malformed/unclosed.
 */
export function parse_klines(rows: any, interval_seconds: number, now_ms: number): any;

/**
 * Parse a Binance Futures `!forceOrder@arr` message.
 * Mirrors `parseBinanceLiquidation` in src/integrations/binance/liquidations.ts.
 */
export function parse_liquidation(value: any): any;

/**
 * Parse one Binance ticker payload (REST 24hr or miniTicker WS) into the
 * display/store pair used by the market watch.
 * `assets` is the TOP_CRYPTOS array [{symbol,name,category}] passed from TS.
 * Mirrors `parseTicker` in src/integrations/binance/watchlist.ts.
 */
export function parse_ticker(value: any, assets: any): any;

/**
 * Runs the backtest-v1 SMA crossover engine. Mirrors `runSmaCrossBacktest`
 * in src/backtest/engine.ts; the TS wrapper preserves the public API.
 */
export function run_sma_cross_backtest(candles: any, dataset: any, config: any): any;

export function start(): void;

/**
 * Validation-only entry point mirroring `validateBacktestInput`.
 */
export function validate_backtest_input_js(candles: any, config: any, dataset: any): void;
