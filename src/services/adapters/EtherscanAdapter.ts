// @ts-nocheck: Deprecated scaffold file — suppressed for type checking — not wired into the UI, may have stale types
/**
 * @deprecated Not wired into the UI. Scaffold for future roadmap phases.
 * Kept for reference — delete when ready.
 */

import { IOnChainDataSource, OnChainMetric } from '../../types/DataSource';

export class EtherscanAdapter implements IOnChainDataSource {
    name = 'Etherscan';
    private apiKey: string;
    private baseUrl = 'https://api.etherscan.io/api';

    constructor(apiKey: string = 'YourApiKeyToken') {
        this.apiKey = apiKey;
    }

    async fetchMetric(metric: string, _params?: any): Promise<OnChainMetric> {
        // Example: fetch gas price or wallet balance
        void _params;
        if (metric === 'gasPrice') {
            const url = `${this.baseUrl}?module=gastracker&action=gasoracle&apikey=${this.apiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === '1') {
                return {
                    metric: 'gasPrice',
                    value: data.result.ProposeGasPrice,
                    timestamp: Date.now(),
                    source: this.name,
                    metadata: {
                        safeGasPrice: data.result.SafeGasPrice,
                        fastGasPrice: data.result.FastGasPrice,
                    }
                };
            }
        }

        throw new Error(`Metric ${metric} not supported or failed to fetch`);
    }
}
