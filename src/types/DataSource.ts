import { Money } from './Money';

export interface Ticker {
    symbol: string;
    price: Money;
    bid: Money;
    ask: Money;
    volume24h: Money;
    timestamp: number;
    source: string;
}

export interface Trade {
    id: string;
    symbol: string;
    price: Money;
    size: Money;
    side: 'buy' | 'sell';
    timestamp: number;
    source: string;
}

export interface Candle {
    symbol: string;
    interval: string;
    open: Money;
    high: Money;
    low: Money;
    close: Money;
    volume: Money;
    timestamp: number;
    source: string;
}

export interface FundingRate {
    symbol: string;
    rate: number;
    timestamp: number;
    nextFundingTime: number;
    source: string;
}

export interface OnChainMetric {
    metric: string;
    value: number | string;
    timestamp: number;
    source: string;
    metadata?: Record<string, any>;
}

export interface MacroMetric {
    metric: string;
    value: number | string;
    timestamp: number;
    source: string;
    metadata?: Record<string, any>;
}

export interface IMarketDataSource {
    name: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): void;
    subscribeTrades(symbol: string, callback: (trade: Trade) => void): void;
    subscribeCandles(symbol: string, interval: string, callback: (candle: Candle) => void): void;
    fetchFundingRate?(symbol: string): Promise<FundingRate>;
}

export interface IOnChainDataSource {
    name: string;
    fetchMetric(metric: string, params?: any): Promise<OnChainMetric>;
}

export interface IMacroDataSource {
    name: string;
    fetchMetric(metric: string, params?: any): Promise<MacroMetric>;
}
