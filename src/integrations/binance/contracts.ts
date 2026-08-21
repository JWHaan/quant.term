import {
    normalizeBinanceSpotSymbol,
    toBinanceFuturesSymbol,
} from '@/constants/config';

/** Binance USDⓈ-M contract mapping used by active derivatives feeds. */
export interface BinanceFuturesContract {
    spotSymbol: string;
    futuresSymbol: string;
    multiplier: number;
}

/**
 * Resolve a spot instrument to its USDⓈ-M contract and unit multiplier.
 *
 * Binance names multiplier contracts with a numeric prefix (for example,
 * SHIBUSDT spot maps to 1000SHIBUSDT futures). Normalizing both price and
 * quantity keeps derivatives values comparable with the selected spot asset.
 */
export const getBinanceFuturesContract = (symbol: string): BinanceFuturesContract => {
    const spotSymbol = normalizeBinanceSpotSymbol(symbol);
    const futuresSymbol = toBinanceFuturesSymbol(spotSymbol);
    const spotBase = spotSymbol.replace(/USDT$/, '');
    const futuresBase = futuresSymbol.replace(/USDT$/, '');
    const multiplierMatch = futuresBase.match(/^(\d+)(.+)$/);
    const parsedMultiplier = multiplierMatch?.[2] === spotBase
        ? Number(multiplierMatch[1])
        : 1;
    const multiplier = Number.isFinite(parsedMultiplier) && parsedMultiplier > 0
        ? parsedMultiplier
        : 1;

    return { spotSymbol, futuresSymbol, multiplier };
};

export const normalizeBinanceFuturesPrice = (price: number, multiplier: number): number =>
    price / multiplier;

export const normalizeBinanceFuturesQuantity = (quantity: number, multiplier: number): number =>
    quantity * multiplier;
