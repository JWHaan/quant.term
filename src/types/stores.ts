/**
 * Type definitions for Zustand stores
 */

import type { MarketData } from './binance';

/** Market Store State */
export interface MarketState {
    // State
    selectedSymbol: string;
    watchlist: string[];
    marketData: Record<string, MarketData>;
    lastUpdate: number | null;

    // Actions
    setSymbol: (symbol: string) => void;
    addToWatchlist: (symbol: string) => void;
    removeFromWatchlist: (symbol: string) => void;
    reorderWatchlist: (fromIndex: number, toIndex: number) => void;
    updateMarketData: (symbol: string, data: Partial<MarketData>) => void;
    clearMarketData: () => void;

    // Getters
    getMarketData: (symbol: string) => MarketData | null;
    isInWatchlist: (symbol: string) => boolean;
}

/** Alert Types */
export type AlertType = 'price' | 'indicator' | 'volume' | 'ofi' | 'signal' | 'liquidation';

/** Alert Condition */
export type AlertCondition = 'above' | 'below' | 'equals';

/** Alert Configuration */
export interface Alert {
    id: string;
    symbol: string;
    type: AlertType;
    condition: AlertCondition;
    value: number | string;
    message: string;
    enabled: boolean;
    triggered: boolean;
    createdAt: number;
    lastTriggered?: number;
    soundEnabled: boolean;
    notificationEnabled: boolean;
    indicator?: 'rsi' | 'macd' | 'volumeRatio' | 'ofi' | 'liquidation';
}

export interface MarketConditionPayload {
    symbol: string;
    price: number;
    rsi?: number;
    macd?: number;
    volumeRatio?: number;
    signal?: string;
    ofi?: number;
    liquidation?: number;
}

/** Alert Store State */
export interface AlertState {
    // State
    alerts: Alert[];
    triggeredAlerts: string[]; // Alert IDs
    history: Array<Alert & { triggeredAt: number }>;
    // New alias for backward compatibility
    alertHistory: Array<Alert & { triggeredAt: number }>;

    // Actions
    addAlert: (alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>) => string;
    removeAlert: (id: string) => void;
    toggleAlert: (id: string) => void;
    updateAlert: (id: string, updates: Partial<Alert>) => void;
    triggerAlert: (id: string) => void;
    clearTriggeredAlerts: () => void;
    clearAlerts: () => void;

    checkMarketConditions: (marketData: MarketConditionPayload) => void;
    // Returns IDs of triggered alerts for testing
    checkAlerts: (symbol: string, price: number, marketData?: { rsi?: number; macd?: number; volumeRatio?: number; signal?: string; ofi?: number; liquidation?: number }) => string[];

    // Getters
    getAlertsBySymbol: (symbol: string) => Alert[];
    getActiveAlerts: () => Alert[];
    getHistory: () => Array<Alert & { triggeredAt: number }>;
    clearHistory: () => void;
    requestNotificationPermission: () => Promise<string>;
}

/** Connection Status */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

/** Connection Store State */
export interface ConnectionState {
    connections: Record<string, ConnectionStatus>;
    setConnectionStatus: (source: string, status: ConnectionStatus) => void;
}
