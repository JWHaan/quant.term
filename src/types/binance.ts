/**
 * Type definitions for Binance Futures API
 * Documentation: https://binance-docs.github.io/apidocs/futures/en/
 */

/** 24hr Ticker Statistics */
export interface TickerData {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    lastPrice: string;
    lastQty: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}

/** Order Book Depth Update Stream */
export interface OrderBookUpdate {
    e: 'depthUpdate';
    E: number; // Event time
    T: number; // Transaction time
    s: string; // Symbol
    U: number; // First update ID
    u: number; // Final update ID
    pu: number; // Previous final update ID
    b: [string, string][]; // Bids [price, quantity]
    a: [string, string][]; // Asks [price, quantity]
}

/** Aggregated Trade Stream */
export interface TradeData {
    e: 'aggTrade';
    E: number; // Event time
    s: string; // Symbol
    a: number; // Aggregate trade ID
    p: string; // Price
    q: string; // Quantity
    f: number; // First trade ID
    l: number; // Last trade ID
    T: number; // Trade time
    m: boolean; // Is buyer maker
}

/** Kline/Candlestick Data */
export interface KlineData {
    e: 'kline';
    E: number; // Event time
    s: string; // Symbol
    k: {
        t: number; // Kline start time
        T: number; // Kline close time
        s: string; // Symbol
        i: string; // Interval
        f: number; // First trade ID
        L: number; // Last trade ID
        o: string; // Open price
        c: string; // Close price
        h: string; // High price
        l: string; // Low price
        v: string; // Base asset volume
        n: number; // Number of trades
        x: boolean; // Is kline closed
        q: string; // Quote asset volume
        V: string; // Taker buy base asset volume
        Q: string; // Taker buy quote asset volume
    };
}

/** Mark Price Update */
export interface MarkPriceData {
    e: 'markPriceUpdate';
    E: number; // Event time
    s: string; // Symbol
    p: string; // Mark price
    i: string; // Index price
    P: string; // Estimated settle price (only useful in the last hour before settlement)
    r: string; // Funding rate
    T: number; // Next funding time
}

/** Liquidation Order Stream */
export interface LiquidationData {
    e: 'forceOrder';
    E: number; // Event time
    o: {
        s: string; // Symbol
        S: 'BUY' | 'SELL'; // Side
        o: 'LIMIT'; // Order type
        f: 'IOC'; // Time in force
        q: string; // Original quantity
        p: string; // Price
        ap: string; // Average price
        X: string; // Order status
        l: string; // Last filled quantity
        z: string; // Cumulative filled quantity
        T: number; // Trade time
    };
}

/** Rate Limit Information from Headers */
export interface RateLimitInfo {
    usedWeight: number; // X-MBX-USED-WEIGHT-1M
    orderCount: number; // X-MBX-ORDER-COUNT-10S
    retryAfter?: number; // Retry-After header (seconds)
}

/** WebSocket API Error Response */
export interface BinanceWSError {
    code: number;
    msg: string;
}

/** Order Book Snapshot (REST API) */
export interface OrderBookSnapshot {
    lastUpdateId: number;
    E: number; // Message output time
    T: number; // Transaction time
    bids: [string, string][]; // [price, quantity]
    asks: [string, string][]; // [price, quantity]
}

/** Parsed Order Book Level */
export interface OrderBookLevel {
    price: number;
    quantity: number;
    total?: number; // Cumulative quantity
}

/** Normalized Market Data */
export interface MarketData {
    symbol: string;
    price: number;
    priceChange: number;
    priceChangePercent: number;
    volume: number;
    quoteVolume: number;
    high: number;
    low: number;
    timestamp: number;
}
