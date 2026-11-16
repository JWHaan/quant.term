import { defineConfig, type UserConfig } from 'vite'
import path from 'path'
import { sites } from './build/sites-vite-plugin.ts'

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
        sites(),
        ...cloudflare({ viteEnvironment: { name: 'server' } }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
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
                // Use shorter hash for cleaner URLs (still unique per build)
                hashCharacters: 'base36',
            }
        }
    }
    }

    return config
})
