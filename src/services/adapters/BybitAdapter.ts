import { IMarketDataSource, Ticker, Trade, Candle } from '../../types/DataSource';
import { Money } from '../../types/Money';

export class BybitAdapter implements IMarketDataSource {
    name = 'Bybit';
    private ws: WebSocket | null = null;
    private tickerCallbacks: Map<string, (ticker: Ticker) => void> = new Map();
    private tradeCallbacks: Map<string, (trade: Trade) => void> = new Map();

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Using Bybit V5 public linear stream as an example
            this.ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

            this.ws.onopen = () => {
                console.log('Bybit WS Connected');
                resolve();
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.ws.onerror = (error) => {
                console.error('Bybit WS Error:', error);
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
        this.subscribe(`tickers.${symbol}`);
    }

    subscribeTrades(symbol: string, callback: (trade: Trade) => void): void {
        this.tradeCallbacks.set(symbol, callback);
        this.subscribe(`publicTrade.${symbol}`);
    }

    subscribeCandles(symbol: string, interval: string, _callback: (candle: Candle) => void): void {
        // Bybit interval format might need mapping
        this.subscribe(`kline.${interval}.${symbol}`);
    }

    private subscribe(topic: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const msg = {
            op: 'subscribe',
            args: [topic],
        };
        this.ws.send(JSON.stringify(msg));
    }

    private handleMessage(message: any) {
        if (message.topic && message.data) {
            if (message.topic.startsWith('tickers.')) {
                const data = message.data;
                const symbol = data.symbol;
                const callback = this.tickerCallbacks.get(symbol);
                if (callback) {
                    callback({
                        symbol,
                        price: Money.from(data.lastPrice),
                        bid: Money.from(data.bid1Price),
                        ask: Money.from(data.ask1Price),
                        volume24h: Money.from(data.volume24h),
                        timestamp: message.ts,
                        source: this.name,
                    });
                }
            } else if (message.topic.startsWith('publicTrade.')) {
                const trades = message.data;
                const symbol = trades[0]?.s; // Assuming all trades in batch are same symbol
                const callback = this.tradeCallbacks.get(symbol);
                if (callback) {
                    trades.forEach((t: any) => {
                        callback({
                            id: t.i,
                            symbol,
                            price: Money.from(t.p),
                            size: Money.from(t.v),
                            side: t.S.toLowerCase(),
                            timestamp: t.T,
                            source: this.name,
                        });
                    });
                }
            }
        }
    }
}
