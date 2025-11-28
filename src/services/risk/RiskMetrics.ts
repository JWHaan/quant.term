export class RiskMetrics {
    /**
     * Calculate Conditional Value at Risk (CVaR) / Expected Shortfall
     * @param returns Array of historical returns (e.g., 0.01 for 1%)
     * @param confidence Confidence level (e.g., 0.95 for 95%)
     * @returns CVaR as a positive number representing loss
     */
    static calculateCVaR(returns: number[], confidence: number = 0.95): number {
        if (returns.length === 0) return 0;

        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sortedReturns.length);

        const worstReturn = sortedReturns[0];
        if (index === 0 || worstReturn === undefined) return -(worstReturn ?? 0);

        const tailReturns = sortedReturns.slice(0, index);
        const sumTail = tailReturns.reduce((sum, r) => sum + r, 0);

        // CVaR is the average of losses in the tail
        // We return it as a positive number representing the loss magnitude
        return -(sumTail / tailReturns.length);
    }

    /**
     * Calculate Covariance Matrix for multiple assets
     * @param assetsReturns Array of return arrays for each asset. 
     *                      assetsReturns[i] is the array of returns for asset i.
     *                      All arrays must have the same length.
     * @returns 2D array representing the covariance matrix
     */
    static calculateCovarianceMatrix(assetsReturns: number[][]): number[][] {
        if (assetsReturns.length === 0) return [];
        const firstAsset = assetsReturns[0];
        if (!firstAsset || firstAsset.length === 0) return [];

        const numAssets = assetsReturns.length;
        const numPeriods = firstAsset.length;
        const matrix: number[][] = Array(numAssets).fill(0).map(() => Array(numAssets).fill(0));

        // Calculate means
        const means = assetsReturns.map(returns =>
            returns.reduce((sum, r) => sum + r, 0) / numPeriods
        );

        for (let i = 0; i < numAssets; i++) {
            for (let j = i; j < numAssets; j++) {
                let sumProduct = 0;
                for (let k = 0; k < numPeriods; k++) {
                    const valI = assetsReturns[i]?.[k] ?? 0;
                    const valJ = assetsReturns[j]?.[k] ?? 0;
                    const meanI = means[i] ?? 0;
                    const meanJ = means[j] ?? 0;
                    sumProduct += (valI - meanI) * (valJ - meanJ);
                }
                const covariance = sumProduct / (numPeriods - 1); // Sample covariance
                const rowI = matrix[i];
                const rowJ = matrix[j];
                if (rowI && rowJ) {
                    rowI[j] = covariance;
                    rowJ[i] = covariance; // Symmetric
                }
            }
        }

        return matrix;
    }

    /**
     * Run Monte Carlo Simulation for price forecasting
     * Uses Geometric Brownian Motion (GBM)
     * @param initialPrice Current price
     * @param mu Expected return (daily)
     * @param sigma Volatility (daily standard deviation)
     * @param days Number of days to simulate
     * @param simulations Number of simulation paths
     * @returns Array of price paths (each path is an array of prices)
     */
    static runMonteCarloSimulation(
        initialPrice: number,
        mu: number,
        sigma: number,
        days: number,
        simulations: number
    ): number[][] {
        const paths: number[][] = [];
        const dt = 1; // 1 day time step

        for (let i = 0; i < simulations; i++) {
            const path: number[] = [initialPrice];
            let currentPrice = initialPrice;

            for (let t = 0; t < days; t++) {
                // Box-Muller transform for normal distribution
                const u1 = Math.random();
                const u2 = Math.random();
                const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

                // GBM formula: S_t = S_{t-1} * exp((mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * Z)
                const drift = (mu - 0.5 * sigma * sigma) * dt;
                const diffusion = sigma * Math.sqrt(dt) * z;

                currentPrice = currentPrice * Math.exp(drift + diffusion);
                path.push(currentPrice);
            }
            paths.push(path);
        }

        return paths;
    }
}
