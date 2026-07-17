import { afterEach, describe, expect, it, vi } from 'vitest';
import { TradeClassifier, type Trade } from '@/utils/tradeClassifier';

const makeTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: 1,
    price: 100,
    quantity: 2,
    timestamp: 1_000,
    isBuyerMaker: false,
    ...overrides,
});

describe('TradeClassifier.classifyFromExchange', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('maps Binance buyer-maker flags to the aggressive taker side', () => {
        const classifier = new TradeClassifier();
        const aggressiveBuy = classifier.classifyFromExchange(makeTrade({ isBuyerMaker: false }));
        const aggressiveSell = classifier.classifyFromExchange(makeTrade({ id: 2, isBuyerMaker: true }));

        expect(aggressiveBuy).toEqual({
            ...makeTrade({ isBuyerMaker: false }),
            side: 'buy',
            classificationMethod: 'exchange',
        });
        expect(aggressiveSell.side).toBe('sell');
        expect(aggressiveSell.classificationMethod).toBe('exchange');
        expect(classifier.getHistory()).toEqual([aggressiveBuy, aggressiveSell]);
    });

    it('seeds zero-tick classification with the last exchange-classified side', () => {
        const classifier = new TradeClassifier();
        classifier.classifyFromExchange(makeTrade({ isBuyerMaker: true }));

        const zeroTick = classifier.classifyByTickRule(makeTrade({
            id: 2,
            isBuyerMaker: false,
            timestamp: 1_100,
        }));

        expect(zeroTick.side).toBe('sell');
        expect(zeroTick.classificationMethod).toBe('tick');
    });

    it('feeds exchange classifications into volume delta and reset state', () => {
        vi.spyOn(Date, 'now').mockReturnValue(2_000);
        const classifier = new TradeClassifier();
        classifier.classifyFromExchange(makeTrade({ quantity: 5, timestamp: 1_500, isBuyerMaker: false }));
        classifier.classifyFromExchange(makeTrade({ id: 2, quantity: 3, timestamp: 1_600, isBuyerMaker: true }));

        expect(classifier.calculateVolumeDelta(1_000)).toMatchObject({
            buyVolume: 5,
            sellVolume: 3,
            delta: 2,
            deltaPercent: 25,
        });

        classifier.reset();
        expect(classifier.getHistory()).toEqual([]);
        expect(classifier.calculateVolumeDelta(1_000)).toMatchObject({
            buyVolume: 0,
            sellVolume: 0,
            delta: 0,
            deltaPercent: 0,
        });
    });
});
