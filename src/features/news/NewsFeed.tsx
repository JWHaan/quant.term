import React, { useState, useEffect } from 'react';
import { fetchCryptoNews } from '@/integrations/news/client';
import { Newspaper, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface NewsFeedProps {
    symbol?: string;
    maxItems?: number;
}

interface NewsItem {
    id: string;
    title: string;
    source: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    timestamp: string;
    url: string;
    currencies?: string[];
}

const NewsFeed: React.FC<NewsFeedProps> = ({ symbol, maxItems = 20 }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchNews = async () => {
            try {
                setError(null);

                // Extract currency from symbol (e.g., BTCUSDT -> BTC)
                const currency = symbol ? symbol.replace('USDT', '').replace('USD', '') : undefined;

                const newsData = await fetchCryptoNews({
                    ...(currency && { currencies: currency }),
                    filter: 'rising'
                });

                if (!cancelled && newsData) {
                    const mappedNews: NewsItem[] = newsData.map(article => ({
                        id: String(article.id),
                        title: article.headline,
                        source: article.source || 'News wire',
                        sentiment: (article.sentiment || 'neutral') as 'bullish' | 'bearish' | 'neutral',
                        timestamp: article.published,
                        url: article.url,
                        currencies: article.currencies
                    }));
                    setNews(mappedNews.slice(0, maxItems));
                    if (mappedNews.length === 0) setError('No headlines are currently available from the public feed.');
                    setLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Error fetching news:', err);
                    setError('The CoinDesk / Cointelegraph news wire is temporarily unavailable.');
                    setNews([]);
                    setLoading(false);
                }
            }
        };

        fetchNews();
        const interval = setInterval(fetchNews, 300000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [symbol, maxItems]);

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'bullish':
            case 'positive':
                return 'var(--accent-success)';
            case 'bearish':
            case 'negative':
                return 'var(--accent-danger)';
            default:
                return 'var(--text-secondary)';
        }
    };

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'bullish':
            case 'positive':
                return <TrendingUp size={12} />;
            case 'bearish':
            case 'negative':
                return <TrendingDown size={12} />;
            default:
                return <Minus size={12} />;
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'NOW';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
        return `${Math.floor(diffMins / 1440)}d`;
    };

    if (loading) {
        return (
            <div className="feed-init">
                [FETCHING_NEWS_FEED]...
            </div>
        );
    }

    return (
        <div className="news-feed">
            {error && (
                <div className="news-feed__error">
                    <Newspaper size={12} />
                    [ERROR] {error}
                </div>
            )}

            {news.map((item) => (
                <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-item-card"
                >
                    <div className="news-item-card__meta">
                        <span className="news-item-card__src">
                            [{item.source}]
                        </span>
                        <div className="news-item-card__flags">
                            <span
                                className="news-item-card__sentiment"
                                style={{ color: getSentimentColor(item.sentiment) }}
                            >
                                {getSentimentIcon(item.sentiment)}
                                {item.sentiment.toUpperCase()}
                            </span>
                            <span className="news-item-card__stamp tnum">
                                {formatTimestamp(item.timestamp)}
                            </span>
                        </div>
                    </div>
                    <div className="news-item-card__title">
                        {item.title.toUpperCase()}
                    </div>
                </a>
            ))}

            {news.length === 0 && !loading && (
                <div className="news-feed__empty">
                    <Newspaper size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p>NO_DATA_AVAILABLE</p>
                    <p style={{ fontSize: '12px', marginTop: '8px' }}>
                        {symbol ? `NO_NEWS_FOR_${symbol.replace('USDT', '')}` : 'SELECT_SYMBOL'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default NewsFeed;
