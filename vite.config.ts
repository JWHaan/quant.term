import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { sites } from './build/sites-vite-plugin'

// https://vitejs.dev/config/
export default defineConfig(async (): Promise<UserConfig> => {
    // Wrangler snapshots these paths while its plugin loads. Keep all local
    // state inside the project so sandboxed and CI builds remain portable.
    process.env.WRANGLER_WRITE_LOGS ??= 'false'
    process.env.WRANGLER_LOG_PATH ??= '.wrangler/wrangler.log'
    process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry'

    const { cloudflare } = await import('@cloudflare/vite-plugin')

    const config: UserConfig = {
    plugins: [
        react(),
        sites(),
        ...cloudflare({ viteEnvironment: { name: 'server' } }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        }
    },
    server: {
        port: 3000,
        host: true,
        watch: {
            ignored: ['**/coverage/**', '**/dist/**'],
        },
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
        // Minifier intentionally unset: Vite 7 defaults to esbuild, Vite 8 to
        // oxc. Pinning 'esbuild' breaks Vite 8, whose rolldown core no longer
        // bundles the esbuild transformer.
        cssMinify: true,
        // Raise chunk size warning threshold so we don't get noisy logs
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                // Function-based manualChunks: smarter than the object form.
                // The object form was mislabeling a shared React/zustand chunk
                // as "three" even though three.js is never imported in production.
                manualChunks: (id: string) => {
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

                    // Data viz
                    if (
                        id.includes('node_modules/d3/') ||
                        id.includes('node_modules/decimal.js/')
                    ) {
                        return 'data-viz';
                    }

                    // Icons — separate so they don't bloat the main bundle
                    if (id.includes('node_modules/lucide-react/')) {
                        return 'icons';
                    }

                    // Resizable workspace panels
                    if (id.includes('node_modules/react-resizable-panels/')) {
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

    return config
})
