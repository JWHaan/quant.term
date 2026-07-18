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
            reporter: ['text', 'json-summary', 'html', 'lcov'],
            include: ['src/**/*.{ts,tsx}', 'worker/**/*.ts', 'api/**/*.ts'],
            exclude: [
                'node_modules/',
                'dist/',
                'src/tests/',
                'src/**/*.d.ts',
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/*.spec.ts',
                '**/*.spec.tsx',
                'vite.config.ts',
                'vitest.config.ts'
            ],
            // Full active-tree baseline. Ratchet these floors upward as
            // browser and component coverage is added.
            thresholds: {
                lines: 26,
                functions: 25,
                branches: 17,
                statements: 25
            }
        },
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache']
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        }
    }
})
