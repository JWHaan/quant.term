import { create } from 'zustand';
import type { ConnectionState, ConnectionStatus } from '@/types/stores';

/** Shared status telemetry for active public data feeds. */
export const useConnectionStore = create<ConnectionState>((set) => ({
    connections: {
        binance: 'disconnected',
        marketData: 'disconnected',
        futures: 'disconnected',
        depth: 'disconnected',
        trades: 'disconnected',
    },

    setConnectionStatus: (source: string, status: ConnectionStatus) => {
        set((state) => ({
            connections: { ...state.connections, [source]: status },
        }));
    },
}));

export default useConnectionStore;
