/**
 * Application-wide constants.
 * All magic numbers, URLs, and configuration values live here.
 * Import from this file rather than hardcoding values in components.
 */

// ─── Binance ──────────────────────────────────────────────────────────────────
export const BINANCE_REST_URL = 'https://api.binance.com' as const;
export const BINANCE_WS_URL = 'wss://stream.binance.com:9443' as const;
export const BINANCE_FUTURES_WS_URL = 'wss://fstream.binance.com/ws' as const;

// ─── WebSocket ────────────────────────────────────────────────────────────────
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
export const WS_INITIAL_RECONNECT_DELAY_MS = 1_000;
export const WS_MAX_RECONNECT_DELAY_MS = 30_000;
export const WS_SYMBOLS_PER_CONNECTION = 10;
export const WS_MESSAGE_BATCH_INTERVAL_MS = 50;

// ─── Market Data ─────────────────────────────────────────────────────────────
export const MARKET_POLL_INTERVAL_MS = 15_000;
export const CANDLE_BUFFER_SIZE = 10_000;
export const TRADE_BUFFER_SIZE = 10_000;
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
