export class PortfolioMetrics {
    /**
     * Calculate Sharpe Ratio
     * @param returns Array of returns
     * @param riskFreeRate Risk-free rate (default 0)
     * @returns Sharpe ratio
     */
    static sharpeRatio(returns: number[], riskFreeRate: number = 0): number {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const std = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
        );
        return std === 0 ? 0 : (mean - riskFreeRate) / std;
    }

    /**
     * Calculate Sortino Ratio (downside deviation)
     * @param returns Array of returns
     * @param riskFreeRate Risk-free rate (default 0)
     * @returns Sortino ratio
     */
    static sortinoRatio(returns: number[], riskFreeRate: number = 0): number {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const downside = returns.filter(r => r < riskFreeRate);
        const downsideStd = Math.sqrt(
            downside.reduce((sum, r) => sum + Math.pow(r - riskFreeRate, 2), 0) / returns.length
        );
        return downsideStd === 0 ? 0 : (mean - riskFreeRate) / downsideStd;
    }

    /**
     * Calculate Maximum Drawdown
     * @param equity Array of equity values
     * @returns Maximum drawdown as percentage
     */
    static maxDrawdown(equity: number[]): number {
        let maxDD = 0;
        if (equity.length === 0) return 0;
        let peak = equity[0];
        if (peak === undefined) return 0;

        for (const value of equity) {
            if (value !== undefined && value > peak) peak = value;
            if (peak !== undefined && value !== undefined) {
                const dd = (peak - value) / peak;
                if (dd > maxDD) maxDD = dd;
            }
        }

        return maxDD;
    }

    /**
     * Calculate Calmar Ratio (return / max drawdown)
     * @param returns Array of returns
     * @param equity Array of equity values
     * @returns Calmar ratio
     */
    static calmarRatio(returns: number[], equity: number[]): number {
        const annualizedReturn = returns.reduce((a, b) => a + b, 0) / returns.length * 252; // Assuming daily returns
        const maxDD = this.maxDrawdown(equity);
        return maxDD === 0 ? 0 : annualizedReturn / maxDD;
    }

    /**
     * Calculate Information Ratio
     * @param returns Portfolio returns
     * @param benchmarkReturns Benchmark returns
     * @returns Information ratio
     */
    static informationRatio(returns: number[], benchmarkReturns: number[]): number {
        const activeReturns = returns.map((r, i) => {
            const bench = benchmarkReturns[i];
            return bench !== undefined ? r - bench : 0;
        });
        const mean = activeReturns.reduce((a, b) => a + b, 0) / activeReturns.length;
        const std = Math.sqrt(
            activeReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / activeReturns.length
        );
        return std === 0 ? 0 : mean / std;
    }
}
