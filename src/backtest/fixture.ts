import type { BacktestCandle, BacktestFixture } from '@/backtest/types';

const FIXTURE_START_TIME = 1_704_067_200;
const FIXTURE_CANDLE_COUNT = 480;

const round = (value: number, digits: number): number => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const regimeLevel = (index: number): number => {
    if (index < 120) return 42_000 + (index * 18);
    if (index < 240) return 44_160 - ((index - 120) * 24);
    if (index < 360) return 41_280 + ((index - 240) * 20);
    return 43_680 - ((index - 360) * 10);
};

export const checksumCandles = (candles: BacktestCandle[]): string => {
    let hash = 2_166_136_261;
    for (const candle of candles) {
        const row = [
            candle.time,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
        ].join('|');
        for (let index = 0; index < row.length; index += 1) {
            hash ^= row.charCodeAt(index);
            hash = Math.imul(hash, 16_777_619);
        }
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const createSyntheticBtcFixture = (): BacktestFixture => {
    const candles: BacktestCandle[] = [];
    let previousClose = 42_000;

    for (let index = 0; index < FIXTURE_CANDLE_COUNT; index += 1) {
        const close = round(
            regimeLevel(index)
            + (Math.sin(index / 7) * 110)
            + (Math.sin(index / 19) * 60),
            2,
        );
        const open = previousClose;
        const high = round(Math.max(open, close) + 20 + (index % 11), 2);
        const low = round(Math.min(open, close) - 18 - (index % 7), 2);

        candles.push({
            time: FIXTURE_START_TIME + (index * 60),
            open,
            high,
            low,
            close,
            volume: round(20 + (index % 17) + (Math.abs(Math.sin(index / 8)) * 12), 4),
        });
        previousClose = close;
    }

    const first = candles[0]!;
    const last = candles.at(-1)!;
    const checksum = checksumCandles(candles);

    return {
        candles,
        dataset: {
            id: 'btc-synthetic-regimes-v1',
            name: 'BTC/USDT deterministic regime fixture',
            symbol: 'BTCUSDT',
            interval: '1m',
            source: 'SYNTHETIC_FIXTURE',
            checksum,
            candleCount: candles.length,
            startTime: first.time,
            endTime: last.time,
            intervalSeconds: 60,
            fetchedAt: 0,
        },
    };
};
