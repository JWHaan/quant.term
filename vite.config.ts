import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
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
    },
    server: {
        port: 3000,
    },
    build: {
        target: 'es2020',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'charts': ['lightweight-charts'],
                    'three': ['three', '@react-three/fiber', '@react-three/drei'],
                    'icons': ['lucide-react']
                }
            }
        }
    }
})
