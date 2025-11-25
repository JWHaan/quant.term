/**
 * Real-Time Historical Value at Risk (VaR) Calculator
 * 
 * Calculates VaR using historical simulation method with actual market returns.
 * Unlike parametric VaR (assumes normal distribution), this uses empirical distribution
 * which is more accurate for crypto markets with fat tails.
 * 
 * Also calculates Expected Shortfall (ES/CVaR) for tail risk assessment.
 * 
 * References:
 * - Jorion, P. (2007). Value at Risk: The New Benchmark for Managing Financial Risk
 * - McNeil, A. J., Frey, R., & Embrechts, P. (2015). Quantitative Risk Management
 */

export interface VaRResult {
    var99: number;          // 99% VaR (1% worst case)
    var95: number;          // 95% VaR (5% worst case)
    var90: number;          // 90% VaR (10% worst case)
    es99: number;           // Expected Shortfall at 99%
    es95: number;           // Expected Shortfall at 95%
    currentPrice: number;
    portfolioValue: number;
    timestamp: number;
}

export interface ReturnData {
    timestamp: number;
    price: number;
    return: number;         // Log return
}

export class VaRCalculator {
    private returns: ReturnData[] = [];
    private readonly maxHistorySize = 8640; // 30 days of 5-minute data
    private previousPrice: number | null = null;

    /**
     * Add a price observation and calculate return
     */
    addPrice(price: number, timestamp: number): void {
        if (this.previousPrice !== null) {
            // Calculate log return: ln(P_t / P_{t-1})
            const logReturn = Math.log(price / this.previousPrice);

            this.returns.push({
                timestamp,
                price,
                return: logReturn
            });

            // Maintain circular buffer
            if (this.returns.length > this.maxHistorySize) {
                this.returns.shift();
            }
        }

        this.previousPrice = price;
    }

    /**
     * Calculate VaR and ES using historical simulation
     */
    calculateVaR(portfolioValue: number = 10000, holdingPeriod: number = 1): VaRResult | null {
        if (this.returns.length < 100) {
            return null; // Need at least 100 observations
        }

        const currentPrice = this.returns[this.returns.length - 1]?.price || 0;

        // Sort returns in ascending order (worst to best)
        const sortedReturns = [...this.returns]
            .map(r => r.return)
            .sort((a, b) => a - b);

        // Calculate percentiles
        const var99 = this.calculatePercentile(sortedReturns, 0.01);
        const var95 = this.calculatePercentile(sortedReturns, 0.05);
        const var90 = this.calculatePercentile(sortedReturns, 0.10);

        // Calculate Expected Shortfall (average of returns beyond VaR)
        const es99 = this.calculateES(sortedReturns, 0.01);
        const es95 = this.calculateES(sortedReturns, 0.05);

        // Scale by holding period (square root of time rule)
        const scaleFactor = Math.sqrt(holdingPeriod);

        // Convert to dollar amounts
        return {
            var99: Math.abs(var99 * portfolioValue * scaleFactor),
            var95: Math.abs(var95 * portfolioValue * scaleFactor),
            var90: Math.abs(var90 * portfolioValue * scaleFactor),
            es99: Math.abs(es99 * portfolioValue * scaleFactor),
            es95: Math.abs(es95 * portfolioValue * scaleFactor),
            currentPrice,
            portfolioValue,
            timestamp: Date.now()
        };
    }

    /**
     * Calculate percentile from sorted returns
     */
    private calculatePercentile(sortedReturns: number[], percentile: number): number {
        const index = Math.floor(sortedReturns.length * percentile);
        return sortedReturns[index] || 0;
    }

    /**
     * Calculate Expected Shortfall (CVaR)
     * Average of all returns worse than VaR
     */
    private calculateES(sortedReturns: number[], percentile: number): number {
        const index = Math.floor(sortedReturns.length * percentile);
        const tailReturns = sortedReturns.slice(0, index);

        if (tailReturns.length === 0) return 0;

        const sum = tailReturns.reduce((acc, r) => acc + r, 0);
        return sum / tailReturns.length;
    }

    /**
     * Get volatility (annualized standard deviation)
     */
    getVolatility(annualize: boolean = true): number {
        if (this.returns.length < 2) return 0;

        const returns = this.returns.map(r => r.return);
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
        const stdDev = Math.sqrt(variance);

        // Annualize: 5-minute returns -> annual
        // 252 trading days * 24 hours * 12 (5-min periods) = 72,576 periods/year
        return annualize ? stdDev * Math.sqrt(72576) : stdDev;
    }

    /**
     * Get Sharpe Ratio (assuming risk-free rate = 0 for simplicity)
     */
    getSharpeRatio(): number {
        if (this.returns.length < 2) return 0;

        const returns = this.returns.map(r => r.return);
        const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const vol = this.getVolatility(false);

        if (vol === 0) return 0;

        // Annualize
        const annualizedReturn = meanReturn * 72576;
        const annualizedVol = this.getVolatility(true);

        return annualizedReturn / annualizedVol;
    }

    /**
     * Get maximum drawdown
     */
    getMaxDrawdown(): number {
        if (this.returns.length < 2) return 0;

        let peak = this.returns[0]?.price || 0;
        let maxDD = 0;

        this.returns.forEach(r => {
            if (r.price > peak) {
                peak = r.price;
            }
            const drawdown = (peak - r.price) / peak;
            if (drawdown > maxDD) {
                maxDD = drawdown;
            }
        });

        return maxDD;
    }

    /**
     * Detect if current risk is elevated
     */
    isRiskElevated(threshold: number = 1.5): boolean {
        const currentVol = this.getVolatility(false);

        // Calculate historical average volatility
        const windowSize = Math.min(1000, this.returns.length);
        const recentReturns = this.returns.slice(-windowSize).map(r => r.return);
        const mean = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
        const avgVol = Math.sqrt(
            recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (recentReturns.length - 1)
        );

        return currentVol > avgVol * threshold;
    }

    /**
     * Get return history for visualization
     */
    getReturnHistory(count: number = 100): ReturnData[] {
        return this.returns.slice(-count);
    }

    /**
     * Reset calculator
     */
    reset(): void {
        this.returns = [];
        this.previousPrice = null;
    }
}
