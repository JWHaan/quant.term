export class PCAService {
    /**
     * Principal Component Analysis for asset correlation
     * Simplified implementation for client-side use
     */
    static fitPCA(returns: number[][], nComponents: number = 3): {
        components: number[][];
        explainedVariance: number[];
        transform: (data: number[][]) => number[][];
    } {
        const means = this.columnMeans(returns);
        const centered = returns.map(row =>
            row.map((val, j) => val - means[j]!)
        );

        const cov = this.covarianceMatrix(centered);

        // Simplified: Use first n components (in production, use proper eigendecomposition)
        const components = this.extractComponents(cov, nComponents);
        const explainedVariance = components.map(() => 1.0);

        return {
            components,
            explainedVariance,
            transform: (data: number[][]) => this.project(data, components, means)
        };
    }

    /**
     * Calculate correlation matrix from returns
     */
    static correlationMatrix(returns: number[][]): number[][] {
        if (returns.length === 0) return [];
        const n = returns[0]!.length;
        const corr = Array(n).fill(0).map(() => Array(n).fill(0));

        // Calculate standard deviations
        const stds = [];
        for (let i = 0; i < n; i++) {
            const col = returns.map(row => row[i]!);
            const mean = col.reduce((a, b) => a + b, 0) / col.length;
            const variance = col.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / col.length;
            stds.push(Math.sqrt(variance));
        }

        // Calculate correlation
        const cov = this.covarianceMatrix(returns);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                corr[i]![j]! = stds[i]! === 0 || stds[j]! === 0 ? 0 : cov[i]![j]! / (stds[i]! * stds[j]!);
            }
        }

        return corr;
    }

    private static columnMeans(matrix: number[][]): number[] {
        if (matrix.length === 0) return [];
        const m = matrix[0]!.length;
        const means = new Array(m).fill(0);

        for (const row of matrix) {
            for (let j = 0; j < m; j++) {
                means[j] += row[j];
            }
        }

        return means.map(sum => sum / matrix.length);
    }

    private static covarianceMatrix(centered: number[][]): number[][] {
        if (centered.length === 0) return [];
        const m = centered[0]!.length;
        const n = centered.length;
        const cov = Array(m).fill(0).map(() => Array(m).fill(0));

        for (let i = 0; i < m; i++) {
            for (let j = i; j < m; j++) {
                let sum = 0;
                for (let k = 0; k < n; k++) {
                    sum += centered[k]![i]! * centered[k]![j]!;
                }
                cov[i]![j]! = sum / (n - 1);
                cov[j]![i]! = cov[i]![j]!;
            }
        }

        return cov;
    }

    private static extractComponents(cov: number[][], n: number): number[][] {
        // Simplified: return identity matrix
        // In production, use proper eigendecomposition from numeric.js
        const components = [];
        for (let i = 0; i < Math.min(n, cov.length); i++) {
            const vec = new Array(cov.length).fill(0);
            vec[i] = 1;
            components.push(vec);
        }
        return components;
    }

    private static project(data: number[][], components: number[][], means: number[]): number[][] {
        return data.map(row => {
            const centered = row.map((val, j) => val - means[j]!);
            return components.map(comp =>
                centered.reduce((sum, val, i) => sum + val * comp[i]!, 0)
            );
        });
    }
}
