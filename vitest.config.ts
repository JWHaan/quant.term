import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./src/tests/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'node_modules/',
                'dist/',
                'src/tests/',
                'src/**/*.d.ts',
                'src/services/mlService.ts',
                'src/services/dataQualityMonitor.ts',
                'src/services/deribitService.ts',
                'src/services/multiAssetWebSocket.ts',
                'src/services/risk/**/*',
                'src/services/sentimentService.ts',
                'src/services/statarb/**/*',
                'src/services/timeseries/**/*',
                'src/features/charts/CorrelationHeatmap.tsx',
                'src/features/charts/OrderFlowSankey.tsx',
                'src/features/charts/VolatilitySurface3D.tsx',
                'src/features/charts/VolatilitySurface.tsx',
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/*.spec.ts',
                '**/*.spec.tsx',
                'vite.config.ts',
                'vitest.config.ts'
            ],
            // Full-tree baseline, including the currently dormant research
            // scaffolds. Keep CI honest and ratchet these floors upward as
            // browser/component coverage is added.
            thresholds: {
                lines: 18,
                functions: 18,
                branches: 10,
                statements: 18
            }
        },
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache']
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@/ui': path.resolve(__dirname, './src/ui'),
            '@/features': path.resolve(__dirname, './src/features'),
            '@/layout': path.resolve(__dirname, './src/layout'),
            '@/stores': path.resolve(__dirname, './src/stores'),
            '@/services': path.resolve(__dirname, './src/services'),
            '@/utils': path.resolve(__dirname, './src/utils'),
            '@/hooks': path.resolve(__dirname, './src/hooks'),
            '@/types': path.resolve(__dirname, './src/types'),
            '@/data': path.resolve(__dirname, './src/data'),
            '@/workers': path.resolve(__dirname, './src/workers'),
        }
    }
})
