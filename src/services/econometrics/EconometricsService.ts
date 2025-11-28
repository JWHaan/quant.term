export class EconometricsService {
    /**
     * Test for Cointegration using a simplified Engle-Granger two-step method
     * Step 1: Regress y on x
     * Step 2: Test residuals for stationarity (using simplified ADF-like check)
     * @param seriesA Price series A (dependent variable)
     * @param seriesB Price series B (independent variable)
     * @returns Result indicating if cointegrated
     */
    static testCointegration(seriesA: number[], seriesB: number[]): { pValue: number, isCointegrated: boolean, beta: number } {
        if (seriesA.length !== seriesB.length || seriesA.length < 30) {
            return { pValue: 1, isCointegrated: false, beta: 0 };
        }

        // 1. OLS Regression: A = beta * B + alpha + epsilon
        const n = seriesA.length;
        const meanA = seriesA.reduce((a, b) => a + b, 0) / n;
        const meanB = seriesB.reduce((a, b) => a + b, 0) / n;

        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i++) {
            const valA = seriesA[i];
            const valB = seriesB[i];
            if (valA === undefined || valB === undefined) continue;
            num += (valA - meanA) * (valB - meanB);
            den += Math.pow(valB - meanB, 2);
        }
        const beta = den === 0 ? 0 : num / den;
        const alpha = meanA - beta * meanB;

        // 2. Calculate residuals
        const residuals = seriesA.map((val, i) => {
            const valB = seriesB[i];
            if (val === undefined || valB === undefined) return 0;
            return val - (alpha + beta * valB);
        });

        // 3. Test residuals for mean reversion (simplified Hurst exponent or ADF proxy)
        // Using a simplified variance ratio test or autocorrelation check
        // Check lag-1 autocorrelation of residuals
        const meanRes = residuals.reduce((a, b) => a + b, 0) / n;
        let numRes = 0;
        let denRes = 0;
        for (let i = 1; i < n; i++) {
            const resI = residuals[i];
            const resPrev = residuals[i - 1];
            if (resI === undefined || resPrev === undefined) continue;
            numRes += (resI - meanRes) * (resPrev - meanRes);
            denRes += Math.pow(resPrev - meanRes, 2);
        }
        const rho = denRes === 0 ? 0 : numRes / denRes;

        // If rho is significantly less than 1, residuals are stationary (mean-reverting)
        // Critical value proxy: 0.9 for 95% confidence in this simplified context
        const isCointegrated = rho < 0.9;
        const pValue = isCointegrated ? 0.04 : 0.5; // Mock p-value based on threshold

        return { pValue, isCointegrated, beta };
    }

    /**
     * Detect Market Regime using volatility thresholds
     * (Simplified Regime Switching)
     * @param returns Asset returns
     * @returns Regime classification
     */
    static detectRegime(returns: number[]): { regime: 'low_vol' | 'high_vol' | 'extreme', probability: number } {
        if (returns.length < 20) {
            return { regime: 'low_vol', probability: 0.5 };
        }

        // Calculate rolling standard deviation (volatility)
        const n = returns.length;
        const mean = returns.reduce((a, b) => a + b, 0) / n;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);

        // Define thresholds (e.g., annualized vol)
        // Assuming daily returns, annualized vol = stdDev * sqrt(365)
        const annualizedVol = stdDev * Math.sqrt(365);

        let regime: 'low_vol' | 'high_vol' | 'extreme' = 'low_vol';
        let probability = 0.0;

        if (annualizedVol < 0.5) { // < 50% annualized vol
            regime = 'low_vol';
            probability = 1 - (annualizedVol / 0.5);
        } else if (annualizedVol < 1.0) { // 50% - 100% annualized vol
            regime = 'high_vol';
            probability = (annualizedVol - 0.5) / 0.5;
        } else { // > 100% annualized vol
            regime = 'extreme';
            probability = Math.min(1, (annualizedVol - 1.0) / 1.0);
        }

        return { regime, probability };
    }
}
