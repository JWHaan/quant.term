import {
    calculateEMA,
    calculateRSI,
    calculateMACD,
    calculateATR,
    calculateBollingerBands,
    calculateADX,
    calculateOBV,
    calculateHurst,
    calculateVWAP
} from '../utils/indicators';

// Define input message format
export interface AlphaWorkerInput {
    symbol: string;
    data: any[]; // Raw OHLCV data
}

// Define output message format
export interface AlphaWorkerOutput {
    symbol: string;
    regime: 'TRENDING' | 'MEAN_REVERSION' | 'RANDOM_WALK';
    marketCondition: 'BULL' | 'BEAR' | 'STATIC' | 'VOLATILE';
    hurst: number;
    adx: number;
    rsi: number;
    atrPercent: number;
    obvTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    scores: {
        trend: number;
        momentum: number;
        volatility: number;
        volume: number;
        total: number;
    };
}

self.onmessage = (e: MessageEvent<AlphaWorkerInput>) => {
    const { symbol, data: rawData } = e.data;

    if (!rawData || rawData.length < 200) {
        return;
    }

    try {
        // Parse data if needed (assuming pre-parsed for now, but let's be safe)
        // The main thread sends pre-parsed {time, open, high, low, close, volume} objects
        const data = rawData;

        // --- CALCULATIONS ---

        // 1. Hurst Exponent (Regime)
        const hurst = calculateHurst(data);
        let regime: AlphaWorkerOutput['regime'] = 'RANDOM_WALK';
        if (hurst > 0.55) regime = 'TRENDING';
        else if (hurst < 0.45) regime = 'MEAN_REVERSION';

        // 2. Trend Factors (ADX, EMA Slope)
        const adxData = calculateADX(data, 14);
        const adx = adxData[adxData.length - 1]?.value || 0;

        const ema50 = calculateEMA(data, 50);
        const lastEMA = ema50[ema50.length - 1]?.value || 0;
        const prevEMA = ema50[ema50.length - 10]?.value || 0;
        const emaSlope = (lastEMA - prevEMA) / prevEMA;

        let trendScore = 0;
        if (adx > 25) trendScore += 50;
        if (Math.abs(emaSlope) > 0.005) trendScore += 50 * Math.sign(emaSlope);

        // 3. Momentum Factors (RSI, MACD)
        const rsiData = calculateRSI(data, 14);
        const rsi = rsiData[rsiData.length - 1]?.value || 50;

        const macdData = calculateMACD(data);
        const macd = macdData[macdData.length - 1];

        let momScore = 0;
        if (rsi > 50) momScore += 25; else momScore -= 25;
        if (macd && macd.histogram > 0) momScore += 25; else momScore -= 25;

        // 4. Volatility Factors (ATR, BB Width)
        const atrData = calculateATR(data, 14);
        const atr = atrData[atrData.length - 1]?.value || 0;
        const lastClose = data[data.length - 1].close;
        const atrPercent = (atr / lastClose) * 100;

        const bbData = calculateBollingerBands(data, 20, 2);
        const bb = bbData[bbData.length - 1];
        const bbWidth = bb ? (bb.upper - bb.lower) / bb.middle : 0;

        let volScore = 0;
        if (atrPercent > 1) volScore += 50;
        if (bbWidth > 0.05) volScore += 50;

        // 5. Volume Factors (OBV, VWAP)
        const obvData = calculateOBV(data);
        const obvLast = obvData[obvData.length - 1]?.value || 0;
        const obvPrev = obvData[obvData.length - 20]?.value || 0;
        const obvChange = obvLast - obvPrev;

        const vwapData = calculateVWAP(data);
        const vwap = vwapData[vwapData.length - 1]?.value || 0;
        const priceToVwap = (lastClose - vwap) / vwap;

        let volmScore = 0;
        if (obvChange > 0) volmScore += 50; else volmScore -= 50;
        if (priceToVwap > 0) volmScore += 25; else volmScore -= 25;

        const obvTrend = obvChange > 0 ? 'BULLISH' : obvChange < 0 ? 'BEARISH' : 'NEUTRAL';

        // 6. Market Condition Logic
        let marketCondition: AlphaWorkerOutput['marketCondition'] = 'STATIC';

        // Simple SMA50 logic for trend direction
        const isAboveSMA = lastClose > lastEMA;

        if (atrPercent > 1.5) {
            marketCondition = 'VOLATILE';
        } else if (isAboveSMA && rsi > 55) {
            marketCondition = 'BULL';
        } else if (!isAboveSMA && rsi < 45) {
            marketCondition = 'BEAR';
        } else {
            marketCondition = 'STATIC';
        }

        const totalScore = (trendScore * 0.4) + (momScore * 0.3) + (volmScore * 0.3);

        const result: AlphaWorkerOutput = {
            symbol,
            regime,
            marketCondition,
            hurst,
            adx,
            rsi,
            atrPercent,
            obvTrend,
            scores: {
                trend: trendScore,
                momentum: momScore,
                volatility: volScore,
                volume: volmScore,
                total: Math.max(-100, Math.min(100, totalScore))
            }
        };

        self.postMessage(result);

    } catch (error) {
        console.error('Worker calculation failed:', error);
    }
};
