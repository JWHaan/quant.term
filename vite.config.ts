import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { sites } from './build/sites-vite-plugin'

// https://vitejs.dev/config/
export default defineConfig(async () => {
    // Wrangler snapshots these paths while its plugin loads. Keep all local
    // state inside the project so sandboxed and CI builds remain portable.
    process.env.WRANGLER_WRITE_LOGS ??= 'false'
    process.env.WRANGLER_LOG_PATH ??= '.wrangler/wrangler.log'
    process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry'

    const { cloudflare } = await import('@cloudflare/vite-plugin')

    return {
    plugins: [
        react(),
        sites(),
        cloudflare({ viteEnvironment: { name: 'server' } }),
    ],
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
        host: true,
    },
    preview: {
        port: 4173,
        host: true,
    },
    build: {
        target: 'es2020',
        // Disable sourcemaps in production for smaller/faster deploys.
        // Re-enable locally with `vite build --sourcemap` if you need to debug.
        sourcemap: false,
        // Aggressively compress
        minify: 'esbuild',
        cssMinify: true,
        // Raise chunk size warning threshold so we don't get noisy logs
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                // Function-based manualChunks: smarter than the object form.
                // The object form was mislabeling a shared React/zustand chunk
                // as "three" even though three.js is never imported in production.
                manualChunks: (id) => {
                    if (!id.includes('node_modules')) return undefined;

                    // React core runtime — kept stable for fast cache hits
                    if (
                        id.includes('node_modules/react/') ||
                        id.includes('node_modules/react-dom/') ||
                        id.includes('node_modules/scheduler/')
                    ) {
                        return 'react-vendor';
                    }

                    // State management
                    if (id.includes('node_modules/zustand/')) {
                        return 'state';
                    }

                    // Charting libraries
                    if (id.includes('node_modules/lightweight-charts/')) {
                        return 'charts';
                    }

                    // Data viz
                    if (
                        id.includes('node_modules/d3/') ||
                        id.includes('node_modules/d3-sankey/') ||
                        id.includes('node_modules/decimal.js/')
                    ) {
                        return 'data-viz';
                    }

                    // Icons — separate so they don't bloat the main bundle
                    if (id.includes('node_modules/lucide-react/')) {
                        return 'icons';
                    }

                    // Toaster / UI utilities
                    if (
                        id.includes('node_modules/react-hot-toast/') ||
                        id.includes('node_modules/react-resizable-panels/') ||
                        id.includes('node_modules/react-virtuoso/') ||
                        id.includes('node_modules/react-window/')
                    ) {
                        return 'ui-utils';
                    }

                    // Everything else from node_modules goes to a generic vendor chunk
                    return 'vendor';
                },
                // Use shorter hash for cleaner URLs (still unique per build)
                hashCharacters: 'base36',
            }
        }
    }
    }
})
