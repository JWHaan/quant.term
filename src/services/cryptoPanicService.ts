/**
 * Public crypto-news client.
 *
 * Headlines are normalized by the same-origin Worker from CoinDesk and
 * Cointelegraph RSS. The browser shares a short in-memory cache and never ships
 * provider credentials or calls third-party news hosts directly.
 */

const NEWS_ENDPOINT = '/api/news';
const CACHE_TTL_MS = 90_000;

interface NewsOptions {
    currencies?: string;
    regions?: string;
    kind?: 'news' | 'media';
    filter?: 'rising' | 'hot' | 'trending' | 'latest' | 'bullish' | 'bearish' | 'important';
    limit?: number;
}

interface NewsWireApiArticle {
    id: string;
    headline: string;
    url: string;
    source: string;
    published: string;
    currencies?: string[];
}

interface NewsWireApiResponse {
    articles?: NewsWireApiArticle[];
    error?: string;
}

export interface NewsArticle {
    id: number | string;
    headline: string;
    url: string;
    source: string;
    published: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    currencies: string[];
    metadata: {
        domain: string;
        votes: { positive: number; negative: number };
    };
}

let cachedArticles: NewsArticle[] = [];
let cacheTimestamp = 0;
let inFlight: Promise<NewsArticle[]> | null = null;

const loadNews = async (): Promise<NewsArticle[]> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
        const response = await fetch(`${NEWS_ENDPOINT}?limit=50`, {
            headers: { accept: 'application/json' },
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`News provider returned ${response.status}`);
        const payload = await response.json() as NewsWireApiResponse;
        if (!Array.isArray(payload.articles)) throw new Error(payload.error || 'Unexpected news response');

        const articles = payload.articles.flatMap((article) => {
            if (!article.id || !article.headline || !article.url || !article.source || !article.published) return [];

            let url: URL;
            try {
                url = new URL(article.url);
            } catch {
                return [];
            }
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return [];

            const published = new Date(article.published);
            if (!Number.isFinite(published.getTime())) return [];

            return [{
                id: article.id,
                headline: article.headline,
                url: article.url,
                source: article.source,
                published: published.toISOString(),
                sentiment: 'neutral' as const,
                currencies: Array.isArray(article.currencies) ? article.currencies : [],
                metadata: {
                    domain: url.hostname,
                    votes: { positive: 0, negative: 0 },
                },
            } satisfies NewsArticle];
        });
        cachedArticles = articles;
        cacheTimestamp = Date.now();
        return articles;
    } finally {
        window.clearTimeout(timeout);
    }
};

export async function fetchCryptoNews(options: NewsOptions = {}): Promise<NewsArticle[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 50));
    const isFresh = cacheTimestamp > 0 && Date.now() - cacheTimestamp < CACHE_TTL_MS;
    if (!isFresh) {
        inFlight ??= loadNews().finally(() => { inFlight = null; });
        await inFlight;
    }

    const requested = options.currencies
        ?.split(',')
        .map((currency) => currency.trim().toUpperCase())
        .filter(Boolean) ?? [];
    const filtered = requested.length
        ? cachedArticles.filter((article) => article.currencies.some((currency) => requested.includes(currency.toUpperCase())))
        : cachedArticles;

    // A symbol-specific feed may be sparse; show the broader market tape rather
    // than inventing stories or returning a misleading empty panel.
    return (filtered.length ? filtered : cachedArticles).slice(0, limit);
}

export function getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1_000));
    if (seconds < 60) return 'just now';
    if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
    return `${Math.floor(seconds / 86_400)}d ago`;
}

export function startNewsPolling(callback: (news: NewsArticle[]) => void, interval = 300_000): () => void {
    let active = true;
    let timeout: number | null = null;

    const poll = async () => {
        try {
            const news = await fetchCryptoNews({ filter: 'latest', limit: 15 });
            if (active) callback(news);
        } catch (error) {
            console.warn('[News] Refresh failed; retaining the last successful headlines.', error);
        }
        if (active) timeout = window.setTimeout(poll, interval);
    };

    void poll();
    return () => {
        active = false;
        if (timeout !== null) window.clearTimeout(timeout);
    };
}
