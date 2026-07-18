import { useConnectionStore } from '@/stores/connectionStore';
import type { ConnectionStatus } from '@/types/stores';

/** A lightweight telemetry observation emitted for every real exchange message. */
export interface LiveMarketEvent {
    source: string;
    receivedAt: number;
    latencyMs: number | null;
    symbol: string | null;
}

type LiveMarketListener = (event: LiveMarketEvent) => void;

const listeners = new Set<LiveMarketListener>();
const connectionOwners = new Map<string, Map<object, ConnectionStatus>>();
const lastPublishedStatus = new Map<string, ConnectionStatus>();

const aggregateStatus = (statuses: ConnectionStatus[]): ConnectionStatus => {
    if (statuses.some((status) => status === 'connected')) return 'connected';
    if (statuses.some((status) => status === 'reconnecting')) return 'reconnecting';
    if (statuses.some((status) => status === 'connecting')) return 'connecting';
    if (statuses.some((status) => status === 'error')) return 'error';
    return 'disconnected';
};

const publishConnectionStatus = (source: string): void => {
    const owners = connectionOwners.get(source);
    const status = owners ? aggregateStatus(Array.from(owners.values())) : 'disconnected';

    if (lastPublishedStatus.get(source) === status) return;
    lastPublishedStatus.set(source, status);
    useConnectionStore.getState().setConnectionStatus(source, status);
};

/**
 * Tracks connection state per hook instance, so one healthy subscriber keeps a
 * shared source healthy when another subscriber is reconnecting or unmounts.
 */
export const reportLiveConnection = (
    source: string,
    owner: object,
    status: ConnectionStatus,
): void => {
    const owners = connectionOwners.get(source) ?? new Map<object, ConnectionStatus>();
    owners.set(owner, status);
    connectionOwners.set(source, owners);
    publishConnectionStatus(source);
};

export const releaseLiveConnection = (source: string, owner: object): void => {
    const owners = connectionOwners.get(source);
    if (!owners) return;

    owners.delete(owner);
    if (owners.size === 0) connectionOwners.delete(source);
    publishConnectionStatus(source);
};

/** Publish message timing sourced from the exchange payload, never a REST ping. */
export const recordLiveMarketEvent = (
    source: string,
    exchangeTimestamp?: number,
    symbol?: string,
): void => {
    const receivedAt = Date.now();
    const validExchangeTimestamp =
        typeof exchangeTimestamp === 'number' &&
        Number.isFinite(exchangeTimestamp) &&
        exchangeTimestamp > 1_000_000_000_000;

    const event: LiveMarketEvent = {
        source,
        receivedAt,
        latencyMs: validExchangeTimestamp
            ? Math.max(0, receivedAt - exchangeTimestamp)
            : null,
        symbol: symbol ? symbol.toUpperCase() : null,
    };

    listeners.forEach((listener) => listener(event));
};

export const subscribeToLiveMarketEvents = (listener: LiveMarketListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
