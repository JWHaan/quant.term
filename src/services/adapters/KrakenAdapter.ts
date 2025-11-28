import { IMarketDataSource, Ticker, Trade, Candle } from '../../types/DataSource';
import { Money } from '../../types/Money';

export class KrakenAdapter implements IMarketDataSource {
    name = 'Kraken';
    private ws: WebSocket | null = null;
    private tickerCallbacks: Map<string, (ticker: Ticker) => void> = new Map();
    private tradeCallbacks: Map<string, (trade: Trade) => void> = new Map();

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket('wss://ws.kraken.com');

            this.ws.onopen = () => {
                console.log('Kraken WS Connected');
                resolve();
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.ws.onerror = (error) => {
                console.error('Kraken WS Error:', error);
                reject(error);
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
        this.subscribe(symbol, 'trade');
    }

    subscribeCandles(_symbol: string, _interval: string, _callback: (candle: Candle) => void): void {
        // Kraken uses 'ohlc' subscription
        console.warn('Kraken candle subscription not fully implemented');
    }

    private subscribe(symbol: string, subscriptionName: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const msg = {
            event: 'subscribe',
            pair: [symbol],
            subscription: {
                name: subscriptionName,
            },
        };
        this.ws.send(JSON.stringify(msg));
    }

    private handleMessage(message: any) {
        if (Array.isArray(message)) {
            const [_channelID, data, channelName, pair] = message;

            // Kraken message format varies by channel
            if (channelName === 'ticker') {
                // data format: { a: [ask, ...], b: [bid, ...], c: [close, ...], v: [vol, ...], ... }
                const callback = this.tickerCallbacks.get(pair);
                if (callback) {
                    callback({
                        symbol: pair,
                        price: Money.from(data.c[0]),
                        bid: Money.from(data.b[0]),
                        ask: Money.from(data.a[0]),
                        volume24h: Money.from(data.v[1]), // v[1] is 24h volume
                        timestamp: Date.now(), // Kraken ticker doesn't always send timestamp in the payload
                        source: this.name,
                    });
                }
            } else if (channelName === 'trade') {
                // data is array of trades: [[price, volume, time, side, type, misc], ...]
                const callback = this.tradeCallbacks.get(pair);
                if (callback) {
                    data.forEach((t: any) => {
                        callback({
                            id: `${t[2]}-${t[0]}`, // Synthetic ID
                            symbol: pair,
                            price: Money.from(t[0]),
                            size: Money.from(t[1]),
                            side: t[3] === 'b' ? 'buy' : 'sell',
                            timestamp: Math.floor(parseFloat(t[2]) * 1000),
                            source: this.name,
                        });
                    });
                }
            }
        }
    }
}
