export class IntoUnderlyingByteSource {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingByteSourceFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingbytesource_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get autoAllocateChunkSize() {
        const ret = wasm.intounderlyingbytesource_autoAllocateChunkSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    cancel() {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingbytesource_cancel(ptr);
    }
    /**
     * @param {ReadableByteStreamController} controller
     * @returns {Promise<any>}
     */
    pull(controller) {
        const ret = wasm.intounderlyingbytesource_pull(this.__wbg_ptr, controller);
        return ret;
    }
    /**
     * @param {ReadableByteStreamController} controller
     */
    start(controller) {
        wasm.intounderlyingbytesource_start(this.__wbg_ptr, controller);
    }
    /**
     * @returns {ReadableStreamType}
     */
    get type() {
        const ret = wasm.intounderlyingbytesource_type(this.__wbg_ptr);
        return __wbindgen_enum_ReadableStreamType[ret];
    }
}
if (Symbol.dispose) IntoUnderlyingByteSource.prototype[Symbol.dispose] = IntoUnderlyingByteSource.prototype.free;

export class IntoUnderlyingSink {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingSinkFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsink_free(ptr, 0);
    }
    /**
     * @param {any} reason
     * @returns {Promise<any>}
     */
    abort(reason) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.intounderlyingsink_abort(ptr, reason);
        return ret;
    }
    /**
     * @returns {Promise<any>}
     */
    close() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.intounderlyingsink_close(ptr);
        return ret;
    }
    /**
     * @param {any} chunk
     * @returns {Promise<any>}
     */
    write(chunk) {
        const ret = wasm.intounderlyingsink_write(this.__wbg_ptr, chunk);
        return ret;
    }
}
if (Symbol.dispose) IntoUnderlyingSink.prototype[Symbol.dispose] = IntoUnderlyingSink.prototype.free;

export class IntoUnderlyingSource {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingSourceFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsource_free(ptr, 0);
    }
    cancel() {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingsource_cancel(ptr);
    }
    /**
     * @param {ReadableStreamDefaultController} controller
     * @returns {Promise<any>}
     */
    pull(controller) {
        const ret = wasm.intounderlyingsource_pull(this.__wbg_ptr, controller);
        return ret;
    }
}
if (Symbol.dispose) IntoUnderlyingSource.prototype[Symbol.dispose] = IntoUnderlyingSource.prototype.free;

