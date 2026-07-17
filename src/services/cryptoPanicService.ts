/**
 * Public crypto-news client.
 *
 * The original implementation embedded a CryptoPanic API key in the browser and
 * exceeded the free quota. This replacement uses CryptoCompare's public news
 * endpoint, shares a short in-memory cache, and never fabricates headlines.
 */

const NEWS_ENDPOINT = 'https://min-api.cryptocompare.com/data/v2/news/';
const CACHE_TTL_MS = 90_000;

interface NewsOptions {
    currencies?: string;
    regions?: string;
    kind?: 'news' | 'media';
    filter?: 'rising' | 'hot' | 'trending' | 'latest' | 'bullish' | 'bearish' | 'important';
    limit?: number;
}

interface CryptoCompareArticle {
    id: string;
    published_on: number;
    title: string;
    url: string;
    source: string;
    categories?: string;
    upvotes?: string;
    downvotes?: string;
}

interface CryptoCompareResponse {
    Type?: number;
    Message?: string;
    Data?: CryptoCompareArticle[];
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

const inferSentiment = (article: CryptoCompareArticle): NewsArticle['sentiment'] => {
    const positiveVotes = Number(article.upvotes ?? 0);
    const negativeVotes = Number(article.downvotes ?? 0);
    if (positiveVotes > negativeVotes * 1.5 && positiveVotes >= 2) return 'positive';
    if (negativeVotes > positiveVotes * 1.5 && negativeVotes >= 2) return 'negative';
    return 'neutral';
};

const loadNews = async (): Promise<NewsArticle[]> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
        const response = await fetch(`${NEWS_ENDPOINT}?lang=EN&sortOrder=latest`, { signal: controller.signal });
        if (!response.ok) throw new Error(`News provider returned ${response.status}`);
        const payload = await response.json() as CryptoCompareResponse;
        if (!Array.isArray(payload.Data)) throw new Error(payload.Message || 'Unexpected news response');

        const articles = payload.Data.map((article) => {
            const url = new URL(article.url);
            const categories = article.categories?.split('|').filter(Boolean) ?? [];
            return {
                id: article.id,
                headline: article.title,
                url: article.url,
                source: article.source || url.hostname,
                published: new Date(article.published_on * 1_000).toISOString(),
                sentiment: inferSentiment(article),
                currencies: categories,
                metadata: {
                    domain: url.hostname,
                    votes: {
                        positive: Number(article.upvotes ?? 0),
                        negative: Number(article.downvotes ?? 0),
                    },
                },
            } satisfies NewsArticle;
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
    const isFresh = cachedArticles.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL_MS;
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
