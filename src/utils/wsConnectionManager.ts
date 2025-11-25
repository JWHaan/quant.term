/**
 * WebSocket Connection Manager
 * Implements connection pooling and rate limiting to prevent IP bans
 */

interface WSConnection {
    ws: WebSocket;
    symbols: Set<string>;
    messageCount: number;
    lastMessageTime: number;
}

class WebSocketConnectionManager {
    private connections: Map<string, WSConnection> = new Map();
    private readonly MAX_SYMBOLS_PER_WS = 3;
    private readonly MAX_MESSAGES_PER_SECOND = 5;
    private messageQueue: Array<{ ws: WebSocket; data: any }> = [];
    private queueProcessor: NodeJS.Timeout | null = null;

    /**
     * Get or create a WebSocket connection for a symbol
     */
    getConnection(url: string, symbol: string): WebSocket {
        // Find existing connection with capacity
        for (const [key, conn] of this.connections.entries()) {
            if (key.startsWith(url) && conn.symbols.size < this.MAX_SYMBOLS_PER_WS) {
                conn.symbols.add(symbol);
                return conn.ws;
            }
        }

        // Create new connection
        const ws = new WebSocket(url);
        const connKey = `${url}_${Date.now()}`;

        this.connections.set(connKey, {
            ws,
            symbols: new Set([symbol]),
            messageCount: 0,
            lastMessageTime: Date.now()
        });

        ws.addEventListener('close', () => {
            this.connections.delete(connKey);
        });

        return ws;
    }

    /**
     * Send message with rate limiting
     */
    sendWithRateLimit(ws: WebSocket, data: any): void {
        this.messageQueue.push({ ws, data });

        if (!this.queueProcessor) {
            this.startQueueProcessor();
        }
    }

    private startQueueProcessor(): void {
        this.queueProcessor = setInterval(() => {
            if (this.messageQueue.length === 0) {
                if (this.queueProcessor) {
                    clearInterval(this.queueProcessor);
                    this.queueProcessor = null;
                }
                return;
            }

            // Process up to MAX_MESSAGES_PER_SECOND messages
            const batch = this.messageQueue.splice(0, this.MAX_MESSAGES_PER_SECOND);

            batch.forEach(({ ws, data }) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(data));
                }
            });
        }, 1000); // Process every second
    }

    /**
     * Cleanup all connections
     */
    cleanup(): void {
        for (const conn of this.connections.values()) {
            if (conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.close();
            }
        }
        this.connections.clear();

        if (this.queueProcessor) {
            clearInterval(this.queueProcessor);
            this.queueProcessor = null;
        }
    }

    /**
     * Remove symbol from connection pool
     */
    removeSymbol(symbol: string): void {
        for (const [key, conn] of this.connections.entries()) {
            if (conn.symbols.has(symbol)) {
                conn.symbols.delete(symbol);

                // Close connection if no symbols left
                if (conn.symbols.size === 0) {
                    conn.ws.close();
                    this.connections.delete(key);
                }
            }
        }
    }
}

export const wsManager = new WebSocketConnectionManager();
