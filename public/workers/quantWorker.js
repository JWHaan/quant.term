/**
 * Quant Worker - Offloads heavy computations from main thread
 * Handles: Indicator calculations, correlation analysis, backtesting
 */

// Import indicator calculation functions (we'll inline them for the worker)
const calculateRSI = (data, period = 14) => {
    if (!data || data.length < period + 1) return [];
    
    const rsiData = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const firstRSI = 100 - (100 / (1 + firstRS));
    rsiData.push({ time: data[period].time, value: firstRSI });

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        rsiData.push({ time: data[i].time, value: rsi });
    }

    return rsiData;
};

const calculateEMA = (data, period = 12) => {
    if (!data || data.length < period) return [];
    
    const k = 2 / (period + 1);
    const emaData = [];

    let ema = data.slice(0, period).reduce((acc, val) => acc + val.close, 0) / period;
    emaData.push({ time: data[period - 1].time, value: ema });

    for (let i = period; i < data.length; i++) {
        ema = data[i].close * k + ema * (1 - k);
        emaData.push({ time: data[i].time, value: ema });
    }

    return emaData;
};

const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    if (!data || data.length < slowPeriod + signalPeriod) return [];
    
    const calculateEMAValues = (values, period) => {
        if (values.length === 0) return [];
        const k = 2 / (period + 1);
        const emaArray = [values[0]];
        for (let i = 1; i < values.length; i++) {
            emaArray.push(values[i] * k + emaArray[i - 1] * (1 - k));
        }
        return emaArray;
    };

    const closes = data.map(d => d.close);
    const fastEMA = calculateEMAValues(closes, fastPeriod);
    const slowEMA = calculateEMAValues(closes, slowPeriod);

    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
        if (i >= slowPeriod - 1) {
            macdLine.push(fastEMA[i] - slowEMA[i]);
        } else {
            macdLine.push(null);
        }
    }

    const validMacd = macdLine.filter(v => v !== null);
    const signalLine = calculateEMAValues(validMacd, signalPeriod);

    const macdData = [];
    let signalIndex = 0;

    for (let i = 0; i < data.length; i++) {
        if (i >= slowPeriod - 1 + signalPeriod - 1 && signalIndex < signalLine.length) {
            const macd = macdLine[i];
            const signal = signalLine[signalIndex];

            if (macd !== null && macd !== undefined && signal !== undefined) {
                macdData.push({
                    time: data[i].time,
                    macd: macd,
                    signal: signal,
                    histogram: macd - signal
                });
                signalIndex++;
            }
        }
    }

    return macdData;
};

const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
    if (!data || data.length < period) return [];
    
    const bbData = [];

    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const sum = slice.reduce((acc, val) => acc + val.close, 0);
        const mean = sum / period;

        const squaredDiffs = slice.map(val => Math.pow(val.close - mean, 2));
        const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
        const sd = Math.sqrt(variance);

        bbData.push({
            time: data[i].time,
            middle: mean,
            upper: mean + (sd * stdDev),
            lower: mean - (sd * stdDev)
        });
    }

    return bbData;
};

const calculateATR = (data, period = 14) => {
    if (!data || data.length < period + 1) return [];
    
    const trValues = [];

    for (let i = 1; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i - 1].close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trValues.push(tr);
    }

    let atr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const atrData = [{ time: data[period].time, value: atr }];

    for (let i = period; i < trValues.length; i++) {
        atr = ((atr * (period - 1)) + trValues[i]) / period;
        atrData.push({ time: data[i + 1].time, value: atr });
    }

    return atrData;
};

// Correlation calculation
const calculateCorrelation = (pricesA, pricesB) => {
    const len = Math.min(pricesA.length, pricesB.length);
    if (len < 10) return 0;

    const s1 = pricesA.slice(-len);
    const s2 = pricesB.slice(-len);

    const mean1 = s1.reduce((a, b) => a + b, 0) / len;
    const mean2 = s2.reduce((a, b) => a + b, 0) / len;

    let num = 0;
    let den1 = 0;
    let den2 = 0;

    for (let k = 0; k < len; k++) {
        const d1 = s1[k] - mean1;
        const d2 = s2[k] - mean2;
        num += d1 * d2;
        den1 += d1 * d1;
        den2 += d2 * d2;
    }

    return den1 && den2 ? num / Math.sqrt(den1 * den2) : 0;
};

// Message handler
self.onmessage = (e) => {
    const { type, payload, id } = e.data;

    try {
        let result;

        switch (type) {
            case 'CALCULATE_INDICATORS':
                result = {
                    rsi: calculateRSI(payload.data, payload.rsiPeriod || 14),
                    macd: calculateMACD(payload.data, payload.macdFast || 12, payload.macdSlow || 26, payload.macdSignal || 9),
                    bb: calculateBollingerBands(payload.data, payload.bbPeriod || 20, payload.bbStdDev || 2),
                    atr: calculateATR(payload.data, payload.atrPeriod || 14),
                    ema: calculateEMA(payload.data, payload.emaPeriod || 20)
                };
                break;

            case 'CALCULATE_CORRELATION': {
                const { symbols, data } = payload;
                const correlations = {};
                
                for (let i = 0; i < symbols.length; i++) {
                    for (let j = 0; j < symbols.length; j++) {
                        const symA = symbols[i];
                        const symB = symbols[j];
                        const key = `${symA}-${symB}`;
                        
                        if (symA === symB) {
                            correlations[key] = 1;
                        } else if (data[symA] && data[symB]) {
                            correlations[key] = calculateCorrelation(data[symA], data[symB]);
                        } else {
                            correlations[key] = 0;
                        }
                    }
                }
                
                result = correlations;
                break;
            }

            case 'CALCULATE_MULTI_TIMEFRAME': {
                // Calculate indicators for multiple timeframes
                result = {};
                for (const [timeframe, tfData] of Object.entries(payload.data)) {
                    result[timeframe] = {
                        rsi: calculateRSI(tfData, 14),
                        macd: calculateMACD(tfData, 12, 26, 9),
                        ema: calculateEMA(tfData, 20)
                    };
                }
                break;
            }

            default:
                throw new Error(`Unknown message type: ${type}`);
        }

        self.postMessage({
            type: `${type}_RESULT`,
            payload: result,
            id
        });

    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            payload: {
                message: error.message,
                stack: error.stack
            },
            id
        });
    }
};

// Signal ready
self.postMessage({ type: 'READY' });
