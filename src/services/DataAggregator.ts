import { IMarketDataSource, IOnChainDataSource, IMacroDataSource, Ticker, Trade } from '../types/DataSource';

export class DataAggregator {
    private marketSources: IMarketDataSource[] = [];
    private onChainSources: IOnChainDataSource[] = [];
    private macroSources: IMacroDataSource[] = [];

    registerMarketSource(source: IMarketDataSource) {
        this.marketSources.push(source);
    }

    registerOnChainSource(source: IOnChainDataSource) {
        this.onChainSources.push(source);
    }

    registerMacroSource(source: IMacroDataSource) {
        this.macroSources.push(source);
    }

    async connectAll() {
        await Promise.all(this.marketSources.map(s => s.connect()));
    }

    async disconnectAll() {
        await Promise.all(this.marketSources.map(s => s.disconnect()));
    }

    subscribeTicker(symbol: string, callback: (ticker: Ticker) => void) {
        this.marketSources.forEach(source => {
            source.subscribeTicker(symbol, callback);
        });
    }

    subscribeTrades(symbol: string, callback: (trade: Trade) => void) {
        this.marketSources.forEach(source => {
            source.subscribeTrades(symbol, callback);
        });
    }

    async fetchOnChainMetric(metric: string, params?: any) {
        // Simple aggregation: try first capable source
        for (const source of this.onChainSources) {
            try {
                return await source.fetchMetric(metric, params);
            } catch (e) {
                continue;
            }
        }
        throw new Error(`No source found for on-chain metric ${metric}`);
    }

    async fetchMacroMetric(metric: string, params?: any) {
        for (const source of this.macroSources) {
            try {
                return await source.fetchMetric(metric, params);
            } catch (e) {
                continue;
            }
        }
        throw new Error(`No source found for macro metric ${metric}`);
    }
}
