/**
 * Application-wide constants.
 * All magic numbers, URLs, and configuration values live here.
 * Import from this file rather than hardcoding values in components.
 */

// ─── Binance ──────────────────────────────────────────────────────────────────
export const BINANCE_REST_URL = 'https://data-api.binance.vision' as const;
export const BINANCE_WS_URL = 'wss://data-stream.binance.vision' as const;
export const BINANCE_FUTURES_REST_URL = 'https://fapi.binance.com' as const;
export const BINANCE_FUTURES_WS_URL = 'wss://fstream.binance.com/ws' as const;

/** Renamed spot markets retained here so persisted user preferences migrate. */
export const BINANCE_SPOT_SYMBOL_ALIASES: Readonly<Record<string, string>> = {
    MATICUSDT: 'POLUSDT',
    RNDRUSDT: 'RENDERUSDT',
    MKRUSDT: 'SKYUSDT',
    FTMUSDT: 'SUSDT',
};

/** Binance USDⓈ-M uses a 1,000-token contract for SHIB. */
export const BINANCE_FUTURES_SYMBOL_ALIASES: Readonly<Record<string, string>> = {
    SHIBUSDT: '1000SHIBUSDT',
};

export const normalizeBinanceSpotSymbol = (symbol: string): string => {
    const normalized = symbol.toUpperCase();
    return BINANCE_SPOT_SYMBOL_ALIASES[normalized] ?? normalized;
};

export const toBinanceFuturesSymbol = (symbol: string): string => {
    const spotSymbol = normalizeBinanceSpotSymbol(symbol);
    return BINANCE_FUTURES_SYMBOL_ALIASES[spotSymbol] ?? spotSymbol;
};

// ─── WebSocket ────────────────────────────────────────────────────────────────
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
export const WS_INITIAL_RECONNECT_DELAY_MS = 1_000;
export const WS_MAX_RECONNECT_DELAY_MS = 30_000;
export const WS_SYMBOLS_PER_CONNECTION = 10;
export const WS_MESSAGE_BATCH_INTERVAL_MS = 50;

// ─── Market Data ─────────────────────────────────────────────────────────────
export const MARKET_POLL_INTERVAL_MS = 15_000;
export const DEFAULT_SYMBOL = 'BTCUSDT' as const;
export const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'] as const;

// ─── Rate Limits ─────────────────────────────────────────────────────────────
export const BINANCE_MAX_MESSAGES_PER_SECOND = 5;
export const BINANCE_MAX_CONNECTIONS_PER_5MIN = 300;

// ─── UI ───────────────────────────────────────────────────────────────────────
export const STALE_CONNECTION_THRESHOLD_MS = 60_000;
export const LATENCY_THRESHOLDS = {
    excellent: 100,
    good: 250,
    fair: 500,
} as const;
