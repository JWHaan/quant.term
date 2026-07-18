import { describe, expect, it } from 'vitest';
import { parseDerivativesSnapshot } from '@/integrations/binance/derivatives';
import { parseBinanceLiquidation } from '@/integrations/binance/liquidations';
import {
    getBinanceFuturesContract,
    normalizeBinanceFuturesPrice,
    normalizeBinanceFuturesQuantity,
} from '@/integrations/binance/contracts';
import { getAdaptiveBookStep } from '@/utils/orderBookFormatting';

const premium = {
    symbol: '1000SHIBUSDT',
    markPrice: '0.00420000',
    indexPrice: '0.00419000',
    lastFundingRate: '-0.00001831',
    nextFundingTime: 1_784_370_000_000,
};

const interest = {
    symbol: '1000SHIBUSDT',
    openInterest: '100',
};

const ratios = [{
    symbol: '1000SHIBUSDT',
    longAccount: '0.6',
    shortAccount: '0.4',
}];

describe('Binance futures contract normalization', () => {
    it('maps SHIB spot units to the 1000SHIB futures contract', () => {
        expect(getBinanceFuturesContract('shibusdt')).toEqual({
            spotSymbol: 'SHIBUSDT',
            futuresSymbol: '1000SHIBUSDT',
            multiplier: 1000,
        });
        expect(normalizeBinanceFuturesPrice(0.0042, 1000)).toBeCloseTo(0.0000042);
        expect(normalizeBinanceFuturesQuantity(100, 1000)).toBe(100_000);
    });

    it('migrates renamed spot symbols before resolving futures', () => {
        expect(getBinanceFuturesContract('MATICUSDT')).toEqual({
            spotSymbol: 'POLUSDT',
            futuresSymbol: 'POLUSDT',
            multiplier: 1,
        });
    });
});

describe('derivatives API response validation', () => {
    it('normalizes a valid multiplier-contract snapshot to spot units', () => {
        const snapshot = parseDerivativesSnapshot(
            premium,
            interest,
            ratios,
            '1000SHIBUSDT',
            1000,
            1234,
        );

        expect(snapshot.markPrice).toBeCloseTo(0.0000042);
        expect(snapshot.indexPrice).toBeCloseTo(0.00000419);
        expect(snapshot).toMatchObject({
            fundingRate: -0.00001831,
            nextFundingTime: 1_784_370_000_000,
            openInterest: 100_000,
            longAccount: 0.6,
            shortAccount: 0.4,
            updatedAt: 1234,
        });
    });

    it('rejects malformed and mismatched provider payloads', () => {
        expect(() => parseDerivativesSnapshot(
            { ...premium, markPrice: 'not-a-number' },
            interest,
            ratios,
            '1000SHIBUSDT',
            1000,
        )).toThrow('Malformed mark price');

        expect(() => parseDerivativesSnapshot(
            premium,
            { ...interest, symbol: 'BTCUSDT' },
            ratios,
            '1000SHIBUSDT',
            1000,
        )).toThrow('mismatched instrument');
    });
});

describe('liquidation API parsing', () => {
    it('accepts a valid force-order event and rejects bad numerics', () => {
        expect(parseBinanceLiquidation({
            e: 'forceOrder',
            o: {
                s: '1000SHIBUSDT',
                S: 'SELL',
                ap: '0.0042',
                p: '0.0041',
                z: '250',
                l: '0',
                q: '250',
                T: 1_784_370_000_000,
            },
        })).toMatchObject({
            symbol: '1000SHIBUSDT',
            side: 'SELL',
            price: 0.0042,
            quantity: 250,
            value: 1.05,
            isBuy: false,
        });

        expect(parseBinanceLiquidation({
            e: 'forceOrder',
            o: { s: 'BTCUSDT', S: 'BUY', ap: 'NaN', p: '', z: '1', T: 1 },
        })).toBeNull();
    });
});

describe('adaptive order-book aggregation', () => {
    it('keeps useful precision across large and micro-priced instruments', () => {
        expect(getAdaptiveBookStep(64_000)).toBe(1);
        expect(getAdaptiveBookStep(3_500)).toBe(0.1);
        expect(getAdaptiveBookStep(0.0000042)).toBe(0.00000001);
    });
});
