/**
 * CryptoPanic News Service
 * Fetches real-time crypto news with sentiment analysis
 * Free tier: 200 requests/day
 * API: https://cryptopanic.com/developers/api/
 */

const CRYPTOPANIC_BASE = 'https://cryptopanic.com/api/v1';

// You'll need to get a free API key from https://cryptopanic.com/developers/api/
// For now, we'll use public endpoint (limited)
const API_KEY = (import.meta as any).env.VITE_CRYPTOPANIC_KEY || 'free';

interface NewsOptions {
    currencies?: string;
    regions?: string;
    kind?: 'news' | 'media';
    filter?: 'rising' | 'hot' | 'trending' | 'latest' | 'bullish' | 'bearish' | 'important';
    limit?: number;
}

interface CryptoPanicCurrency {
    code: string;
    title: string;
    slug: string;
    url: string;
}

interface CryptoPanicSource {
    title: string;
    region: string;
    domain: string;
    path: string | null;
}

interface CryptoPanicVotes {
    negative: number;
    positive: number;
    important: number;
    liked: number;
    disliked: number;
    lol: number;
    toxic: number;
    saved: number;
    comments: number;
}

interface CryptoPanicPost {
    id: number;
    kind: string;
    domain: string;
    votes: CryptoPanicVotes;
    source: CryptoPanicSource;
    title: string;
    published_at: string;
    slug: string;
    url: string;
    created_at: string;
    currencies?: CryptoPanicCurrency[];
}

interface CryptoPanicResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: CryptoPanicPost[];
}

export interface NewsArticle {
    id: number;
    headline: string;
    url: string;
    source: string;
    published: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    currencies: string[];
    metadata: {
        domain: string;
        votes: CryptoPanicVotes;
    };
}

/**
 * Fetch latest crypto news
 */
export async function fetchCryptoNews(options: NewsOptions = {}): Promise<NewsArticle[]> {
    const {
        currencies = null, // e.g., 'BTC,ETH'
        regions = 'en',
        kind = 'news', // 'news' or 'media'
        filter = 'rising', // 'rising', 'hot', 'trending', 'latest', 'bullish', 'bearish', 'important'
        limit = 20
    } = options;

    try {
        const params = new URLSearchParams({
            auth_token: API_KEY,
            public: 'true',
            kind,
            filter,
            regions
        });

        if (currencies) {
            params.append('currencies', currencies);
        }

        const response = await fetch(`${CRYPTOPANIC_BASE}/posts/?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`CryptoPanic API error: ${response.status}`);
        }

        const data: CryptoPanicResponse = await response.json();

        // Transform to our format
        return data.results.slice(0, limit).map(article => ({
            id: article.id,
            headline: article.title,
            url: article.url,
            source: article.source?.title || 'Unknown',
            published: article.published_at,
            sentiment: mapVotesToSentiment(article.votes),
            currencies: article.currencies?.map(c => c.code) || [],
            // metadata includes: domain, votes (positive, negative, important, etc)
            metadata: {
                domain: article.domain,
                votes: article.votes
            }
        }));

    } catch (error) {
        console.error('Failed to fetch CryptoPanic news:', error);
        // Return empty array on error to prevent breaking the app
        return [];
    }
}

/**
 * Map CryptoPanic votes to sentiment
 */
function mapVotesToSentiment(votes: CryptoPanicVotes): 'positive' | 'negative' | 'neutral' {
    if (!votes) return 'neutral';

    const positive = (votes.positive || 0) + (votes.important || 0);
    const negative = votes.negative || 0;

    if (positive > negative * 1.5) return 'positive';
    if (negative > positive * 1.5) return 'negative';
    return 'neutral';
}

/**
 * Get time ago string
 */
export function getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Start polling for news updates
 */
export function startNewsPolling(callback: (news: NewsArticle[]) => void, interval: number = 60000): () => void {
    let isActive = true;

    const poll = async () => {
        if (!isActive) return;

        const news = await fetchCryptoNews({ filter: 'latest', limit: 10 });
        if (news.length > 0) {
            callback(news);
        }

        if (isActive) {
            setTimeout(poll, interval);
        }
    };

    // Initial fetch
    poll();

    // Return cleanup function
    return () => {
        isActive = false;
    };
}
