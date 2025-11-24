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
export type AlertCondition = 'above' | 'below' | 'crosses_above' | 'crosses_below' | 'equals';

/** Alert Configuration */
export interface Alert {
    id: string;
    symbol: string;
    type: AlertType;
    condition: AlertCondition;
    value: number;
    message: string;
    enabled: boolean;
    triggered: boolean;
    createdAt: number;
    lastTriggered?: number;
    soundEnabled: boolean;
    notificationEnabled: boolean;
}

/** Alert Store State */
export interface AlertState {
    // State
    alerts: Alert[];
    triggeredAlerts: string[]; // Alert IDs
    history: Array<Alert & { triggeredAt: number }>;

    // Actions
    addAlert: (alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>) => string;
    removeAlert: (id: string) => void;
    toggleAlert: (id: string) => void;
    updateAlert: (id: string, updates: Partial<Alert>) => void;
    triggerAlert: (id: string) => void;
    clearTriggeredAlerts: () => void;
    clearAlerts: () => void;
    checkAlerts: (symbol: string, price: number, indicators?: Record<string, number>) => void;
    checkMarketConditions: (marketData: any) => void;

    // Getters
    getAlertsBySymbol: (symbol: string) => Alert[];
    getActiveAlerts: () => Alert[];
    getHistory: () => Array<Alert & { triggeredAt: number }>;
    clearHistory: () => void;
}

/** Portfolio Position */
export interface Position {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    currentPrice: number;
    leverage: number;
    pnl: number;
    pnlPercent: number;
    liquidationPrice?: number;
    timestamp: number;
    status: 'OPEN' | 'CLOSED';
    exitPrice?: number;
    exitTime?: number;
}

/** Portfolio Store State */
export interface PortfolioState {
    // State
    positions: Position[];
    totalPnl: number;
    totalPnlPercent: number;
    accountBalance: number;

    // Actions
    addPosition: (position: Omit<Position, 'pnl' | 'pnlPercent' | 'timestamp'>) => void;
    removePosition: (symbol: string) => void;
    updatePosition: (symbol: string, updates: Partial<Position>) => void;
    updatePrices: (prices: Record<string, number>) => void;
    setAccountBalance: (balance: number) => void;
    clearPositions: () => void;

    // Getters
    getPosition: (symbol: string) => Position | null;
    getTotalExposure: () => number;
}

/** Connection Status */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

/** Connection Info */
export interface ConnectionInfo {
    status: ConnectionStatus;
    lastConnected: number | null;
    lastError: string | null;
    reconnectAttempts: number;
    latency: number | null;
}

/** Connection Store State */
export interface ConnectionState {
    // State
    connections: Record<string, ConnectionStatus>;
    connectionInfo: Record<string, ConnectionInfo>;
    globalStatus: ConnectionStatus;

    // Actions
    setConnectionStatus: (source: string, status: ConnectionStatus) => void;
    setConnectionError: (source: string, error: string) => void;
    setLatency: (source: string, latency: number) => void;
    incrementReconnectAttempts: (source: string) => void;
    resetReconnectAttempts: (source: string) => void;
    updateGlobalStatus: () => void;

    // Getters
    getConnectionStatus: (source: string) => ConnectionStatus;
    getConnectionInfo: (source: string) => ConnectionInfo | null;
    isConnected: (source: string) => boolean;
    isAnyConnected: () => boolean;
}
