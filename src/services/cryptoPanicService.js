/**
 * CryptoPanic News Service
 * Fetches real-time crypto news with sentiment analysis
 * Free tier: 200 requests/day
 * API: https://cryptopanic.com/developers/api/
 */

const CRYPTOPANIC_BASE = 'https://cryptopanic.com/api/v1';

// You'll need to get a free API key from https://cryptopanic.com/developers/api/
// For now, we'll use public endpoint (limited)
const API_KEY = import.meta.env.VITE_CRYPTOPANIC_KEY || 'free';

/**
 * Fetch latest crypto news
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} News articles
 */
export async function fetchCryptoNews(options = {}) {
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

        const data = await response.json();

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
 * @param {Object} votes - Vote counts
 * @returns {string} 'positive', 'negative', or 'neutral'
 */
function mapVotesToSentiment(votes) {
    if (!votes) return 'neutral';

    const positive = (votes.positive || 0) + (votes.important || 0);
    const negative = votes.negative || 0;

    if (positive > negative * 1.5) return 'positive';
    if (negative > positive * 1.5) return 'negative';
    return 'neutral';
}

/**
 * Get time ago string
 * @param {string} dateString - ISO date string
 * @returns {string} Human-readable time ago
 */
export function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Start polling for news updates
 * @param {Function} callback - Called with new articles
 * @param {number} interval - Poll interval in ms
 * @returns {Function} Cleanup function
 */
export function startNewsPolling(callback, interval = 60000) {
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
