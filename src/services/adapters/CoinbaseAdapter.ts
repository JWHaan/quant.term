import { IMarketDataSource, Ticker, Trade, Candle } from '../../types/DataSource';
import { Money } from '../../types/Money';

export class CoinbaseAdapter implements IMarketDataSource {
    name = 'Coinbase';
    private ws: WebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    private tickerCallbacks: Map<string, (ticker: Ticker) => void> = new Map();
    private tradeCallbacks: Map<string, (trade: Trade) => void> = new Map();

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket('wss://advanced-trade-ws.coinbase.com');

            this.ws.onopen = () => {
                console.log('Coinbase WS Connected');
                this.resubscribe();
                resolve();
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.ws.onerror = (error) => {
                console.error('Coinbase WS Error:', error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log('Coinbase WS Closed');
            };
        });
    }

    async disconnect(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): void {
        this.tickerCallbacks.set(symbol, callback);
        this.subscribe(symbol, 'ticker');
    }

    subscribeTrades(symbol: string, callback: (trade: Trade) => void): void {
        this.tradeCallbacks.set(symbol, callback);
        this.subscribe(symbol, 'market_trades');
    }

    subscribeCandles(_symbol: string, _interval: string, _callback: (candle: Candle) => void): void {
        // Coinbase WS might not support direct candle streams in the same way, 
        // or requires a specific channel. For now, we'll log a warning or implement if known.
        console.warn('Coinbase WS candle subscription not fully implemented in this demo adapter');
    }

    private subscribe(symbol: string, channel: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const msg = {
            type: 'subscribe',
            product_ids: [symbol],
            channel: channel,
        };
        this.ws.send(JSON.stringify(msg));
        this.subscriptions.add(`${channel}:${symbol}`);
    }

    private resubscribe() {
        // Re-send subscriptions on reconnect
        // Implementation omitted for brevity in this demo
    }

    private handleMessage(message: any) {
        if (message.channel === 'ticker') {
            message.events.forEach((event: any) => {
                event.tickers.forEach((ticker: any) => {
                    const symbol = ticker.product_id;
                    const callback = this.tickerCallbacks.get(symbol);
                    if (callback) {
                        callback({
                            symbol,
                            price: Money.from(ticker.price),
                            bid: Money.from(ticker.best_bid),
                            ask: Money.from(ticker.best_ask),
                            volume24h: Money.from(ticker.volume_24h),
                            timestamp: new Date(message.timestamp).getTime(),
                            source: this.name,
                        });
                    }
                });
            });
        } else if (message.channel === 'market_trades') {
            message.events.forEach((event: any) => {
                event.trades.forEach((trade: any) => {
                    const symbol = trade.product_id;
                    const callback = this.tradeCallbacks.get(symbol);
                    if (callback) {
                        callback({
                            id: trade.trade_id,
                            symbol,
                            price: Money.from(trade.price),
                            size: Money.from(trade.size),
                            side: trade.side.toLowerCase(),
                            timestamp: new Date(trade.time).getTime(),
                            source: this.name,
                        });
                    }
                });
            });
        }
    }
}
