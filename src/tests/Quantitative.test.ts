import { describe, it, expect } from 'vitest';
import { RiskMetrics } from '../services/risk/RiskMetrics';
import { EconometricsService } from '../services/econometrics/EconometricsService';
import { mlService } from '../services/mlService';

describe('RiskMetrics', () => {
    it('should calculate CVaR correctly', () => {
        const returns = [-0.05, -0.04, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04];
        // 90% confidence -> worst 10% -> worst 1 return -> -0.05
        const cvar = RiskMetrics.calculateCVaR(returns, 0.9);
        expect(cvar).toBeCloseTo(0.05);
    });

    it('should calculate Covariance Matrix correctly', () => {
        const assetA = [1, 2, 3];
        const assetB = [2, 4, 6]; // Perfectly correlated
        const matrix = RiskMetrics.calculateCovarianceMatrix([assetA, assetB]);

        const firstRow = matrix[0];
        expect(firstRow).toBeDefined();
        if (firstRow) {
            expect(firstRow[0]).toBe(1); // Var(A)
        }
        const secondRow = matrix[1];
        expect(secondRow).toBeDefined();
        if (secondRow) {
            expect(secondRow[1]).toBe(4); // Var(B)
        }
        const firstRowForCov = matrix[0];
        if (firstRowForCov) {
            expect(firstRowForCov[1]).toBe(2); // Cov(A,B)
        }
    });
});

describe('EconometricsService', () => {
    it('should detect cointegration for correlated series', () => {
        const seriesA = Array.from({ length: 100 }, (_, i) => i + Math.random());
        const seriesB = seriesA.map(v => v * 2 + 5 + Math.random() * 0.1); // Cointegrated

        const result = EconometricsService.testCointegration(seriesA, seriesB);
        expect(result.isCointegrated).toBe(true);
    });

    it('should detect high volatility regime', () => {
        const returns = Array.from({ length: 100 }, () => (Math.random() - 0.5) * 0.2); // High vol
        const result = EconometricsService.detectRegime(returns);
        expect(result.regime).not.toBe('low_vol');
    });
});

describe('MLService', () => {
    it('should cluster patterns', () => {
        const data = [
            [1, 1], [1.1, 1.1], [0.9, 0.9], // Cluster 1
            [5, 5], [5.1, 5.1], [4.9, 4.9]  // Cluster 2
        ];
        const assignments = mlService.clusterPatterns(data, 2);
        expect(assignments[0]).toBe(assignments[1]);
        expect(assignments[0]).not.toBe(assignments[3]);
    });

    it('should forecast volatility', async () => {
        const history = [0.1, 0.12, 0.11, 0.13, 0.12, 0.14, 0.13, 0.15, 0.14, 0.16];
        const forecast = await mlService.forecastVolatility(history, 3);
        expect(forecast.length).toBe(3);
        expect(forecast[0]).toBeGreaterThan(0);
    });
});
