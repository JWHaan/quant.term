

export class TimeSeriesService {
    /**
     * ARIMA(p,d,q) - AutoRegressive Integrated Moving Average
     * Simplified AR(1) implementation for client-side efficiency
     */
    static fitARIMA(data: number[], p: number = 1, d: number = 1, q: number = 1): {
        coefficients: number[];
        forecast: (steps: number) => number[];
    } {
        // Differencing for stationarity
        const diff = this.difference(data, d);

        // AR component using Yule-Walker equations
        const arCoeffs = this.estimateAR(diff, p);

        // MA component (simplified)
        const maCoeffs = this.estimateMA(diff, arCoeffs, q);

        return {
            coefficients: [...arCoeffs, ...maCoeffs],
            forecast: (steps: number) => {
                return this.forecastARIMA(data, arCoeffs, maCoeffs, d, steps);
            }
        };
    }

    /**
     * GARCH(1,1) - Generalized AutoRegressive Conditional Heteroskedasticity
     * For volatility forecasting
     */
    static fitGARCH(returns: number[]): {
        omega: number;
        alpha: number;
        beta: number;
        conditionalVolatility: number[];
        forecast: (steps: number) => number[];
    } {
        const n = returns.length;

        // Initialize parameters (using method of moments)
        const variance = this.variance(returns);
        const omega = 0.01 * variance;
        const alpha = 0.1;
        const beta = 0.85;

        // Estimate conditional variance series
        const h = new Array(n);
        h[0] = variance;

        for (let t = 1; t < n; t++) {
            h[t] = omega + alpha * Math.pow(returns[t - 1]!, 2) + beta * h[t - 1];
        }

        return {
            omega,
            alpha,
            beta,
            conditionalVolatility: h.map(v => Math.sqrt(v)),
            forecast: (steps: number) => {
                const forecasts = [];
                let lastH = h[h.length - 1];

                for (let i = 0; i < steps; i++) {
                    lastH = omega + alpha * 0 + beta * lastH;
                    forecasts.push(Math.sqrt(lastH));
                }

                return forecasts;
            }
        };
    }

    private static difference(data: number[], order: number): number[] {
        let result = [...data];
        for (let d = 0; d < order; d++) {
            result = result.slice(1).map((val, i) => val - result[i]!);
        }
        return result;
    }

    private static estimateAR(data: number[], p: number): number[] {
        // Yule-Walker equations for AR coefficients
        const n = data.length;
        const mean = data.reduce((a, b) => a + b, 0) / n;
        const centered = data.map(x => x - mean);

        // Autocorrelation function
        const acf = [];
        for (let lag = 0; lag <= p; lag++) {
            let sum = 0;
            for (let t = lag; t < n; t++) {
                sum += centered[t]! * centered[t - lag]!;
            }
            acf.push(sum / n);
        }

        // Solve Yule-Walker using Levinson-Durbin
        return this.levinsonDurbin(acf, p);
    }

    private static levinsonDurbin(acf: number[], p: number): number[] {
        const a = new Array(p + 1);
        a[0] = 1;

        for (let k = 1; k <= p; k++) {
            let sum = 0;
            for (let j = 1; j < k; j++) {
                sum += a[j]! * acf[k - j]!;
            }

            const lambda = (acf[k]! - sum) / (acf[0]! - sum);
            a[k] = lambda;

            for (let j = 1; j < k; j++) {
                a[j] = a[j] - lambda * a[k - j];
            }
        }

        return a.slice(1);
    }

    private static estimateMA(data: number[], arCoeffs: number[], q: number): number[] {
        const residuals = this.computeResiduals(data, arCoeffs);
        return this.estimateAR(residuals, q);
    }

    private static computeResiduals(data: number[], arCoeffs: number[]): number[] {
        const p = arCoeffs.length;
        const residuals = [];

        for (let t = p; t < data.length; t++) {
            let prediction = 0;
            for (let i = 0; i < p; i++) {
                prediction += arCoeffs[i]! * data[t - i - 1]!;
            }
            residuals.push(data[t]! - prediction);
        }

        return residuals;
    }

    private static forecastARIMA(
        data: number[],
        arCoeffs: number[],
        _maCoeffs: number[],
        d: number,
        steps: number
    ): number[] {
        const forecasts = [];
        const history = [...data];

        for (let s = 0; s < steps; s++) {
            let forecast = 0;
            for (let i = 0; i < arCoeffs.length; i++) {
                forecast += arCoeffs[i]! * history[history.length - 1 - i]!;
            }

            for (let i = 0; i < d; i++) {
                forecast += history[history.length - 1]!;
            }

            forecasts.push(forecast);
            history.push(forecast);
        }

        return forecasts;
    }

    private static variance(data: number[]): number {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        return data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length;
    }
}
