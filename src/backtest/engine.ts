import {
    BACKTEST_CONTRACT_VERSION,
    type BacktestCandle,
    type BacktestConfig,
    type BacktestDataset,
    type BacktestEquityPoint,
    type BacktestMetrics,
    type BacktestResult,
    type BacktestTrade,
} from '@/backtest/types';

const BPS_DIVISOR = 10_000;
/** 31_536_000 seconds per year (365 days). */
const SECONDS_PER_YEAR = 31_536_000;

interface OpenPosition {
    entryTime: number;
    entryBarIndex: number;
    entryPrice: number;
    quantity: number;
    entryFee: number;
}

const assertFinitePositive = (value: number, label: string): void => {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${label} must be a finite number greater than zero`);
    }
};

export const validateBacktestInput = (
    candles: BacktestCandle[],
    config: BacktestConfig,
): void => {
    assertFinitePositive(config.initialCapital, 'Initial capital');

    if (!Number.isInteger(config.fastPeriod) || config.fastPeriod < 2) {
        throw new Error('Fast period must be an integer of at least 2');
    }
    if (!Number.isInteger(config.slowPeriod) || config.slowPeriod <= config.fastPeriod) {
        throw new Error('Slow period must be an integer greater than the fast period');
    }
    if (!Number.isFinite(config.feeBps) || config.feeBps < 0 || config.feeBps > 1_000) {
        throw new Error('Fee must be between 0 and 1,000 basis points');
    }
    if (
        !Number.isFinite(config.slippageBps)
        || config.slippageBps < 0
        || config.slippageBps > 1_000
    ) {
        throw new Error('Slippage must be between 0 and 1,000 basis points');
    }
    if (candles.length < config.slowPeriod + 2) {
        throw new Error(`At least ${config.slowPeriod + 2} candles are required`);
    }

    candles.forEach((candle, index) => {
        const values = [candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume];
        if (values.some((value) => !Number.isFinite(value))) {
            throw new Error(`Candle ${index} contains a non-finite value`);
        }
        if (
            candle.open <= 0
            || candle.high <= 0
            || candle.low <= 0
            || candle.close <= 0
            || candle.volume < 0
        ) {
            throw new Error(`Candle ${index} contains an invalid market value`);
        }
        if (
            candle.high < Math.max(candle.open, candle.close)
            || candle.low > Math.min(candle.open, candle.close)
            || candle.low > candle.high
        ) {
            throw new Error(`Candle ${index} has inconsistent OHLC bounds`);
        }
        if (index > 0 && candle.time <= candles[index - 1]!.time) {
            throw new Error('Candle timestamps must be strictly increasing');
        }
    });
};

const calculateSmaSpreads = (
    candles: BacktestCandle[],
    fastPeriod: number,
    slowPeriod: number,
): Array<number | null> => {
    const spreads: Array<number | null> = new Array(candles.length).fill(null);
    let fastSum = 0;
    let slowSum = 0;

    for (let index = 0; index < candles.length; index += 1) {
        const close = candles[index]!.close;
        fastSum += close;
        slowSum += close;

        if (index >= fastPeriod) fastSum -= candles[index - fastPeriod]!.close;
        if (index >= slowPeriod) slowSum -= candles[index - slowPeriod]!.close;

        if (index >= slowPeriod - 1) {
            spreads[index] = (fastSum / fastPeriod) - (slowSum / slowPeriod);
        }
    }

    return spreads;
};

const calculateSharpe = (equityCurve: BacktestEquityPoint[], barsPerYear: number): number => {
    if (equityCurve.length < 3) return 0;

    const returns: number[] = [];
    for (let index = 1; index < equityCurve.length; index += 1) {
        const previous = equityCurve[index - 1]!.equity;
        if (previous > 0) {
            returns.push((equityCurve[index]!.equity / previous) - 1);
        }
    }
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce(
        (sum, value) => sum + ((value - mean) ** 2),
        0,
    ) / (returns.length - 1);
    const deviation = Math.sqrt(variance);
    return deviation === 0 ? 0 : (mean / deviation) * Math.sqrt(barsPerYear);
};

const closePosition = (
    position: OpenPosition,
    exitTime: number,
    exitBarIndex: number,
    rawExitPrice: number,
    cash: number,
    feeRate: number,
    slippageRate: number,
    exitReason: BacktestTrade['exitReason'],
    tradeNumber: number,
): { cash: number; trade: BacktestTrade } => {
    const exitPrice = rawExitPrice * (1 - slippageRate);
    const proceeds = position.quantity * exitPrice;
    const exitFee = proceeds * feeRate;
    const grossPnl = (exitPrice - position.entryPrice) * position.quantity;
    const netPnl = grossPnl - position.entryFee - exitFee;

    return {
        cash: cash + proceeds - exitFee,
        trade: {
            id: `trade-${tradeNumber}`,
            side: 'LONG',
            entryTime: position.entryTime,
            exitTime,
            entryPrice: position.entryPrice,
            exitPrice,
            quantity: position.quantity,
            entryFee: position.entryFee,
            exitFee,
            grossPnl,
            netPnl,
            returnPct: ((exitPrice / position.entryPrice) - 1) * 100,
            barsHeld: exitBarIndex - position.entryBarIndex,
            exitReason,
        },
    };
};

const calculateMetrics = (
    config: BacktestConfig,
    trades: BacktestTrade[],
    equityCurve: BacktestEquityPoint[],
    exposedBars: number,
    barsPerYear: number,
): BacktestMetrics => {
    const finalEquity = equityCurve.at(-1)?.equity ?? config.initialCapital;
    const winningPnl = trades
        .filter((trade) => trade.netPnl > 0)
        .reduce((sum, trade) => sum + trade.netPnl, 0);
    const losingPnl = Math.abs(trades
        .filter((trade) => trade.netPnl < 0)
        .reduce((sum, trade) => sum + trade.netPnl, 0));

    return {
        initialCapital: config.initialCapital,
        finalEquity,
        totalReturnPct: ((finalEquity / config.initialCapital) - 1) * 100,
        maxDrawdownPct: Math.max(0, ...equityCurve.map((point) => point.drawdownPct)),
        totalTrades: trades.length,
        winRatePct: trades.length === 0
            ? 0
            : (trades.filter((trade) => trade.netPnl > 0).length / trades.length) * 100,
        profitFactor: losingPnl === 0 ? null : winningPnl / losingPnl,
        sharpeRatio: calculateSharpe(equityCurve, barsPerYear),
        totalFees: trades.reduce((sum, trade) => sum + trade.entryFee + trade.exitFee, 0),
        exposurePct: (exposedBars / equityCurve.length) * 100,
    };
};

export const runSmaCrossBacktest = (
    candles: BacktestCandle[],
    dataset: BacktestDataset,
    config: BacktestConfig,
): BacktestResult => {
    validateBacktestInput(candles, config);

    const feeRate = config.feeBps / BPS_DIVISOR;
    const slippageRate = config.slippageBps / BPS_DIVISOR;
    const spreads = calculateSmaSpreads(candles, config.fastPeriod, config.slowPeriod);
    const trades: BacktestTrade[] = [];
    const equityCurve: BacktestEquityPoint[] = [];

    let cash = config.initialCapital;
    let position: OpenPosition | null = null;
    let peakEquity = config.initialCapital;
    let exposedBars = 0;

    for (let index = 0; index < candles.length; index += 1) {
        const candle = candles[index]!;

        if (index > 0) {
            const signal = spreads[index - 1];
            const priorSignal = index > 1 ? spreads[index - 2] : null;
            const crossedUp = signal != null && signal > 0 && (priorSignal ?? 0) <= 0;
            const crossedDown = signal != null && signal < 0 && (priorSignal ?? 0) >= 0;

            if (!position && crossedUp) {
                const entryPrice = candle.open * (1 + slippageRate);
                const quantity = cash / (entryPrice * (1 + feeRate));
                const entryNotional = quantity * entryPrice;
                const entryFee = entryNotional * feeRate;
                cash = Math.max(0, cash - entryNotional - entryFee);
                position = {
                    entryTime: candle.time,
                    entryBarIndex: index,
                    entryPrice,
                    quantity,
                    entryFee,
                };
            } else if (position && crossedDown) {
                const closed = closePosition(
                    position,
                    candle.time,
                    index,
                    candle.open,
                    cash,
                    feeRate,
                    slippageRate,
                    'SIGNAL',
                    trades.length + 1,
                );
                cash = closed.cash;
                trades.push(closed.trade);
                position = null;
            }
        }

        if (position) exposedBars += 1;

        let equity = cash + ((position?.quantity ?? 0) * candle.close);
        if (index === candles.length - 1 && position) {
            const closed = closePosition(
                position,
                candle.time,
                index,
                candle.close,
                cash,
                feeRate,
                slippageRate,
                'END_OF_DATA',
                trades.length + 1,
            );
            cash = closed.cash;
            trades.push(closed.trade);
            position = null;
            equity = cash;
        }

        peakEquity = Math.max(peakEquity, equity);
        equityCurve.push({
            time: candle.time,
            equity,
            drawdownPct: peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100,
            positionQuantity: position?.quantity ?? 0,
        });
    }

    return {
        contractVersion: BACKTEST_CONTRACT_VERSION,
        engine: 'TYPESCRIPT_REFERENCE',
        strategy: 'SMA_CROSS_LONG_FLAT',
        dataset,
        config: { ...config },
        metrics: calculateMetrics(
            config,
            trades,
            equityCurve,
            exposedBars,
            SECONDS_PER_YEAR / dataset.intervalSeconds,
        ),
        trades,
        equityCurve,
        diagnostics: {
            deterministic: true,
            executionTiming: 'NEXT_BAR_OPEN',
            priceModel: 'MARKET_WITH_BPS_COSTS',
            warnings: [
                'Synthetic validation data is not evidence of live strategy performance.',
                'This first slice models long/flat market orders only.',
                ...(dataset.source === 'BINANCE_REST'
                    ? ['Real market data may contain exchange outage gaps; listed-pair history carries survivorship bias.']
                    : []),
            ],
        },
    };
};
