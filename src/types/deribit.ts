/**
 * Type definitions for Deribit API
 * Documentation: https://docs.deribit.com/
 */

/** Options Instrument Data */
export interface OptionsInstrument {
    instrument_name: string;
    kind: 'option' | 'future';
    option_type?: 'call' | 'put';
    strike?: number;
    expiration_timestamp: number;
    creation_timestamp: number;
    is_active: boolean;
    settlement_period: string;
    base_currency: string;
    quote_currency: string;
    min_trade_amount: number;
    tick_size: number;
    block_trade_commission: number;
}

/** Greeks Data (Delta, Gamma, Vega, Theta, Rho) */
export interface GreeksData {
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
    rho: number;
    timestamp: number;
}

/** Implied Volatility Data */
export interface ImpliedVolatilityData {
    instrument_name: string;
    mark_iv: number; // Mark implied volatility
    bid_iv: number; // Bid implied volatility
    ask_iv: number; // Ask implied volatility
    underlying_price: number;
    timestamp: number;
}

/** Options Order Book */
export interface OptionsOrderBook {
    instrument_name: string;
    timestamp: number;
    bids: [number, number][]; // [price, amount]
    asks: [number, number][]; // [price, amount]
    mark_price: number;
    mark_iv: number;
    best_bid_price: number;
    best_ask_price: number;
    best_bid_amount: number;
    best_ask_amount: number;
    open_interest: number;
}

/** Block Trade Data */
export interface BlockTrade {
    trade_id: string;
    timestamp: number;
    instrument_name: string;
    direction: 'buy' | 'sell';
    amount: number;
    price: number;
    iv: number; // Implied volatility
    index_price: number;
    underlying_price: number;
}

/** Ticker Data for Options */
export interface OptionsTicker {
    instrument_name: string;
    timestamp: number;
    state: 'open' | 'closed';
    settlement_price?: number;
    open_interest: number;
    min_price: number;
    max_price: number;
    mark_price: number;
    mark_iv: number;
    last_price: number;
    interest_rate: number;
    greeks: GreeksData;
    estimated_delivery_price: number;
    bid_iv: number;
    ask_iv: number;
    best_bid_price: number;
    best_ask_price: number;
    best_bid_amount: number;
    best_ask_amount: number;
    stats: {
        volume: number;
        volume_usd: number;
        price_change: number;
        low: number;
        high: number;
    };
}

/** Volatility Surface Data Point */
export interface VolatilitySurfacePoint {
    strike: number;
    expiration: number; // Days to expiration
    impliedVolatility: number;
    delta?: number;
}

/** WebSocket Subscription Message */
export interface DeribitSubscription {
    jsonrpc: '2.0';
    method: 'public/subscribe';
    params: {
        channels: string[];
    };
    id: number;
}

/** WebSocket Notification */
export interface DeribitNotification {
    jsonrpc: '2.0';
    method: 'subscription';
    params: {
        channel: string;
        data: OptionsTicker | OptionsOrderBook | BlockTrade;
    };
}

/** API Error Response */
export interface DeribitError {
    code: number;
    message: string;
    data?: unknown;
}
