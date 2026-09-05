import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDepthStream } from '@/hooks/useDepthStream';

/**
 * Minimal controllable WebSocket double. `close()` fires `onclose` like a
 * server-initiated disconnect, which is exactly the path the reconnect logic
 * must handle; teardown paths null the handlers before closing, so the double
 * must respect nulled handlers to stay honest.
 */
class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    url: string;
    readyState = FakeWebSocket.CONNECTING;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    closed = false;

    constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    close(): void {
        this.closed = true;
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.();
    }

    static reset(): void {
        FakeWebSocket.instances = [];
    }

    static last(): FakeWebSocket {
        const socket = FakeWebSocket.instances.at(-1);
        if (!socket) throw new Error('no FakeWebSocket was constructed');
        return socket;
    }

    open(): void {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }

    message(payload: unknown): void {
        this.onmessage?.({ data: JSON.stringify(payload) });
    }
}

const depthPayload = {
    lastUpdateId: 160,
    bids: [['42000.10', '0.500'], ['41999.00', '1.250']],
    asks: [['42001.00', '0.750'], ['42002.50', '2.000']],
};

describe('useDepthStream', () => {
    const originalWebSocket = global.WebSocket;

    beforeEach(() => {
        vi.useFakeTimers();
        FakeWebSocket.reset();
        vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
    });

    afterEach(() => {
        vi.stubGlobal('WebSocket', originalWebSocket);
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const mountConsumer = (symbol: string) => renderHook(
        ({ value }: { value: string }) => useDepthStream(value),
        { initialProps: { value: symbol } },
    );

    const openAndDeliver = (socket: FakeWebSocket, payload: unknown = depthPayload) => {
        act(() => socket.open());
        act(() => socket.message(payload));
    };

    it('shares one depth20 socket between consumers of the same symbol', () => {
        const first = mountConsumer('BTCUSDT');
        const second = mountConsumer('btcusdt');

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(FakeWebSocket.last().url).toBe('wss://data-stream.binance.vision/ws/btcusdt@depth20@100ms');
        expect(first.result.current.isConnected).toBe(false);
        expect(second.result.current.isConnected).toBe(false);
    });

    it('fans a parsed snapshot out to every listener with normalized numeric levels', () => {
        const first = mountConsumer('BTCUSDT');
        const second = mountConsumer('BTCUSDT');
        const socket = FakeWebSocket.last();
        openAndDeliver(socket);

        for (const consumer of [first, second]) {
            const { book, isConnected } = consumer.result.current;
            expect(isConnected).toBe(true);
            expect(book).toMatchObject({ symbol: 'BTCUSDT', lastUpdateId: 160 });
            expect(book?.bids).toEqual([
                { price: 42_000.1, quantity: 0.5 },
                { price: 41_999, quantity: 1.25 },
            ]);
            expect(book?.asks).toEqual([
                { price: 42_001, quantity: 0.75 },
                { price: 42_002.5, quantity: 2 },
            ]);
            expect(typeof book?.receivedAt).toBe('number');
        }
    });

    it('sorts levels defensively regardless of upstream ordering', () => {
        const { result } = mountConsumer('BTCUSDT');
        const socket = FakeWebSocket.last();
        openAndDeliver(socket, {
            lastUpdateId: 161,
            bids: [['41999.00', '1.250'], ['42000.10', '0.500']],
            asks: [['42002.50', '2.000'], ['42001.00', '0.750']],
        });

        expect(result.current.book?.bids.map((level) => level.price)).toEqual([42_000.1, 41_999]);
        expect(result.current.book?.asks.map((level) => level.price)).toEqual([42_001, 42_002.5]);
    });

    it('keeps the socket alive while any consumer remains and closes after the last', () => {
        const first = mountConsumer('BTCUSDT');
        const second = mountConsumer('BTCUSDT');
        const socket = FakeWebSocket.last();

        first.unmount();
        expect(socket.closed).toBe(false);

        second.unmount();
        expect(socket.closed).toBe(true);
    });

    it('routes new snapshots to the remaining consumer after a partial unmount', () => {
        const first = mountConsumer('BTCUSDT');
        const second = mountConsumer('BTCUSDT');
        const socket = FakeWebSocket.last();

        first.unmount();
        openAndDeliver(socket, { ...depthPayload, lastUpdateId: 200 });

        expect(second.result.current.book?.lastUpdateId).toBe(200);
    });

    it('hands a late-joining consumer the latest book immediately', () => {
        const first = mountConsumer('BTCUSDT');
        const socket = FakeWebSocket.last();
        openAndDeliver(socket, { ...depthPayload, lastUpdateId: 300 });
        expect(first.result.current.book?.lastUpdateId).toBe(300);

        const second = mountConsumer('BTCUSDT');

        expect(second.result.current.book?.lastUpdateId).toBe(300);
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('opens no socket for an empty symbol', () => {
        mountConsumer('');

        expect(FakeWebSocket.instances).toHaveLength(0);
    });

    it('reconnects after a server close and restores the live status', () => {
        const { result } = mountConsumer('BTCUSDT');
        const socket = FakeWebSocket.last();
        openAndDeliver(socket);
        expect(result.current.isConnected).toBe(true);

        // Server-side disconnect: handlers are intact, so the feed must
        // schedule its own reconnect.
        act(() => socket.close());
        expect(result.current.isConnected).toBe(false);

        act(() => { vi.advanceTimersByTime(1_000); });
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(FakeWebSocket.last().readyState).toBe(0);

        openAndDeliver(FakeWebSocket.last());
        expect(result.current.isConnected).toBe(true);
        expect(result.current.book).toMatchObject({ lastUpdateId: 160 });
    });

    it('ignores malformed snapshots and keeps the previous book', () => {
        const { result } = mountConsumer('BTCUSDT');
        const socket = FakeWebSocket.last();
        openAndDeliver(socket);
        expect(result.current.book).not.toBeNull();

        act(() => socket.message({ lastUpdateId: 161, bids: [['x', '1']], asks: [] }));
        expect(result.current.book?.lastUpdateId).toBe(160);
    });

    it('opens a separate feed per symbol and closes the old one on switch', () => {
        const { rerender, unmount } = renderHook(
            ({ value }: { value: string }) => useDepthStream(value),
            { initialProps: { value: 'BTCUSDT' } },
        );
        act(() => { FakeWebSocket.last().open(); });

        rerender({ value: 'ETHUSDT' });

        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(FakeWebSocket.instances[0]?.closed).toBe(true);
        expect(FakeWebSocket.instances[1]?.url).toBe('wss://data-stream.binance.vision/ws/ethusdt@depth20@100ms');
        unmount();
    });
});