export class OfiBookCalculator {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OfiBookCalculatorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_ofibookcalculator_free(ptr, 0);
    }
    /**
     * @param {any} snapshot
     * @returns {any}
     */
    calculate(snapshot) {
        const ret = wasm.ofibookcalculator_calculate(this.__wbg_ptr, snapshot);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {any}
     */
    detectSignificantEvent() {
        const ret = wasm.ofibookcalculator_detectSignificantEvent(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} count
     * @returns {any}
     */
    getHistory(count) {
        const ret = wasm.ofibookcalculator_getHistory(this.__wbg_ptr, count);
        return ret;
    }
    /**
     * @param {number} window_size
     * @returns {number}
     */
    getOFIMovingAverage(window_size) {
        const ret = wasm.ofibookcalculator_getOFIMovingAverage(this.__wbg_ptr, window_size);
        return ret;
    }
    /**
     * @param {number} window_size
     * @returns {number}
     */
    getOFIStdDev(window_size) {
        const ret = wasm.ofibookcalculator_getOFIStdDev(this.__wbg_ptr, window_size);
        return ret;
    }
    constructor() {
        const ret = wasm.ofibookcalculator_new();
        this.__wbg_ptr = ret;
        OfiBookCalculatorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    reset() {
        wasm.ofibookcalculator_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) OfiBookCalculator.prototype[Symbol.dispose] = OfiBookCalculator.prototype.free;

export class TradeClassifierCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TradeClassifierCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_tradeclassifiercore_free(ptr, 0);
    }
    /**
     * @param {number} window_ms
     * @returns {any}
     */
    calculateVolumeDelta(window_ms) {
        const ret = wasm.tradeclassifiercore_calculateVolumeDelta(this.__wbg_ptr, window_ms);
        return ret;
    }
    /**
     * @param {any} trade
     * @param {number} current_mid_price
     * @returns {any}
     */
    classifyByLeeReady(trade, current_mid_price) {
        const ret = wasm.tradeclassifiercore_classifyByLeeReady(this.__wbg_ptr, trade, current_mid_price);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {any} trade
     * @returns {any}
     */
    classifyByTickRule(trade) {
        const ret = wasm.tradeclassifiercore_classifyByTickRule(this.__wbg_ptr, trade);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {any} trade
     * @returns {any}
     */
    classifyFromExchange(trade) {
        const ret = wasm.tradeclassifiercore_classifyFromExchange(this.__wbg_ptr, trade);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {any} price_data
     * @returns {any}
     */
    detectDivergence(price_data) {
        const ret = wasm.tradeclassifiercore_detectDivergence(this.__wbg_ptr, price_data);
        return ret;
    }
    /**
     * @param {number} window_ms
     * @returns {number}
     */
    getBuySellRatio(window_ms) {
        const ret = wasm.tradeclassifiercore_getBuySellRatio(this.__wbg_ptr, window_ms);
        return ret;
    }
    /**
     * @param {number} interval_ms
     * @returns {any}
     */
    getCumulativeVolumeDelta(interval_ms) {
        const ret = wasm.tradeclassifiercore_getCumulativeVolumeDelta(this.__wbg_ptr, interval_ms);
        return ret;
    }
    /**
     * @param {number} count
     * @returns {any}
     */
    getHistory(count) {
        const ret = wasm.tradeclassifiercore_getHistory(this.__wbg_ptr, count);
        return ret;
    }
    constructor() {
        const ret = wasm.tradeclassifiercore_new();
        this.__wbg_ptr = ret;
        TradeClassifierCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    reset() {
        wasm.tradeclassifiercore_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) TradeClassifierCore.prototype[Symbol.dispose] = TradeClassifierCore.prototype.free;

export class VpinCalculatorCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        VpinCalculatorCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_vpincalculatorcore_free(ptr, 0);
    }
    /**
     * @param {any} trade
     * @returns {any}
     */
    addTrade(trade) {
        const ret = wasm.vpincalculatorcore_addTrade(this.__wbg_ptr, trade);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {number} threshold
     * @returns {boolean}
     */
    detectSpike(threshold) {
        const ret = wasm.vpincalculatorcore_detectSpike(this.__wbg_ptr, threshold);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    getCurrentBucketProgress() {
        const ret = wasm.vpincalculatorcore_getCurrentBucketProgress(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} count
     * @returns {any}
     */
    getVPINHistory(count) {
        const ret = wasm.vpincalculatorcore_getVPINHistory(this.__wbg_ptr, count);
        return ret;
    }
    /**
     * @param {number} lookback
     * @returns {any}
     */
    getVPINTrend(lookback) {
        const ret = wasm.vpincalculatorcore_getVPINTrend(this.__wbg_ptr, lookback);
        return ret;
    }
    /**
     * @param {number} bucket_size
     * @param {number} num_buckets
     */
    constructor(bucket_size, num_buckets) {
        const ret = wasm.vpincalculatorcore_new(bucket_size, num_buckets);
        this.__wbg_ptr = ret;
        VpinCalculatorCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    reset() {
        wasm.vpincalculatorcore_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) VpinCalculatorCore.prototype[Symbol.dispose] = VpinCalculatorCore.prototype.free;

/**
 * @param {any} snapshots
 * @param {any} config
 * @param {number} now
 * @returns {any}
 */
export function aggregateOrderBookHeatmap(snapshots, config, now) {
    const ret = wasm.aggregateOrderBookHeatmap(snapshots, config, now);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Build dataset provenance. `checksum` is computed in TS (checksumCandles)
 * because it depends on JS number-to-string formatting.
 * Mirrors `buildDatasetMeta` in src/integrations/binance/klines.ts.
 * @param {any} candles
 * @param {string} symbol
 * @param {string} interval
 * @param {number} interval_seconds
 * @param {number} fetched_at
 * @param {string} checksum
 * @returns {any}
 */
export function build_dataset_meta(candles, symbol, interval, interval_seconds, fetched_at, checksum) {
    const val4 = +interval_seconds;
    const val5 = +fetched_at;
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
        ptr0 = passStringToWasm0(symbol, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(interval, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        len1 = WASM_VECTOR_LEN;
        ptr2 = passStringToWasm0(checksum, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        len2 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr2) { wasm.__wbindgen_free(ptr2, len2 * 1, 1); }
        if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.build_dataset_meta(candles, ptr0, len0, ptr1, len1, val4, val5, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @param {number} period
 * @returns {any}
 */
export function calculate_adx(data, period) {
    const ret = wasm.calculate_adx(data, period);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @param {number} period
 * @returns {any}
 */
export function calculate_atr(data, period) {
    const ret = wasm.calculate_atr(data, period);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @param {number} period
 * @param {number} std_dev
 * @returns {any}
 */
export function calculate_bollinger_bands(data, period, std_dev) {
    const ret = wasm.calculate_bollinger_bands(data, period, std_dev);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @param {number} period
 * @returns {any}
 */
export function calculate_ema(data, period) {
    const ret = wasm.calculate_ema(data, period);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @returns {any}
 */
export function calculate_hurst(data) {
    const ret = wasm.calculate_hurst(data);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @param {number} fast_period
 * @param {number} slow_period
 * @param {number} signal_period
 * @returns {any}
 */
export function calculate_macd(data, fast_period, slow_period, signal_period) {
    const ret = wasm.calculate_macd(data, fast_period, slow_period, signal_period);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @returns {any}
 */
export function calculate_obv(data) {
    const ret = wasm.calculate_obv(data);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @returns {any}
 */
export function calculate_ofi(data) {
    const ret = wasm.calculate_ofi(data);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @param {number} period
 * @returns {any}
 */
export function calculate_rsi(data, period) {
    const ret = wasm.calculate_rsi(data, period);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @param {number} period
 * @returns {any}
 */
export function calculate_sma(data, period) {
    const ret = wasm.calculate_sma(data, period);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {any} data
 * @returns {any}
 */
export function calculate_vwap(data) {
    const ret = wasm.calculate_vwap(data);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Detect missing bars between consecutive candles.
 * Mirrors `detectGaps` in src/integrations/binance/klines.ts.
 * @param {any} candles
 * @param {number} interval_seconds
 * @param {number | null} [tolerance_seconds]
 * @returns {any}
 */
export function detect_gaps(candles, interval_seconds, tolerance_seconds) {
    const ret = wasm.detect_gaps(candles, interval_seconds, !isLikeNone(tolerance_seconds), isLikeNone(tolerance_seconds) ? 0 : tolerance_seconds);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Unwrap a combined-stream WS payload: array payloads pass through, objects
 * with a `data` record yield [data], everything else yields [].
 * Mirrors `extractTickerValues` in src/integrations/binance/watchlist.ts.
 * @param {any} payload
 * @returns {any}
 */
export function extract_ticker_values(payload) {
    const ret = wasm.extract_ticker_values(payload);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Resolve a spot instrument to its USDⓈ-M contract and unit multiplier.
 * Mirrors `getBinanceFuturesContract` in src/integrations/binance/contracts.ts.
 * @param {string} symbol
 * @returns {any}
 */
export function futures_contract(symbol) {
    const ptr0 = passStringToWasm0(symbol, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.futures_contract(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {number} price
 * @param {number} multiplier
 * @returns {number}
 */
export function normalize_futures_price(price, multiplier) {
    const ret = wasm.normalize_futures_price(price, multiplier);
    return ret;
}

/**
 * @param {number} quantity
 * @param {number} multiplier
 * @returns {number}
 */
export function normalize_futures_quantity(quantity, multiplier) {
    const ret = wasm.normalize_futures_quantity(quantity, multiplier);
    return ret;
}

/**
 * Parse and validate the three Binance Futures REST payloads into a
 * DerivativesSnapshot. Throws Error on malformed input, matching
 * `parseDerivativesSnapshot` in src/integrations/binance/derivatives.ts.
 * @param {any} premium_payload
 * @param {any} interest_payload
 * @param {any} ratios_payload
 * @param {string} expected_futures_symbol
 * @param {number} contract_multiplier
 * @param {number | null} [received_at]
 * @returns {any}
 */
export function parse_derivatives_snapshot(premium_payload, interest_payload, ratios_payload, expected_futures_symbol, contract_multiplier, received_at) {
    const val2 = +contract_multiplier;
    const val3 = +(isLikeNone(received_at) ? 0 : received_at);
    const ptr0 = passStringToWasm0(expected_futures_symbol, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse_derivatives_snapshot(premium_payload, interest_payload, ratios_payload, ptr0, len0, val2, !isLikeNone(received_at), val3);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Parse one raw Binance REST kline row. Returns a candle object or JS null.
 * Mirrors `parseKlineRow` in src/integrations/binance/klines.ts.
 * @param {any} row
 * @param {number} interval_seconds
 * @param {number} now_ms
 * @returns {any}
 */
export function parse_kline_row(row, interval_seconds, now_ms) {
    const ret = wasm.parse_kline_row(row, interval_seconds, now_ms);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Batch variant: parse an array of kline rows, dropping malformed/unclosed.
 * @param {any} rows
 * @param {number} interval_seconds
 * @param {number} now_ms
 * @returns {any}
 */
export function parse_klines(rows, interval_seconds, now_ms) {
    const ret = wasm.parse_klines(rows, interval_seconds, now_ms);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Parse a Binance Futures `!forceOrder@arr` message.
 * Mirrors `parseBinanceLiquidation` in src/integrations/binance/liquidations.ts.
 * @param {any} value
 * @returns {any}
 */
export function parse_liquidation(value) {
    const ret = wasm.parse_liquidation(value);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Parse one Binance ticker payload (REST 24hr or miniTicker WS) into the
 * display/store pair used by the market watch.
 * `assets` is the TOP_CRYPTOS array [{symbol,name,category}] passed from TS.
 * Mirrors `parseTicker` in src/integrations/binance/watchlist.ts.
 * @param {any} value
 * @param {any} assets
 * @returns {any}
 */
export function parse_ticker(value, assets) {
    const ret = wasm.parse_ticker(value, assets);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Runs the backtest-v1 SMA crossover engine. Mirrors `runSmaCrossBacktest`
 * in src/backtest/engine.ts; the TS wrapper preserves the public API.
 * @param {any} candles
 * @param {any} dataset
 * @param {any} config
 * @returns {any}
 */
export function run_sma_cross_backtest(candles, dataset, config) {
    const ret = wasm.run_sma_cross_backtest(candles, dataset, config);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

export function start() {
    wasm.start();
}

/**
 * Validation-only entry point mirroring `validateBacktestInput`.
 * @param {any} candles
 * @param {any} config
 * @param {any} dataset
 */
export function validate_backtest_input_js(candles, config, dataset) {
    const ret = wasm.validate_backtest_input_js(candles, config, dataset);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}
export function __wbg_Error_208446807d0d1e30(arg0, arg1) {
    const ret = Error(getStringFromWasm0(arg0, arg1));
    return ret;
}
export function __wbg_Number_ff192a72a0dcdf6d(arg0) {
    const ret = Number(arg0);
    return ret;
}
export function __wbg_String_8564e559799eccda(arg0, arg1) {
    const ret = String(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_bigint_get_as_i64_11da4b52cd0aedef(arg0, arg1) {
    const v = arg1;
    const ret = typeof(v) === 'bigint' ? v : undefined;
    getDataViewMemory0().setBigInt64((arg0 >>> 0) + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, !isLikeNone(ret), true);
}
export function __wbg___wbindgen_boolean_get_4f1baf9a00be3c74(arg0) {
    const v = arg0;
    const ret = typeof(v) === 'boolean' ? v : undefined;
    return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
}
export function __wbg___wbindgen_debug_string_f249a2a76caa9a55(arg0, arg1) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_in_3f58a9d3b3a7eed2(arg0, arg1) {
    const ret = arg0 in arg1;
    return ret;
}
export function __wbg___wbindgen_is_bigint_5fa10641e039d3ef(arg0) {
    const ret = typeof(arg0) === 'bigint';
    return ret;
}
export function __wbg___wbindgen_is_falsy_d864b623500ae65d(arg0) {
    const ret = !arg0;
    return ret;
}
export function __wbg___wbindgen_is_function_741ff2bb612836f5(arg0) {
    const ret = typeof(arg0) === 'function';
    return ret;
}
export function __wbg___wbindgen_is_null_c22311b1cc228e3a(arg0) {
    const ret = arg0 === null;
    return ret;
}
export function __wbg___wbindgen_is_object_8b968c3ab8e96595(arg0) {
    const val = arg0;
    const ret = typeof(val) === 'object' && val !== null;
    return ret;
}
export function __wbg___wbindgen_is_string_fc456fee5d3317de(arg0) {
    const ret = typeof(arg0) === 'string';
    return ret;
}
export function __wbg___wbindgen_is_undefined_be5b34249ff1fc15(arg0) {
    const ret = arg0 === undefined;
    return ret;
}
export function __wbg___wbindgen_jsval_eq_38d7bfbe4cc84039(arg0, arg1) {
    const ret = arg0 === arg1;
    return ret;
}
export function __wbg___wbindgen_jsval_loose_eq_b2f214e2e4b30e36(arg0, arg1) {
    const ret = arg0 == arg1;
    return ret;
}
export function __wbg___wbindgen_number_get_934b640d0889af78(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'number' ? obj : undefined;
    getDataViewMemory0().setFloat64((arg0 >>> 0) + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, !isLikeNone(ret), true);
}
export function __wbg___wbindgen_string_get_7ce8eee7fd327545(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'string' ? obj : undefined;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_throw_4c88d8bf264fd984(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbg__wbg_cb_unref_09736879a3f67559(arg0) {
    arg0._wbg_cb_unref();
}
export function __wbg_activeElement_6c30fe7fda33ef51(arg0) {
    const ret = arg0.activeElement;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_addEventListener_847fd86b8c33ec43() { return handleError(function (arg0, arg1, arg2, arg3) {
    arg0.addEventListener(getStringFromWasm0(arg1, arg2), arg3);
}, arguments); }
export function __wbg_altKey_423da1d67b588078(arg0) {
    const ret = arg0.altKey;
    return ret;
}
export function __wbg_appendChild_dbf7ad2f48413560() { return handleError(function (arg0, arg1) {
    const ret = arg0.appendChild(arg1);
    return ret;
}, arguments); }
export function __wbg_beginPath_ab690dc0c7efe6dc(arg0) {
    arg0.beginPath();
}
export function __wbg_blur_c2856e0bcfec2cc0() { return handleError(function (arg0) {
    arg0.blur();
}, arguments); }
export function __wbg_body_5f971cbc6950ca4f(arg0) {
    const ret = arg0.body;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_buffer_aca05a93c046db1a(arg0) {
    const ret = arg0.buffer;
    return ret;
}
export function __wbg_button_653210370515dd71(arg0) {
    const ret = arg0.button;
    return ret;
}
export function __wbg_byobRequest_18280c78e462544c(arg0) {
    const ret = arg0.byobRequest;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_byteLength_c5f3c188d5252e5b(arg0) {
    const ret = arg0.byteLength;
    return ret;
}
export function __wbg_byteOffset_63cdc7b38f33a45e(arg0) {
    const ret = arg0.byteOffset;
    return ret;
}
export function __wbg_call_40b008ba32f73991() { return handleError(function (arg0, arg1) {
    const ret = arg0.call(arg1);
    return ret;
}, arguments); }
export function __wbg_call_a410eb4b59ed5965() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.call(arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_cancelBubble_1164dd588f0c3481(arg0) {
    const ret = arg0.cancelBubble;
    return ret;
}
export function __wbg_clearInterval_75e54e39df78e754(arg0, arg1) {
    arg0.clearInterval(arg1);
}
export function __wbg_clearRect_428f96a6ba73b2f4(arg0, arg1, arg2, arg3, arg4) {
    arg0.clearRect(arg1, arg2, arg3, arg4);
}
export function __wbg_clearTimeout_fd2c5dfcf4c67f84(arg0, arg1) {
    arg0.clearTimeout(arg1);
}
export function __wbg_clientHeight_b40e8971aed9fa2b(arg0) {
    const ret = arg0.clientHeight;
    return ret;
}
export function __wbg_clientWidth_269ea87f17b863bf(arg0) {
    const ret = arg0.clientWidth;
    return ret;
}
export function __wbg_clientX_7207eed549b03753(arg0) {
    const ret = arg0.clientX;
    return ret;
}
export function __wbg_clientY_3371139730cd6f74(arg0) {
    const ret = arg0.clientY;
    return ret;
}
export function __wbg_clip_26239db7c0b67972(arg0) {
    arg0.clip();
}
export function __wbg_cloneNode_36b90700fd8dbbb0() { return handleError(function (arg0) {
    const ret = arg0.cloneNode();
    return ret;
}, arguments); }
export function __wbg_cloneNode_70249c8beed88ee3() { return handleError(function (arg0, arg1) {
    const ret = arg0.cloneNode(arg1 !== 0);
    return ret;
}, arguments); }
export function __wbg_close_294d3f727cb7a844() { return handleError(function (arg0) {
    arg0.close();
}, arguments); }
export function __wbg_close_5ee9c5fe4e8754a4() { return handleError(function (arg0) {
    arg0.close();
}, arguments); }
export function __wbg_close_bf94aa7e38b9a94b() { return handleError(function (arg0) {
    arg0.close();
}, arguments); }
export function __wbg_closest_39824b16065066bc() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.closest(getStringFromWasm0(arg1, arg2));
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}, arguments); }
export function __wbg_composedPath_99300fc960717ac7(arg0) {
    const ret = arg0.composedPath();
    return ret;
}
export function __wbg_construct_8670bb4c2b062969() { return handleError(function (arg0, arg1) {
    const ret = Reflect.construct(arg0, arg1);
    return ret;
}, arguments); }
export function __wbg_contains_743aa7c94499c269(arg0, arg1) {
    const ret = arg0.contains(arg1);
    return ret;
}
export function __wbg_content_6fed93ca1fd29f06(arg0) {
    const ret = arg0.content;
    return ret;
}
export function __wbg_createComment_bf8f324d5ce3d460(arg0, arg1, arg2) {
    const ret = arg0.createComment(getStringFromWasm0(arg1, arg2));
    return ret;
}
export function __wbg_createElementNS_2f7464180077e8e4() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
    const ret = arg0.createElementNS(arg1 === 0 ? undefined : getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
    return ret;
}, arguments); }
export function __wbg_createElement_de4a31ed2fb252be() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.createElement(getStringFromWasm0(arg1, arg2));
    return ret;
}, arguments); }
export function __wbg_createTextNode_2b48c3fc75dfcc67(arg0, arg1, arg2) {
    const ret = arg0.createTextNode(getStringFromWasm0(arg1, arg2));
    return ret;
}
export function __wbg_ctrlKey_b7978e4cf78dc62b(arg0) {
    const ret = arg0.ctrlKey;
    return ret;
}
export function __wbg_data_c7e5e8500f1bca2f(arg0) {
    const ret = arg0.data;
    return ret;
}
export function __wbg_deleteProperty_3ad7a085da623822() { return handleError(function (arg0, arg1) {
    const ret = Reflect.deleteProperty(arg0, arg1);
    return ret;
}, arguments); }
export function __wbg_deltaMode_d2ba7673c0228446(arg0) {
    const ret = arg0.deltaMode;
    return ret;
}
export function __wbg_deltaY_37dc0a54748a91f4(arg0) {
    const ret = arg0.deltaY;
    return ret;
}
export function __wbg_devicePixelRatio_90ee4024cee5d5f4(arg0) {
    const ret = arg0.devicePixelRatio;
    return ret;
}
export function __wbg_documentElement_5e44e37dd0181a81(arg0) {
    const ret = arg0.documentElement;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_document_3b5c3071b43e97ee(arg0) {
    const ret = arg0.document;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_done_57e08d0be6e30c02(arg0) {
    const ret = arg0.done;
    return ret;
}
export function __wbg_encodeURIComponent_e0d7769acee2dcb5(arg0, arg1) {
    const ret = encodeURIComponent(getStringFromWasm0(arg0, arg1));
    return ret;
}
export function __wbg_enqueue_c11626eae1c54509() { return handleError(function (arg0, arg1) {
    arg0.enqueue(arg1);
}, arguments); }
export function __wbg_entries_7bb1459bd9b5c2b9(arg0) {
    const ret = Object.entries(arg0);
    return ret;
}
export function __wbg_error_757e9472f8410341(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
    }
}
export function __wbg_error_d1fc0193610e0e39(arg0) {
    console.error(arg0);
}
export function __wbg_exitFullscreen_794b11803d43004f(arg0) {
    arg0.exitFullscreen();
}
export function __wbg_fetch_858ffa201963e190(arg0, arg1) {
    const ret = arg0.fetch(arg1);
    return ret;
}
export function __wbg_fetch_c30fc2ed77d76a76(arg0, arg1, arg2) {
    const ret = arg0.fetch(getStringFromWasm0(arg1, arg2));
    return ret;
}
export function __wbg_fillRect_e1f0b9915220348b(arg0, arg1, arg2, arg3, arg4) {
    arg0.fillRect(arg1, arg2, arg3, arg4);
}
export function __wbg_fillText_89d353a9ad9f4a1a() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
    arg0.fillText(getStringFromWasm0(arg1, arg2), arg3, arg4);
}, arguments); }
export function __wbg_firstElementChild_a60f6eaf7d453487(arg0) {
    const ret = arg0.firstElementChild;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_focus_d5e2fdbdb56416f0() { return handleError(function (arg0) {
    arg0.focus();
}, arguments); }
export function __wbg_fullscreenElement_ecd845ac09ed38dc(arg0) {
    const ret = arg0.fullscreenElement;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_getAttribute_c7b80d4010284561(arg0, arg1, arg2, arg3) {
    const ret = arg1.getAttribute(getStringFromWasm0(arg2, arg3));
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg_getBoundingClientRect_329ca748ec918b0c(arg0) {
    const ret = arg0.getBoundingClientRect();
    return ret;
}
export function __wbg_getComputedStyle_3be93eadae0000a9() { return handleError(function (arg0, arg1) {
    const ret = arg0.getComputedStyle(arg1);
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}, arguments); }
export function __wbg_getContext_d93f904b714852ae() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}, arguments); }
export function __wbg_getElementById_7ee213db584f37b0(arg0, arg1, arg2) {
    const ret = arg0.getElementById(getStringFromWasm0(arg1, arg2));
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_getHours_d55d13f9f95415bb(arg0) {
    const ret = arg0.getHours();
    return ret;
}
export function __wbg_getItem_49556a3e59cfb688() { return handleError(function (arg0, arg1, arg2, arg3) {
    const ret = arg1.getItem(getStringFromWasm0(arg2, arg3));
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}, arguments); }
export function __wbg_getMinutes_d0d71c490ef83b47(arg0) {
    const ret = arg0.getMinutes();
    return ret;
}
export function __wbg_getPropertyValue_c0aae8b8341401f1() { return handleError(function (arg0, arg1, arg2, arg3) {
    const ret = arg1.getPropertyValue(getStringFromWasm0(arg2, arg3));
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}, arguments); }
export function __wbg_getSeconds_7143dabeecfaf7d1(arg0) {
    const ret = arg0.getSeconds();
    return ret;
}
export function __wbg_getUTCDate_663b90c995fdf8b7(arg0) {
    const ret = arg0.getUTCDate();
    return ret;
}
export function __wbg_getUTCHours_3e5c258e11ac0d90(arg0) {
    const ret = arg0.getUTCHours();
    return ret;
}
export function __wbg_getUTCMinutes_e309e461528477de(arg0) {
    const ret = arg0.getUTCMinutes();
    return ret;
}
export function __wbg_getUTCMonth_135d8f5aa938eadd(arg0) {
    const ret = arg0.getUTCMonth();
    return ret;
}
export function __wbg_getUTCSeconds_8eb6d834a30e92cf(arg0) {
    const ret = arg0.getUTCSeconds();
    return ret;
}
export function __wbg_get_2080c49015e35254() { return handleError(function (arg0, arg1) {
    const ret = Reflect.get(arg0, arg1);
    return ret;
}, arguments); }
export function __wbg_get_635eea311fa1a291() { return handleError(function (arg0, arg1) {
    const ret = Reflect.get(arg0, arg1);
    return ret;
}, arguments); }
export function __wbg_get_d7176cfb76d71114(arg0, arg1) {
    const ret = arg0[arg1 >>> 0];
    return ret;
}
export function __wbg_get_unchecked_e6325ad374eff861(arg0, arg1) {
    const ret = arg0[arg1 >>> 0];
    return ret;
}
export function __wbg_get_with_ref_key_fc601247060b7204(arg0, arg1) {
    const ret = arg0[arg1];
    return ret;
}
export function __wbg_hasAttribute_3f271bd99815d507(arg0, arg1, arg2) {
    const ret = arg0.hasAttribute(getStringFromWasm0(arg1, arg2));
    return ret;
}
export function __wbg_height_ac6f1c3f49c13fe2(arg0) {
    const ret = arg0.height;
    return ret;
}
export function __wbg_host_64d73c152c626ec8(arg0) {
    const ret = arg0.host;
    return ret;
}
export function __wbg_hostname_8ccf6cf3da91c969(arg0, arg1) {
    const ret = arg1.hostname;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg_insertBefore_10ab0c19b463c12b() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.insertBefore(arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_instanceof_ArrayBuffer_12cdaa4161423e6b(arg0) {
    let result;
    try {
        result = arg0 instanceof ArrayBuffer;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_CanvasRenderingContext2d_72a60be8aaadecab(arg0) {
    let result;
    try {
        result = arg0 instanceof CanvasRenderingContext2D;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Element_05dbb22ded594343(arg0) {
    let result;
    try {
        result = arg0 instanceof Element;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Error_74e3cca0c4a69161(arg0) {
    let result;
    try {
        result = arg0 instanceof Error;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_HtmlElement_ea32ea7121e0a496(arg0) {
    let result;
    try {
        result = arg0 instanceof HTMLElement;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Map_0b4fc8b62e73f163(arg0) {
    let result;
    try {
        result = arg0 instanceof Map;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Promise_59148c6049d0e3a0(arg0) {
    let result;
    try {
        result = arg0 instanceof Promise;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Response_5b0b4f7f1daeae51(arg0) {
    let result;
    try {
        result = arg0 instanceof Response;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_ShadowRoot_cd78159e03fed884(arg0) {
    let result;
    try {
        result = arg0 instanceof ShadowRoot;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Uint8Array_d7aeb0dcb3108fea(arg0) {
    let result;
    try {
        result = arg0 instanceof Uint8Array;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Window_5cf453f5639aa1a2(arg0) {
    let result;
    try {
        result = arg0 instanceof Window;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_isArray_bcf1376d0d732d08(arg0) {
    const ret = Array.isArray(arg0);
    return ret;
}
export function __wbg_isSafeInteger_1a35ba4d31e71d38(arg0) {
    const ret = Number.isSafeInteger(arg0);
    return ret;
}
export function __wbg_is_2248ff2b575d60c7(arg0, arg1) {
    const ret = Object.is(arg0, arg1);
    return ret;
}
export function __wbg_iterator_e4c5e8f68ada7b58() {
    const ret = Symbol.iterator;
    return ret;
}
export function __wbg_json_8d1f3da8fcd11229() { return handleError(function (arg0) {
    const ret = arg0.json();
    return ret;
}, arguments); }
export function __wbg_key_76125a528069feff(arg0, arg1) {
    const ret = arg1.key;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg_left_9df47701ff317a35(arg0) {
    const ret = arg0.left;
    return ret;
}
export function __wbg_length_186163212ffe79c3(arg0) {
    const ret = arg0.length;
    return ret;
}
export function __wbg_length_b03a0fabb109b1e9(arg0) {
    const ret = arg0.length;
    return ret;
}
export function __wbg_lineTo_91262b25fb37c461(arg0, arg1, arg2) {
    arg0.lineTo(arg1, arg2);
}
export function __wbg_localStorage_6827cfe6db14a9f6() { return handleError(function (arg0) {
    const ret = arg0.localStorage;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}, arguments); }
export function __wbg_message_43d8c8f1d543a349(arg0) {
    const ret = arg0.message;
    return ret;
}
export function __wbg_metaKey_33c588e07fd74724(arg0) {
    const ret = arg0.metaKey;
    return ret;
}
export function __wbg_moveTo_b4cd3b0b7e1585a5(arg0, arg1, arg2) {
    arg0.moveTo(arg1, arg2);
}
export function __wbg_new_0_36d738a0c8cfac43() {
    const ret = new Date();
    return ret;
}
export function __wbg_new_13de428334042d26(arg0) {
    const ret = new Uint8Array(arg0);
    return ret;
}
export function __wbg_new_277c27c26f94cbc2() { return handleError(function () {
    const ret = new Headers();
    return ret;
}, arguments); }
export function __wbg_new_37eb45aaf5eeb820() {
    const ret = new Array();
    return ret;
}
export function __wbg_new_3e95cd7386bb9a6c(arg0) {
    const ret = new Date(arg0);
    return ret;
}
export function __wbg_new_7075786089b89c5e() {
    const ret = new Map();
    return ret;
}
export function __wbg_new_787b9fb330d55d78(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return ret;
}
export function __wbg_new_96baed0986e0d99f() { return handleError(function (arg0, arg1) {
    const ret = new URL(getStringFromWasm0(arg0, arg1));
    return ret;
}, arguments); }
export function __wbg_new_ac231c0bf4d6ca13(arg0) {
    const ret = new Number(arg0);
    return ret;
}
export function __wbg_new_ba40181b3f24ac80(arg0, arg1) {
    try {
        var state0 = {a: arg0, b: arg1};
        var cb0 = (arg0, arg1) => {
            const a = state0.a;
            state0.a = 0;
            try {
                return wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Function_fn_wasm_bindgen_4e861026eaa78e23___JsValue_____wasm_bindgen_4e861026eaa78e23___sys__Undefined___js_sys_60a38aa43395d722___Function_fn_wasm_bindgen_4e861026eaa78e23___JsValue_____wasm_bindgen_4e861026eaa78e23___sys__Undefined_______true_(a, state0.b, arg0, arg1);
            } finally {
                state0.a = a;
            }
        };
        const ret = new Promise(cb0);
        return ret;
    } finally {
        state0.a = 0;
    }
}
export function __wbg_new_bb74001155cb8ca8() {
    const ret = new Error();
    return ret;
}
export function __wbg_new_cd4348290afae586() {
    const ret = new Object();
    return ret;
}
export function __wbg_new_d72daa1c90ded389() { return handleError(function (arg0, arg1) {
    const ret = new WebSocket(getStringFromWasm0(arg0, arg1));
    return ret;
}, arguments); }
export function __wbg_new_typed_e09da9dae6ee5935(arg0, arg1) {
    try {
        var state0 = {a: arg0, b: arg1};
        var cb0 = (arg0, arg1) => {
            const a = state0.a;
            state0.a = 0;
            try {
                return wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Function_fn_wasm_bindgen_4e861026eaa78e23___JsValue_____wasm_bindgen_4e861026eaa78e23___sys__Undefined___js_sys_60a38aa43395d722___Function_fn_wasm_bindgen_4e861026eaa78e23___JsValue_____wasm_bindgen_4e861026eaa78e23___sys__Undefined_______true_(a, state0.b, arg0, arg1);
            } finally {
                state0.a = a;
            }
        };
        const ret = new Promise(cb0);
        return ret;
    } finally {
        state0.a = 0;
    }
}
export function __wbg_new_with_byte_offset_and_length_3cd32055a417f095(arg0, arg1, arg2) {
    const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
    return ret;
}
export function __wbg_new_with_options_bdb564c0b1ac6378() { return handleError(function (arg0, arg1, arg2) {
    const ret = new Notification(getStringFromWasm0(arg0, arg1), arg2);
    return ret;
}, arguments); }
export function __wbg_new_with_src_e7990850ea897fac() { return handleError(function (arg0, arg1) {
    const ret = new Audio(getStringFromWasm0(arg0, arg1));
    return ret;
}, arguments); }
export function __wbg_new_with_str_and_init_d9f6b5611184e16b() { return handleError(function (arg0, arg1, arg2) {
    const ret = new Request(getStringFromWasm0(arg0, arg1), arg2);
    return ret;
}, arguments); }
export function __wbg_nextElementSibling_758a2a7370bec999(arg0) {
    const ret = arg0.nextElementSibling;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_next_178c1651c11432b3(arg0) {
    const ret = arg0.next;
    return ret;
}
export function __wbg_next_af5ac6a08bb0a717() { return handleError(function (arg0) {
    const ret = arg0.next();
    return ret;
}, arguments); }
export function __wbg_now_463ac581d2fc7ea3() {
    const ret = Date.now();
    return ret;
}
export function __wbg_of_027eb15371aac932(arg0) {
    const ret = Array.of(arg0);
    return ret;
}
export function __wbg_of_e7ea0fcd535c1444(arg0, arg1) {
    const ret = Array.of(arg0, arg1);
    return ret;
}
export function __wbg_offsetHeight_91ca9e2be23502e5(arg0) {
    const ret = arg0.offsetHeight;
    return ret;
}
export function __wbg_offsetWidth_ec7d4ad6adc7e29d(arg0) {
    const ret = arg0.offsetWidth;
    return ret;
}
export function __wbg_ok_670a05555db5f713(arg0) {
    const ret = arg0.ok;
    return ret;
}
export function __wbg_ownKeys_c9890d5405932253() { return handleError(function (arg0) {
    const ret = Reflect.ownKeys(arg0);
    return ret;
}, arguments); }
export function __wbg_parentElement_300cdd39ce1d95f8(arg0) {
    const ret = arg0.parentElement;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_parentNode_fe15bcc26df42856(arg0) {
    const ret = arg0.parentNode;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_parse_db19ce9de46824f7(arg0, arg1) {
    const ret = Date.parse(getStringFromWasm0(arg0, arg1));
    return ret;
}
export function __wbg_play_26a96ac37b543ddc() { return handleError(function (arg0) {
    const ret = arg0.play();
    return ret;
}, arguments); }
export function __wbg_pointerId_79742963a7afa662(arg0) {
    const ret = arg0.pointerId;
    return ret;
}
export function __wbg_preventDefault_cfb06b02e7406899(arg0) {
    arg0.preventDefault();
}
export function __wbg_protocol_e7b9813a6bd3e53b(arg0, arg1) {
    const ret = arg1.protocol;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg_prototypesetcall_13162965d1fe7aa3(arg0, arg1, arg2) {
    Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
}
export function __wbg_push_c9f4893fc209f768(arg0, arg1) {
    const ret = arg0.push(arg1);
    return ret;
}
export function __wbg_querySelector_72201b7c62dc196b() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.querySelector(getStringFromWasm0(arg1, arg2));
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}, arguments); }
export function __wbg_queueMicrotask_1e8503a8a690f0a3(arg0) {
    const ret = arg0.queueMicrotask;
    return ret;
}
export function __wbg_queueMicrotask_4a1a4d8dd332373b(arg0) {
    queueMicrotask(arg0);
}
export function __wbg_race_d17769ed306b5623(arg0) {
    const ret = Promise.race(arg0);
    return ret;
}
export function __wbg_random_df36b90cd78a7d54() {
    const ret = Math.random();
    return ret;
}
export function __wbg_readyState_039bc047141a5f6d(arg0) {
    const ret = arg0.readyState;
    return ret;
}
export function __wbg_rect_ab5601e64afdbc33(arg0, arg1, arg2, arg3, arg4) {
    arg0.rect(arg1, arg2, arg3, arg4);
}
export function __wbg_releasePointerCapture_263e0cebe8686539() { return handleError(function (arg0, arg1) {
    arg0.releasePointerCapture(arg1);
}, arguments); }
export function __wbg_removeAttribute_735f25a801a701e1() { return handleError(function (arg0, arg1, arg2) {
    arg0.removeAttribute(getStringFromWasm0(arg1, arg2));
}, arguments); }
export function __wbg_removeEventListener_4e20bd5fac3de092() { return handleError(function (arg0, arg1, arg2, arg3) {
    arg0.removeEventListener(getStringFromWasm0(arg1, arg2), arg3);
}, arguments); }
export function __wbg_removeProperty_24e2a492b137f2d7() { return handleError(function (arg0, arg1, arg2, arg3) {
    const ret = arg1.removeProperty(getStringFromWasm0(arg2, arg3));
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}, arguments); }
export function __wbg_remove_8228e91d7ddbc755(arg0) {
    arg0.remove();
}
export function __wbg_remove_b28d816f9e896ff9(arg0) {
    arg0.remove();
}
export function __wbg_requestFullscreen_beaad5c2d16558f3() { return handleError(function (arg0) {
    arg0.requestFullscreen();
}, arguments); }
export function __wbg_resolve_dbf78ab4942478b0(arg0) {
    const ret = Promise.resolve(arg0);
    return ret;
}
export function __wbg_respond_d97c023ee981d1f5() { return handleError(function (arg0, arg1) {
    arg0.respond(arg1 >>> 0);
}, arguments); }
export function __wbg_restore_f322d9dcee2d3472(arg0) {
    arg0.restore();
}
export function __wbg_save_1375b4c2f3596b8b(arg0) {
    arg0.save();
}
export function __wbg_scrollIntoView_168afe76e10ce285(arg0, arg1) {
    arg0.scrollIntoView(arg1 !== 0);
}
export function __wbg_setAttribute_f75317b2b5cabfb4() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
    arg0.setAttribute(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
}, arguments); }
export function __wbg_setInterval_1da2f113c48389af() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.setInterval(arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_setItem_cfa3cb31f271776a() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
    arg0.setItem(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
}, arguments); }
export function __wbg_setPointerCapture_49f83ce093912db8() { return handleError(function (arg0, arg1) {
    arg0.setPointerCapture(arg1);
}, arguments); }
export function __wbg_setProperty_3fe74e09d53acb0b() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
    arg0.setProperty(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
}, arguments); }
export function __wbg_setTime_489e3ad30cde4cff(arg0, arg1) {
    const ret = arg0.setTime(arg1);
    return ret;
}
export function __wbg_setTimeout_9ef22b48643bd7de() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.setTimeout(arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_setTransform_ee8f5d076fcdec0f() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
    arg0.setTransform(arg1, arg2, arg3, arg4, arg5, arg6);
}, arguments); }
export function __wbg_set_2793479888329cb6() { return handleError(function (arg0, arg1, arg2) {
    const ret = Reflect.set(arg0, arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_set_8282f7e0d2d01336(arg0, arg1, arg2) {
    const ret = arg0.set(arg1, arg2);
    return ret;
}
export function __wbg_set_bcb0ec2400cfa22e() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
    arg0.set(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
}, arguments); }
export function __wbg_set_body_36d695514d0e1984(arg0, arg1, arg2) {
    arg0.body = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_d2d33b52458e984a(arg0, arg1, arg2) {
    arg0[arg1 >>> 0] = arg2;
}
export function __wbg_set_e4b9a833d288759a(arg0, arg1, arg2) {
    arg0[arg1] = arg2;
}
export function __wbg_set_feb3714f475485ba(arg0, arg1, arg2) {
    arg0.set(getArrayU8FromWasm0(arg1, arg2));
}
export function __wbg_set_fillStyle_95fde67582a9c695(arg0, arg1, arg2) {
    arg0.fillStyle = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_font_aa0c0c514c73a5fa(arg0, arg1, arg2) {
    arg0.font = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_headers_headers_7347469fc32769b6(arg0, arg1) {
    arg0.headers = arg1;
}
export function __wbg_set_height_ae0610d318c3428c(arg0, arg1) {
    arg0.height = arg1 >>> 0;
}
export function __wbg_set_icon_53886614f76f387f(arg0, arg1, arg2) {
    arg0.icon = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_innerHTML_a9d3a267967b5117(arg0, arg1, arg2) {
    arg0.innerHTML = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_lineWidth_12f039d09cd36dad(arg0, arg1) {
    arg0.lineWidth = arg1;
}
export function __wbg_set_method_639e69af35614d36(arg0, arg1, arg2) {
    arg0.method = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_mode_07e051ad8b4e2126(arg0, arg1) {
    arg0.mode = __wbindgen_enum_RequestMode[arg1];
}
export function __wbg_set_nodeValue_7e9217115013d873(arg0, arg1, arg2) {
    arg0.nodeValue = arg1 === 0 ? undefined : getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_onclose_078935cf8d0fb024(arg0, arg1) {
    arg0.onclose = arg1;
}
export function __wbg_set_onerror_f7f089f7f059501c(arg0, arg1) {
    arg0.onerror = arg1;
}
export function __wbg_set_onmessage_26abc49cfa5f9ffc(arg0, arg1) {
    arg0.onmessage = arg1;
}
export function __wbg_set_onopen_757be120cc7b1ea6(arg0, arg1) {
    arg0.onopen = arg1;
}
export function __wbg_set_strokeStyle_b90c8a6e0d37c80d(arg0, arg1, arg2) {
    arg0.strokeStyle = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_textAlign_0a32c51401892c11(arg0, arg1, arg2) {
    arg0.textAlign = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_textBaseline_ff2e3c5c84684b23(arg0, arg1, arg2) {
    arg0.textBaseline = getStringFromWasm0(arg1, arg2);
}
export function __wbg_set_width_5f89a551b5472887(arg0, arg1) {
    arg0.width = arg1 >>> 0;
}
export function __wbg_shiftKey_a6ce93ef743d5834(arg0) {
    const ret = arg0.shiftKey;
    return ret;
}
export function __wbg_stack_575c4e0918581b9c(arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg_static_accessor_GLOBAL_THIS_003ee833af9699fc() {
    const ret = typeof globalThis === 'undefined' ? undefined : globalThis;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_GLOBAL_e4293fb22cbe77da() {
    const ret = typeof global === 'undefined' ? undefined : global;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_SELF_53bb20457401453d() {
    const ret = typeof self === 'undefined' ? undefined : self;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_WINDOW_b5e0810bfecb7feb() {
    const ret = typeof window === 'undefined' ? undefined : window;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_status_cb85b6c8d1769fa1(arg0) {
    const ret = arg0.status;
    return ret;
}
export function __wbg_stopPropagation_e4181c041abda4c3(arg0) {
    arg0.stopPropagation();
}
export function __wbg_stringify_0a0fbf2ef722380a() { return handleError(function (arg0) {
    const ret = JSON.stringify(arg0);
    return ret;
}, arguments); }
export function __wbg_stroke_19fa3f3ec093bc25(arg0) {
    arg0.stroke();
}
export function __wbg_style_f499e599ac70277f(arg0) {
    const ret = arg0.style;
    return ret;
}
export function __wbg_tagName_775bb05619a5c52f(arg0, arg1) {
    const ret = arg1.tagName;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg_target_e5cd9c7aa87dd8df(arg0) {
    const ret = arg0.target;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_text_5240eb2c41de8292() { return handleError(function (arg0) {
    const ret = arg0.text();
    return ret;
}, arguments); }
export function __wbg_then_656f253a5dd7d8ea(arg0, arg1, arg2) {
    const ret = arg0.then(arg1, arg2);
    return ret;
}
export function __wbg_then_e3f7f2d365708be8(arg0, arg1) {
    const ret = arg0.then(arg1);
    return ret;
}
export function __wbg_toISOString_51ebc75332aba76a(arg0) {
    const ret = arg0.toISOString();
    return ret;
}
export function __wbg_toLocaleTimeString_f4bdd1298bc01606(arg0, arg1, arg2) {
    const ret = arg0.toLocaleTimeString(getStringFromWasm0(arg1, arg2));
    return ret;
}
export function __wbg_top_2d45cda4e060d8bf(arg0) {
    const ret = arg0.top;
    return ret;
}
export function __wbg_value_df0a0e29a4d182fe(arg0, arg1) {
    const ret = arg1.value;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
    getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
}
export function __wbg_value_e0f328965e184931(arg0) {
    const ret = arg0.value;
    return ret;
}
export function __wbg_view_3b708d3bdaf3fc96(arg0) {
    const ret = arg0.view;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_warn_228ff2257384d295(arg0) {
    console.warn(arg0);
}
export function __wbg_width_babc5dc7654771b1(arg0) {
    const ret = arg0.width;
    return ret;
}
export function __wbindgen_generic_0000000000000001(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 2685, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___wasm_bindgen_4e861026eaa78e23___JsValue______true_);
    return ret;
}
export function __wbindgen_generic_0000000000000002(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 2757, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___wasm_bindgen_4e861026eaa78e23___JsValue__core_d941ad8722425d2e___result__Result_____wasm_bindgen_4e861026eaa78e23___JsError___true_);
    return ret;
}
export function __wbindgen_generic_0000000000000003(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("Array<any>")], shim_idx: 404, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Array______true_);
    return ret;
}
export function __wbindgen_generic_0000000000000004(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("Event")], shim_idx: 2685, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___wasm_bindgen_4e861026eaa78e23___JsValue______true__64);
    return ret;
}
export function __wbindgen_generic_0000000000000005(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("KeyboardEvent")], shim_idx: 404, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Array______true__65);
    return ret;
}
export function __wbindgen_generic_0000000000000006(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("MessageEvent")], shim_idx: 2659, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___web_sys_d20684c57d4bd39b___features__gen_CloseEvent__CloseEvent______true_);
    return ret;
}
export function __wbindgen_generic_0000000000000007(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("MouseEvent")], shim_idx: 404, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Array______true__67);
    return ret;
}
export function __wbindgen_generic_0000000000000008(arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [], shim_idx: 2684, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(arg0, arg1, wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke_______true_);
    return ret;
}
export function __wbindgen_generic_0000000000000009(arg0) {
    // Cast intrinsic for `F64 -> Externref`.
    const ret = arg0;
    return ret;
}
export function __wbindgen_generic_000000000000000a(arg0) {
    // Cast intrinsic for `I64 -> Externref`.
    const ret = arg0;
    return ret;
}
export function __wbindgen_generic_000000000000000b(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_generic_000000000000000c(arg0) {
    // Cast intrinsic for `U64 -> Externref`.
    const ret = BigInt.asUintN(64, arg0);
    return ret;
}
export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_externrefs;
    table.set(0, undefined);
    table.set(1024, undefined);
    table.set(1025, null);
    table.set(1026, true);
    table.set(1027, false);
}
function wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke_______true_(arg0, arg1) {
    wasm.wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke_______true_(arg0, arg1);
}

function wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___wasm_bindgen_4e861026eaa78e23___JsValue______true_(arg0, arg1, arg2) {
    wasm.wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___wasm_bindgen_4e861026eaa78e23___JsValue______true_(arg0, arg1, arg2);
}

function wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Array______true_(arg0, arg1, arg2) {
    wasm.wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Array______true_(arg0, arg1, arg2);
}

function wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___wasm_bindgen_4e861026eaa78e23___JsValue______true__64(arg0, arg1, arg2) {
    wasm.wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___wasm_bindgen_4e861026eaa78e23___JsValue______true__64(arg0, arg1, arg2);
}

function wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Array______true__65(arg0, arg1, arg2) {
    wasm.wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Array______true__65(arg0, arg1, arg2);
}

function wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___web_sys_d20684c57d4bd39b___features__gen_CloseEvent__CloseEvent______true_(arg0, arg1, arg2) {
    wasm.wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___web_sys_d20684c57d4bd39b___features__gen_CloseEvent__CloseEvent______true_(arg0, arg1, arg2);
}

function wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Array______true__67(arg0, arg1, arg2) {
    wasm.wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Array______true__67(arg0, arg1, arg2);
}

function wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___wasm_bindgen_4e861026eaa78e23___JsValue__core_d941ad8722425d2e___result__Result_____wasm_bindgen_4e861026eaa78e23___JsError___true_(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___wasm_bindgen_4e861026eaa78e23___JsValue__core_d941ad8722425d2e___result__Result_____wasm_bindgen_4e861026eaa78e23___JsError___true_(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Function_fn_wasm_bindgen_4e861026eaa78e23___JsValue_____wasm_bindgen_4e861026eaa78e23___sys__Undefined___js_sys_60a38aa43395d722___Function_fn_wasm_bindgen_4e861026eaa78e23___JsValue_____wasm_bindgen_4e861026eaa78e23___sys__Undefined_______true_(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen_4e861026eaa78e23___convert__closures_____invoke___js_sys_60a38aa43395d722___Function_fn_wasm_bindgen_4e861026eaa78e23___JsValue_____wasm_bindgen_4e861026eaa78e23___sys__Undefined___js_sys_60a38aa43395d722___Function_fn_wasm_bindgen_4e861026eaa78e23___JsValue_____wasm_bindgen_4e861026eaa78e23___sys__Undefined_______true_(arg0, arg1, arg2, arg3);
}


const __wbindgen_enum_ReadableStreamType = ["bytes"];


const __wbindgen_enum_RequestMode = ["same-origin", "no-cors", "cors", "navigate"];
const IntoUnderlyingByteSourceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingbytesource_free(ptr, 1));
const IntoUnderlyingSinkFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingsink_free(ptr, 1));
const IntoUnderlyingSourceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingsource_free(ptr, 1));
const OfiBookCalculatorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_ofibookcalculator_free(ptr, 1));
const TradeClassifierCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_tradeclassifiercore_free(ptr, 1));
const VpinCalculatorCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_vpincalculatorcore_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_destroy_closure(state.a, state.b));

function debugString(val) {
    switch (typeof val) {
        // primitive types
        case 'number':
        case 'boolean':
        case 'undefined':
        return `${val}`;
        case 'string':
        return JSON.stringify(val);
        case 'bigint':
        return `${val}n`;
        case 'symbol':
        return val.description !== undefined
            ? `Symbol(${val.description})`
            : 'Symbol';
        case 'function':
        return typeof val.name === 'string' && val.name !== ''
            ? `Function(${val.name})`
            : 'Function';
        case 'object': {
            if (val === null) {
                return 'null';
            }
            // objects
            if (Array.isArray(val)) {
                return '[' + Array.from(val, debugString).join(', ') + ']';
            }
            // errors
            if (val instanceof Error) {
                return `${val.name}: ${val.message}\n${val.stack}`;
            }

            const toStringOutput = toString.call(val);
            // Test for built-in
            const className = /\[object ([^\]]+)\]/.exec(toStringOutput)?.[1];

            // Failed to match the standard '[object ClassName]'
            if (className === undefined) {
                return toStringOutput;
            }
            if (className === 'Object') {
                // we're a user defined class or Object
                // JSON.stringify avoids problems with cycles, and is generally much
                // easier than looping through ownProperties of `val`.
                try {
                    return 'Object(' + JSON.stringify(val) + ')';
                } catch (_) {
                    return 'Object';
                }
            }
            // TODO we could test for more things here, like `Set`s and `Map`s.
            return className;
        }
        // Per MDN: 'This list of values is exhaustive.'
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof#description
    }
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_destroy_closure(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;


let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}
