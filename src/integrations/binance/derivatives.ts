import {
    normalizeBinanceFuturesPrice,
    normalizeBinanceFuturesQuantity,
} from '@/integrations/binance/contracts';

export interface DerivativesSnapshot {
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    nextFundingTime: number;
    openInterest: number;
    longAccount: number;
    shortAccount: number;
    updatedAt: number;
}

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown, label: string): JsonRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Malformed ${label} response`);
    }
    return value as JsonRecord;
};

const readFiniteNumber = (record: JsonRecord, key: string, label: string): number => {
    const raw = record[key];
    if (raw === null || raw === undefined || raw === '') throw new Error(`Malformed ${label}`);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) throw new Error(`Malformed ${label}`);
    return parsed;
};

const requirePositive = (value: number, label: string): number => {
    if (value <= 0) throw new Error(`Malformed ${label}`);
    return value;
};

export const parseDerivativesSnapshot = (
    premiumPayload: unknown,
    interestPayload: unknown,
    ratiosPayload: unknown,
    expectedFuturesSymbol: string,
    contractMultiplier: number,
    receivedAt = Date.now(),
): DerivativesSnapshot => {
    const premium = asRecord(premiumPayload, 'premium index');
    const interest = asRecord(interestPayload, 'open interest');
    if (!Array.isArray(ratiosPayload) || ratiosPayload.length === 0) {
        throw new Error('Malformed long/short ratio response');
    }
    const ratio = asRecord(ratiosPayload.at(-1), 'long/short ratio');

    const responseSymbols = [premium['symbol'], interest['symbol'], ratio['symbol']]
        .filter((value): value is string => typeof value === 'string');
    if (responseSymbols.some((value) => value !== expectedFuturesSymbol)) {
        throw new Error('Binance Futures returned a mismatched instrument');
    }

    const rawMarkPrice = requirePositive(readFiniteNumber(premium, 'markPrice', 'mark price'), 'mark price');
    const rawIndexPrice = requirePositive(readFiniteNumber(premium, 'indexPrice', 'index price'), 'index price');
    const fundingRate = readFiniteNumber(premium, 'lastFundingRate', 'funding rate');
    const nextFundingTime = requirePositive(readFiniteNumber(premium, 'nextFundingTime', 'funding time'), 'funding time');
    const rawOpenInterest = readFiniteNumber(interest, 'openInterest', 'open interest');
    const longAccount = readFiniteNumber(ratio, 'longAccount', 'long account ratio');
    const shortAccount = readFiniteNumber(ratio, 'shortAccount', 'short account ratio');

    if (rawOpenInterest < 0) throw new Error('Malformed open interest');
    if (longAccount < 0 || longAccount > 1 || shortAccount < 0 || shortAccount > 1) {
        throw new Error('Malformed long/short account ratios');
    }
    if (Math.abs((longAccount + shortAccount) - 1) > 0.02) {
        throw new Error('Inconsistent long/short account ratios');
    }

    return {
        markPrice: normalizeBinanceFuturesPrice(rawMarkPrice, contractMultiplier),
        indexPrice: normalizeBinanceFuturesPrice(rawIndexPrice, contractMultiplier),
        fundingRate,
        nextFundingTime,
        openInterest: normalizeBinanceFuturesQuantity(rawOpenInterest, contractMultiplier),
        longAccount,
        shortAccount,
        updatedAt: receivedAt,
    };
};
