import { useConnectionStore } from '../stores/connectionStore';

/**
 * Multi-Asset WebSocket Manager
 * Efficiently manages 40+ concurrent crypto symbol feeds
 * 
 * Features:
 * - Connection pooling (max 5 WebSockets, each handling ~10 symbols)
 * - Reconnection logic with exponential backoff
 * - Message batching (updates every 50ms)
 * - Heartbeat monitoring
 * - Automatic subscription management
 */

class MultiAssetWebSocket {
    constructor() {
        this.connections = new Map(); // symbolGroup -> WebSocket
        this.subscribers = new Map(); // symbol -> Set of callbacks
        this.messageQueue = new Map(); // symbol -> latest data
        this.batchTimeout = null;
        this.reconnectAttempts = new Map();
        this.maxReconnectDelay = 30000; // 30 seconds
    }

    /**
     * Subscribe to multiple symbols
     * @param {string[]} symbols - Array of trading pairs (e.g., ['BTCUSDT', 'ETHUSDT'])
     * @param {function} callback - Called with {symbol, data} on updates
     */
    subscribe(symbols, callback) {
        symbols.forEach(symbol => {
            if (!this.subscribers.has(symbol)) {
                this.subscribers.set(symbol, new Set());
            }
            this.subscribers.get(symbol).add(callback);
        });

        // Group symbols for pooled connections
        this._connectSymbols(symbols);
    }

    /**
     * Unsubscribe from symbols
     */
    unsubscribe(symbols, callback) {
        symbols.forEach(symbol => {
            const subs = this.subscribers.get(symbol);
            if (subs) {
                subs.delete(callback);
                if (subs.size === 0) {
                    this.subscribers.delete(symbol);
                    this._disconnectSymbol(symbol);
                }
            }
        });
    }

    /**
     * Connect to symbols using pooled WebSockets
     */
    _connectSymbols(symbols) {
        const SYMBOLS_PER_CONNECTION = 10;

        // Group symbols into batches
        for (let i = 0; i < symbols.length; i += SYMBOLS_PER_CONNECTION) {
            const batch = symbols.slice(i, i + SYMBOLS_PER_CONNECTION);
            const groupKey = `group_${Math.floor(i / SYMBOLS_PER_CONNECTION)}`;

            if (!this.connections.has(groupKey)) {
                this._createConnection(groupKey, batch);
            }
        }
    }

    /**
     * Create a WebSocket connection for a group of symbols
     */
    _createConnection(groupKey, symbols) {
        // Binance combined streams endpoint
        const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
        const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

        useConnectionStore.getState().setConnectionStatus(`marketData_${groupKey}`, 'connecting');
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`[WebSocket] Connected: ${groupKey} (${symbols.length} symbols)`);
            useConnectionStore.getState().setConnectionStatus(`marketData_${groupKey}`, 'connected');
            this.reconnectAttempts.set(groupKey, 0);

            // Start heartbeat
            this._startHeartbeat(groupKey, ws);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.data) {
                    this._handleMessage(message.data);
                }
            } catch (error) {
                console.error('[WebSocket] Parse error:', error);
            }
        };

        ws.onerror = (error) => {
            console.error(`[WebSocket] Error: ${groupKey}`, error);
            useConnectionStore.getState().setConnectionStatus(`marketData_${groupKey}`, 'error');
        };

        ws.onclose = () => {
            console.log(`[WebSocket] Closed: ${groupKey}`);
            useConnectionStore.getState().setConnectionStatus(`marketData_${groupKey}`, 'disconnected');
            this._reconnect(groupKey, symbols);
        };

        this.connections.set(groupKey, { ws, symbols, heartbeat: null });
    }

    /**
     * Handle incoming ticker message
     */
    _handleMessage(data) {
        const symbol = data.s; // Symbol (e.g., 'BTCUSDT')

        // Normalize data
        const normalized = {
            symbol,
            price: parseFloat(data.c), // Current price
            priceChange: parseFloat(data.p), // 24h change
            priceChangePercent: parseFloat(data.P), // 24h change %
            volume: parseFloat(data.v), // 24h volume
            quoteVolume: parseFloat(data.q), // 24h quote volume
            high24h: parseFloat(data.h),
            low24h: parseFloat(data.l),
            openPrice: parseFloat(data.o),
            lastUpdate: Date.now()
        };

        // Add to message queue
        this.messageQueue.set(symbol, normalized);

        // Schedule batch processing
        this._scheduleBatch();
    }

    /**
     * Batch process updates every 50ms
     */
    _scheduleBatch() {
        if (this.batchTimeout) return;

        this.batchTimeout = setTimeout(() => {
            this._processBatch();
            this.batchTimeout = null;
        }, 50); // 50ms batch window
    }

    /**
     * Process batched messages and notify subscribers
     */
    _processBatch() {
        this.messageQueue.forEach((data, symbol) => {
            const subscribers = this.subscribers.get(symbol);
            if (subscribers) {
                subscribers.forEach(callback => {
                    try {
                        callback({ symbol, data });
                    } catch (error) {
                        console.error('[WebSocket] Callback error:', error);
                    }
                });
            }
        });

        this.messageQueue.clear();
    }

    /**
     * Heartbeat to detect dead connections
     */
    _startHeartbeat(groupKey, ws) {
        const connection = this.connections.get(groupKey);
        if (!connection) return;

        connection.heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ method: 'ping' }));
            }
        }, 30000); // 30 seconds
    }

    /**
     * Reconnect with exponential backoff
     */
    _reconnect(groupKey, symbols) {
        const attempts = this.reconnectAttempts.get(groupKey) || 0;
        const delay = Math.min(1000 * Math.pow(2, attempts), this.maxReconnectDelay);

        this.reconnectAttempts.set(groupKey, attempts + 1);

        console.log(`[WebSocket] Reconnecting ${groupKey} in ${delay}ms (attempt ${attempts + 1})`);

        setTimeout(() => {
            this._createConnection(groupKey, symbols);
        }, delay);
    }

    /**
     * Disconnect symbol
     */
    _disconnectSymbol(symbol) {
        // Find which group this symbol belongs to
        for (const [groupKey, connection] of this.connections.entries()) {
            if (connection.symbols.includes(symbol)) {
                connection.symbols = connection.symbols.filter(s => s !== symbol);

                // If no symbols left in group, close connection
                if (connection.symbols.length === 0) {
                    connection.ws.close();
                    if (connection.heartbeat) clearInterval(connection.heartbeat);
                    this.connections.delete(groupKey);
                }
            }
        }
    }

    /**
     * Disconnect all
     */
    disconnectAll() {
        this.connections.forEach((connection, groupKey) => {
            connection.ws.close();
            if (connection.heartbeat) clearInterval(connection.heartbeat);
        });
        this.connections.clear();
        this.subscribers.clear();
        this.messageQueue.clear();
    }
}

// Singleton instance
export const multiAssetWS = new MultiAssetWebSocket();

export default MultiAssetWebSocket;
