import { describe, expect, it, vi } from 'vitest';
import {
    handleNewsRequest,
    mergeNewsArticles,
    parseRssFeed,
    type NewsFetcher,
    type NewsWireArticle,
    type NewsWireResponse,
} from '../../worker/news';

const coinDeskFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Bitcoin &amp; Ethereum rally as markets reopen]]></title>
      <link>https://www.coindesk.com/markets/crypto-rally?utm_source=rss&amp;ref=terminal</link>
      <guid isPermaLink="false">desk-1</guid>
      <pubDate>Fri, 17 Jul 2026 18:00:11 +0000</pubDate>
      <category><![CDATA[Bitcoin]]></category>
      <category><![CDATA[Ethereum]]></category>
    </item>
    <item>
      <title>Incomplete story</title>
      <link>https://www.coindesk.com/incomplete</link>
    </item>
  </channel>
</rss>`;

const cointelegraphFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <item>
      <title>Solana&#39;s network activity reaches a new high</title>
      <link><![CDATA[https://cointelegraph.com/news/solana-activity?utm_medium=rss&utm_campaign=rss]]></link>
      <guid isPermaLink="true">https://cointelegraph.com/news/solana-activity</guid>
      <pubDate>Fri, 17 Jul 2026 19:00:11 +0000</pubDate>
      <category>Altcoin</category>
    </item>
  </channel>
</rss>`;

describe('RSS news parser', () => {
    it('normalizes CoinDesk CDATA, entities, tracking URLs, tags, and assets', () => {
        const articles = parseRssFeed(coinDeskFeed, 'CoinDesk');

        expect(articles).toHaveLength(1);
        expect(articles[0]).toMatchObject({
            id: 'coindesk:desk-1',
            headline: 'Bitcoin & Ethereum rally as markets reopen',
            url: 'https://www.coindesk.com/markets/crypto-rally?ref=terminal',
            source: 'CoinDesk',
            published: '2026-07-17T18:00:11.000Z',
            categories: ['Bitcoin', 'Ethereum'],
            currencies: ['BTC', 'ETH'],
        });
    });

    it('normalizes Cointelegraph fields and skips unsafe or incomplete items', () => {
        const articles = parseRssFeed(cointelegraphFeed, 'Cointelegraph');
        const unsafeFeed = cointelegraphFeed.replace(
            'https://cointelegraph.com/news/solana-activity?utm_medium=rss&utm_campaign=rss',
            'javascript:alert(1)',
        );

        expect(articles).toHaveLength(1);
        expect(articles[0]).toMatchObject({
            headline: "Solana's network activity reaches a new high",
            url: 'https://cointelegraph.com/news/solana-activity',
            source: 'Cointelegraph',
            currencies: ['SOL'],
        });
        expect(parseRssFeed(unsafeFeed, 'Cointelegraph')).toEqual([]);
    });

    it('sorts newest-first and removes duplicate URLs or headlines', () => {
        const older = parseRssFeed(coinDeskFeed, 'CoinDesk')[0] as NewsWireArticle;
        const newer = parseRssFeed(cointelegraphFeed, 'Cointelegraph')[0] as NewsWireArticle;
        const duplicateHeadline = { ...older, id: 'duplicate', url: 'https://example.com/duplicate' };

        expect(mergeNewsArticles([[older, duplicateHeadline], [newer]])).toEqual([newer, older]);
    });
});

describe('/api/news Worker route', () => {
    it('merges both providers, respects limits, and sets shared-cache headers', async () => {
        const fetcher: NewsFetcher = vi.fn(async (input) => new Response(
            input.includes('coindesk.com') ? coinDeskFeed : cointelegraphFeed,
            { status: 200, headers: { 'content-type': 'application/xml' } },
        ));

        const response = await handleNewsRequest(
            new Request('https://terminal.test/api/news?limit=1'),
            fetcher,
        );
        const payload = await response.json() as NewsWireResponse;

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toContain('s-maxage=300');
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(payload.degraded).toBe(false);
        expect(payload.articles).toHaveLength(1);
        expect(payload.articles[0]?.source).toBe('Cointelegraph');
        expect(payload.providers).toEqual([
            { source: 'CoinDesk', ok: true, articles: 1 },
            { source: 'Cointelegraph', ok: true, articles: 1 },
        ]);
    });

    it('serves partial results when one provider is unavailable', async () => {
        const fetcher: NewsFetcher = vi.fn(async (input) => input.includes('coindesk.com')
            ? new Response('unavailable', { status: 503 })
            : new Response(cointelegraphFeed, { status: 200 }));

        const response = await handleNewsRequest(
            new Request('https://terminal.test/api/news'),
            fetcher,
        );
        const payload = await response.json() as NewsWireResponse;

        expect(response.status).toBe(200);
        expect(payload.degraded).toBe(true);
        expect(payload.articles).toHaveLength(1);
        expect(payload.providers[0]).toMatchObject({
            source: 'CoinDesk',
            ok: false,
            articles: 0,
            error: 'Upstream returned 503',
        });
    });

    it('returns a clear 502 when both providers fail and rejects non-GET methods', async () => {
        const failingFetcher: NewsFetcher = vi.fn(async () => new Response('nope', { status: 500 }));
        const unavailableResponse = await handleNewsRequest(
            new Request('https://terminal.test/api/news'),
            failingFetcher,
        );

        expect(unavailableResponse.status).toBe(502);
        await expect(unavailableResponse.json()).resolves.toMatchObject({
            error: 'News providers unavailable',
            articles: [],
        });

        const methodFetcher: NewsFetcher = vi.fn(async () => new Response(coinDeskFeed));
        const methodResponse = await handleNewsRequest(
            new Request('https://terminal.test/api/news', { method: 'POST' }),
            methodFetcher,
        );

        expect(methodResponse.status).toBe(405);
        expect(methodResponse.headers.get('allow')).toBe('GET');
        expect(methodFetcher).not.toHaveBeenCalled();
    });
});
