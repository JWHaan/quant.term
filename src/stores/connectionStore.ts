import { create } from 'zustand';
import type { ConnectionState, ConnectionStatus, ConnectionInfo } from '@/types/stores';

/**
 * Connection Store
 * Tracks the status of various WebSocket connections (Binance, Deribit, etc.)
 * Used to display global health status of the terminal
 * 
 * Features:
 * - Per-service connection status tracking
 * - Latency monitoring
 * - Reconnection attempt counting
 * - Global health computation
 */
export const useConnectionStore = create<ConnectionState>((set, get) => ({
    // State
    connections: {
        binance: 'disconnected',
        deribit: 'disconnected',
        marketData: 'disconnected',
        futures: 'disconnected',
        depth: 'disconnected',
        trades: 'disconnected'
    },

    connectionInfo: {},

    globalStatus: 'disconnected',

    // Actions
    setConnectionStatus: (source: string, status: ConnectionStatus) => {
        set((state) => {
            const newConnections = { ...state.connections, [source]: status };
            const info = state.connectionInfo[source] ?? {
                status: 'disconnected',
                lastConnected: null,
                lastError: null,
                reconnectAttempts: 0,
                latency: null
            };

            return {
                connections: newConnections,
                connectionInfo: {
                    ...state.connectionInfo,
                    [source]: {
                        ...info,
                        status,
                        lastConnected: status === 'connected' ? Date.now() : info.lastConnected
                    }
                }
            };
        });
        get().updateGlobalStatus();
    },

    setConnectionError: (source: string, error: string) => {
        set((state) => ({
            connectionInfo: {
                ...state.connectionInfo,
                [source]: {
                    ...(state.connectionInfo[source] ?? {
                        status: 'error',
                        lastConnected: null,
                        lastError: null,
                        reconnectAttempts: 0,
                        latency: null
                    }),
                    status: 'error',
                    lastError: error
                }
            },
            connections: {
                ...state.connections,
                [source]: 'error'
            }
        }));
        get().updateGlobalStatus();
    },

    setLatency: (source: string, latency: number) => {
        set((state) => ({
            connectionInfo: {
                ...state.connectionInfo,
                [source]: {
                    ...(state.connectionInfo[source] ?? {
                        status: 'connected',
                        lastConnected: Date.now(),
                        lastError: null,
                        reconnectAttempts: 0,
                        latency: null
                    }),
                    latency
                }
            }
        }));
    },

    incrementReconnectAttempts: (source: string) => {
        set((state) => {
            const info = state.connectionInfo[source];
            if (!info) return state;

            return {
                connectionInfo: {
                    ...state.connectionInfo,
                    [source]: {
                        ...info,
                        reconnectAttempts: info.reconnectAttempts + 1
                    }
                }
            };
        });
    },

    resetReconnectAttempts: (source: string) => {
        set((state) => {
            const info = state.connectionInfo[source];
            if (!info) return state;

            return {
                connectionInfo: {
                    ...state.connectionInfo,
                    [source]: {
                        ...info,
                        reconnectAttempts: 0
                    }
                }
            };
        });
    },

    updateGlobalStatus: () => {
        const { connections } = get();
        const statuses = Object.values(connections);

        let globalStatus: ConnectionStatus;

        if (statuses.every(s => s === 'connected')) {
            globalStatus = 'connected';
        } else if (statuses.some(s => s === 'error')) {
            globalStatus = 'error';
        } else if (statuses.some(s => s === 'reconnecting')) {
            globalStatus = 'reconnecting';
        } else if (statuses.some(s => s === 'connecting')) {
            globalStatus = 'connecting';
        } else {
            globalStatus = 'disconnected';
        }

        set({ globalStatus });
    },

    // Getters
    getConnectionStatus: (source: string): ConnectionStatus => {
        const { connections } = get();
        return connections[source] ?? 'disconnected';
    },

    getConnectionInfo: (source: string): ConnectionInfo | null => {
        const { connectionInfo } = get();
        return connectionInfo[source] ?? null;
    },

    isConnected: (source: string): boolean => {
        const { connections } = get();
        return connections[source] === 'connected';
    },

    isAnyConnected: (): boolean => {
        const { connections } = get();
        return Object.values(connections).some(status => status === 'connected');
    }
}));

export default useConnectionStore;
