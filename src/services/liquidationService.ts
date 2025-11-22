/**
 * Binance Futures Liquidation Service
 * Connects to real-time liquidation order stream
 * Source: wss://fstream.binance.com/ws/!forceOrder@arr
 */

export interface Liquidation {
    symbol: string;
    side: string;
    price: number;
    quantity: number;
    value: number;
    time: number;
    isBuy: boolean;
}

export interface LiquidationStats {
    totalLiquidations: number;
    buyLiquidations: number;
    sellLiquidations: number;
    largestLiquidation: number;
    note: string;
}

interface BinanceLiquidationOrder {
    s: string; // Symbol
    S: string; // Side
    p: string; // Price
    q: string; // Quantity
    T: number; // Timestamp
}

interface BinanceLiquidationMessage {
    e: string;
    o: BinanceLiquidationOrder;
}

/**
 * Subscribe to real-time liquidation orders
 * @param onLiquidation - Callback for liquidation events
 * @returns WebSocket connection
 */
export const subscribeLiquidations = (onLiquidation: (liquidation: Liquidation) => void): WebSocket => {
    const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');

    ws.onopen = () => {
        console.log('[LiquidationService] Connected to Binance Futures liquidation stream');
    };

    ws.onmessage = (event: MessageEvent) => {
        try {
            const msg: BinanceLiquidationMessage = JSON.parse(event.data);

            // Binance liquidation format: { e: "forceOrder", o: { ... } }
            if (msg.e === 'forceOrder' && msg.o) {
                const order = msg.o;

                // Transform to our format
                const liquidation: Liquidation = {
                    symbol: order.s,              // Symbol (e.g., BTCUSDT)
                    side: order.S,                // SELL = Long liquidation, BUY = Short liquidation
                    price: parseFloat(order.p),   // Liquidation price
                    quantity: parseFloat(order.q), // Quantity
                    value: parseFloat(order.p) * parseFloat(order.q), // USD value
                    time: order.T,                // Timestamp
                    isBuy: order.S === 'BUY'      // true = short squeeze, false = long liquidation
                };

                onLiquidation(liquidation);
            }
        } catch (error) {
            console.error('[LiquidationService] Parse error:', error);
        }
    };

    ws.onerror = (error: Event) => {
        console.error('[LiquidationService] WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('[LiquidationService] Connection closed');
    };

    return ws;
};

/**
 * Fetch liquidation statistics (aggregated)
 * Note: Binance does not provide historical aggregates via free API
 * This returns a placeholder - consider using Coinglass API with authentication
 */
export const fetchLiquidationStats = async (): Promise<LiquidationStats> => {
    console.warn('[LiquidationService] Aggregated stats not available without paid API');
    return {
        totalLiquidations: 0,
        buyLiquidations: 0,
        sellLiquidations: 0,
        largestLiquidation: 0,
        note: 'Real-time stream only - no historical aggregates from Binance free tier'
    };
};
