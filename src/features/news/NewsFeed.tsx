import React, { useState, useEffect } from 'react';
import { fetchCryptoNews } from '@/services/cryptoPanicService';
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
                        source: article.source || 'CryptoPanic',
                        sentiment: (article.sentiment || 'neutral') as 'bullish' | 'bearish' | 'neutral',
                        timestamp: article.published,
                        url: article.url,
                        currencies: article.currencies
                    }));
                    setNews(mappedNews.slice(0, maxItems));
                    setLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Error fetching news:', err);
                    setError('Failed to load news. Using fallback data.');

                    // Fallback to mock data if API fails
                    const mockNews: NewsItem[] = [
                        {
                            id: '1',
                            title: `${symbol?.replace('USDT', '') || 'BTC'} sees increased institutional interest`,
                            source: 'CoinDesk',
                            sentiment: 'bullish',
                            timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
                            url: '#'
                        },
                        {
                            id: '2',
                            title: `Market analysis: ${symbol?.replace('USDT', '') || 'BTC'} consolidates`,
                            source: 'Bloomberg Crypto',
                            sentiment: 'neutral',
                            timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
                            url: '#'
                        },
                        {
                            id: '3',
                            title: `Technical outlook: Support levels hold for ${symbol?.replace('USDT', '') || 'BTC'}`,
                            source: 'CryptoQuant',
                            sentiment: 'bullish',
                            timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
                            url: '#'
                        }
                    ];
                    setNews(mockNews);
                    setLoading(false);
                }
            }
        };

        fetchNews();
        const interval = setInterval(fetchNews, 60000); // Refresh every 60 seconds

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
            <div style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                [FETCHING_NEWS_FEED]...
            </div>
        );
    }

    return (
        <div style={{ height: '100%', overflow: 'auto', fontFamily: 'var(--font-mono)', background: 'var(--bg-panel)' }}>
            {error && (
                <div style={{
                    padding: '8px 12px',
                    background: 'rgba(255,0,0,0.1)',
                    borderBottom: '1px solid var(--accent-danger)',
                    fontSize: '10px',
                    color: 'var(--accent-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <Newspaper size={12} />
                    [ERROR] {error}
                </div>
            )}

            {news.map((item) => (
                <div
                    key={item.id}
                    style={{
                        padding: '12px',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: 'transparent',
                        transition: 'background 0.2s'
                    }}
                    onClick={() => window.open(item.url, '_blank')}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(51, 255, 0, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <span style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            [{item.source}]
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                fontSize: '10px',
                                color: getSentimentColor(item.sentiment),
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                {getSentimentIcon(item.sentiment)}
                                {item.sentiment.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {formatTimestamp(item.timestamp)}
                            </span>
                        </div>
                    </div>
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        lineHeight: '1.4',
                        fontWeight: 'normal'
                    }}>
                        {item.title.toUpperCase()}
                    </div>
                </div>
            ))}

            {news.length === 0 && !loading && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
