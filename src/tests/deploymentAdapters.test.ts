import { afterEach, describe, expect, it, vi } from 'vitest';
import vercelNews from '../../api/vercel-news';
import sitesWorker from '../../worker/index';
import vercelConfig from '../../vercel.json';

const RSS_FIXTURE = `<?xml version="1.0"?>
<rss><channel><item>
  <title>Bitcoin market update</title>
  <link>https://example.com/bitcoin-update</link>
  <guid>bitcoin-update</guid>
  <pubDate>Fri, 18 Jul 2026 00:00:00 GMT</pubDate>
  <category>Bitcoin</category>
</item></channel></rss>`;

describe('deployment adapters', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('serves the shared news contract through the Vercel adapter', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(RSS_FIXTURE, { status: 200 })));

        const response = await vercelNews.fetch(
            new Request('https://quant.term/api/news?limit=1'),
        );
        const payload = await response.json() as {
            articles: Array<{ headline: string }>;
            providers: Array<{ ok: boolean }>;
        };

        expect(response.status).toBe(200);
        expect(payload.articles).toHaveLength(1);
        expect(payload.articles[0]?.headline).toBe('Bitcoin market update');
        expect(payload.providers).toHaveLength(2);
        expect(payload.providers.every((provider) => provider.ok)).toBe(true);
    });

    it('routes the public news endpoint before the Vercel SPA fallback', () => {
        expect(vercelConfig.outputDirectory).toBe('dist/client');
        expect(vercelConfig.functions).toHaveProperty('api/vercel-news.ts');
        expect(vercelConfig.rewrites).toEqual([
            { source: '/api/news', destination: '/api/vercel-news' },
            { source: '/(.*)', destination: '/index.html' },
        ]);
    });

    it('falls back to the SPA shell for Sites navigation requests', async () => {
        const assetFetch = vi.fn(async (request: Request) => {
            const pathname = new URL(request.url).pathname;
            return pathname === '/index.html'
                ? new Response('<html>terminal shell</html>', { status: 200 })
                : new Response('missing', { status: 404 });
        });

        const response = await sitesWorker.fetch(
            new Request('https://quant.term/research/btc', {
                headers: { accept: 'text/html' },
            }),
            { ASSETS: { fetch: assetFetch } },
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toContain('terminal shell');
        expect(assetFetch).toHaveBeenCalledTimes(2);
        expect(new URL(assetFetch.mock.calls[1]?.[0].url ?? '').pathname).toBe('/index.html');
    });
});
