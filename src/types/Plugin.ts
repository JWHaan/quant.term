import { Candle } from './DataSource';

export interface IIndicatorPlugin {
    id: string;
    name: string;
    description: string;
    version: string;
    author?: string;

    /**
     * Calculate indicator values
     * @param candles Array of candles
     * @param options Optional parameters
     * @returns Array of indicator values (aligned with candles)
     */
    calculate(candles: Candle[], options?: any): number[];
}
