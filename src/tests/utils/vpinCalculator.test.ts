import { beforeEach, describe, expect, it } from 'vitest';
import { VPINCalculator } from '@/utils/vpinCalculator';
import type { ClassifiedTrade } from '@/utils/tradeClassifier';

let nextTradeId = 1;

const makeTrade = (
    quantity: number,
    side: ClassifiedTrade['side'],
    timestamp = nextTradeId * 1_000,
): ClassifiedTrade => ({
    id: nextTradeId++,
    price: 100,
    quantity,
    timestamp,
    isBuyerMaker: side === 'sell',
    side,
    classificationMethod: 'exchange',
});

const addBucket = (
    calculator: VPINCalculator,
    buyVolume: number,
    sellVolume: number,
    timestamp: number,
): void => {
    if (buyVolume > 0) calculator.addTrade(makeTrade(buyVolume, 'buy', timestamp));
    if (sellVolume > 0) calculator.addTrade(makeTrade(sellVolume, 'sell', timestamp));
};

describe('VPINCalculator volume buckets', () => {
    beforeEach(() => {
        nextTradeId = 1;
    });

    it('splits a large trade across every full bucket and preserves overflow', () => {
        const calculator = new VPINCalculator(10, 2);

        const result = calculator.addTrade(makeTrade(25, 'buy', 1_000));

        expect(result).toMatchObject({
            vpin: 1,
            toxicity: 'extreme',
            bucketsFilled: 2,
        });
        expect(calculator.getCurrentBucketProgress()).toBe(50);
        expect(calculator.getVPINHistory()).toEqual([{ timestamp: 1_000, vpin: 1 }]);

        const overflowCompletion = calculator.addTrade(makeTrade(5, 'sell', 2_000));
        expect(overflowCompletion).toMatchObject({
            vpin: 0.5,
            toxicity: 'high',
            bucketsFilled: 3,
        });
        expect(calculator.getCurrentBucketProgress()).toBe(0);
        expect(calculator.getVPINHistory()).toEqual([
            { timestamp: 1_000, vpin: 1 },
            { timestamp: 2_000, vpin: 0.5 },
        ]);
    });

    it('allocates both sides correctly when a trade crosses a partial boundary', () => {
        const calculator = new VPINCalculator(10, 1);
        expect(calculator.addTrade(makeTrade(6, 'buy', 1_000))).toBeNull();

        const firstBucket = calculator.addTrade(makeTrade(8, 'sell', 2_000));
        expect(firstBucket).toMatchObject({ vpin: 0.2, toxicity: 'low' });
        expect(calculator.getCurrentBucketProgress()).toBe(40);

        const secondBucket = calculator.addTrade(makeTrade(6, 'buy', 3_000));
        expect(secondBucket).toMatchObject({ vpin: 0.2, toxicity: 'low' });
        expect(calculator.getCurrentBucketProgress()).toBe(0);
    });

    it('reports increasing and decreasing toxicity trends across complete windows', () => {
        const increasing = new VPINCalculator(10, 1);
        addBucket(increasing, 5, 5, 1_000);
        addBucket(increasing, 5, 5, 2_000);
        addBucket(increasing, 10, 0, 3_000);
        addBucket(increasing, 10, 0, 4_000);
        expect(increasing.getVPINTrend(2)).toBe('increasing');

        const decreasing = new VPINCalculator(10, 1);
        addBucket(decreasing, 10, 0, 1_000);
        addBucket(decreasing, 10, 0, 2_000);
        addBucket(decreasing, 5, 5, 3_000);
        addBucket(decreasing, 5, 5, 4_000);
        expect(decreasing.getVPINTrend(2)).toBe('decreasing');
    });

    it('stays stable without two full trend windows and resets all progress', () => {
        const calculator = new VPINCalculator(10, 1);
        addBucket(calculator, 10, 0, 1_000);
        expect(calculator.getVPINTrend(2)).toBe('stable');
        expect(calculator.detectSpike(0.7)).toBe(true);

        calculator.addTrade(makeTrade(4, 'sell', 2_000));
        expect(calculator.getCurrentBucketProgress()).toBe(40);
        calculator.reset();

        expect(calculator.getCurrentBucketProgress()).toBe(0);
        expect(calculator.getVPINHistory()).toEqual([]);
        expect(calculator.detectSpike()).toBe(false);
    });
});
