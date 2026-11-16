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
export function __wbg___wbindgen_is_function_741ff2bb612836f5(arg0) {
    const ret = typeof(arg0) === 'function';
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
export function __wbg_call_40b008ba32f73991() { return handleError(function (arg0, arg1) {
    const ret = arg0.call(arg1);
    return ret;
}, arguments); }
export function __wbg_done_57e08d0be6e30c02(arg0) {
    const ret = arg0.done;
    return ret;
}
export function __wbg_entries_7bb1459bd9b5c2b9(arg0) {
    const ret = Object.entries(arg0);
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
export function __wbg_isArray_bcf1376d0d732d08(arg0) {
    const ret = Array.isArray(arg0);
    return ret;
}
export function __wbg_isSafeInteger_1a35ba4d31e71d38(arg0) {
    const ret = Number.isSafeInteger(arg0);
    return ret;
}
export function __wbg_iterator_e4c5e8f68ada7b58() {
    const ret = Symbol.iterator;
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
export function __wbg_new_13de428334042d26(arg0) {
    const ret = new Uint8Array(arg0);
    return ret;
}
export function __wbg_new_37eb45aaf5eeb820() {
    const ret = new Array();
    return ret;
}
export function __wbg_new_787b9fb330d55d78(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return ret;
}
export function __wbg_new_cd4348290afae586() {
    const ret = new Object();
    return ret;
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
export function __wbg_ownKeys_c9890d5405932253() { return handleError(function (arg0) {
    const ret = Reflect.ownKeys(arg0);
    return ret;
}, arguments); }
export function __wbg_prototypesetcall_13162965d1fe7aa3(arg0, arg1, arg2) {
    Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
}
export function __wbg_push_c9f4893fc209f768(arg0, arg1) {
    const ret = arg0.push(arg1);
    return ret;
}
export function __wbg_set_2793479888329cb6() { return handleError(function (arg0, arg1, arg2) {
    const ret = Reflect.set(arg0, arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_set_d2d33b52458e984a(arg0, arg1, arg2) {
    arg0[arg1 >>> 0] = arg2;
}
export function __wbg_set_e4b9a833d288759a(arg0, arg1, arg2) {
    arg0[arg1] = arg2;
}
export function __wbg_value_e0f328965e184931(arg0) {
    const ret = arg0.value;
    return ret;
}
export function __wbindgen_generic_0000000000000001(arg0) {
    // Cast intrinsic for `F64 -> Externref`.
    const ret = arg0;
    return ret;
}
export function __wbindgen_generic_0000000000000002(arg0) {
    // Cast intrinsic for `I64 -> Externref`.
    const ret = arg0;
    return ret;
}
export function __wbindgen_generic_0000000000000003(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_generic_0000000000000004(arg0) {
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
