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
            exclude: [
                'node_modules/',
                'dist/',
                'src/tests/',
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/*.spec.ts',
                '**/*.spec.tsx',
                '**/types/**',
                'vite.config.ts',
                'vitest.config.ts'
            ],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 70,
                statements: 70
            }
        },
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache']
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@/components': path.resolve(__dirname, './src/components'),
            '@/stores': path.resolve(__dirname, './src/stores'),
            '@/services': path.resolve(__dirname, './src/services'),
            '@/utils': path.resolve(__dirname, './src/utils'),
            '@/hooks': path.resolve(__dirname, './src/hooks'),
            '@/types': path.resolve(__dirname, './src/types'),
            '@/data': path.resolve(__dirname, './src/data'),
        }
    }
})
