import React, { useState, useEffect } from 'react';

const NewsFeed = ({ symbol }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // For now, use a simple RSS feed approach or mock data
        // In production, integrate CryptoPanic API with your API key
        const fetchNews = async () => {
            try {
                // Mock news data for demonstration
                const mockNews = [
                    {
                        id: 1,
                        title: `${symbol.replace('USDT', '')} sees increased institutional interest`,
                        source: 'CoinDesk',
                        sentiment: 'bullish',
                        timestamp: new Date(Date.now() - 1000 * 60 * 15).toLocaleTimeString(),
                        url: '#'
                    },
                    {
                        id: 2,
                        title: `Market analysis: ${symbol.replace('USDT', '')} consolidates`,
                        source: 'Bloomberg Crypto',
                        sentiment: 'neutral',
                        timestamp: new Date(Date.now() - 1000 * 60 * 45).toLocaleTimeString(),
                        url: '#'
                    },
                    {
                        id: 3,
                        title: `Technical outlook: Support levels hold for ${symbol.replace('USDT', '')}`,
                        source: 'CryptoQuant',
                        sentiment: 'bullish',
                        timestamp: new Date(Date.now() - 1000 * 60 * 120).toLocaleTimeString(),
                        url: '#'
                    },
                    {
                        id: 4,
                        title: `Whale alert: Large ${symbol.replace('USDT', '')} transfer detected`,
                        source: 'Whale Alert',
                        sentiment: 'neutral',
                        timestamp: new Date(Date.now() - 1000 * 60 * 180).toLocaleTimeString(),
                        url: '#'
                    }
                ];

                setNews(mockNews);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching news:', error);
                setLoading(false);
            }
        };

        fetchNews();
        const interval = setInterval(fetchNews, 120000); // Refresh every 2 minutes

        return () => clearInterval(interval);
    }, [symbol]);

    const getSentimentColor = (sentiment) => {
        switch (sentiment) {
            case 'bullish': return 'var(--accent-primary)';
            case 'bearish': return 'var(--accent-danger)';
            default: return 'var(--text-secondary)';
        }
    };

    const getSentimentIcon = (sentiment) => {
        switch (sentiment) {
            case 'bullish': return '↗';
            case 'bearish': return '↘';
            default: return '→';
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '12px' }}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton" style={{ width: '100%', height: '60px', marginBottom: '8px', borderRadius: '4px' }} />
                ))}
            </div>
        );
    }

    return (
        <div style={{ height: '100%', overflow: 'auto', fontFamily: 'var(--font-ui)' }}>
            {news.map((item) => (
                <div
                    key={item.id}
                    className="hover-scale smooth-transition"
                    style={{
                        padding: '12px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        background: 'transparent'
                    }}
                    onClick={() => window.open(item.url, '_blank')}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {item.source}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                fontSize: '10px',
                                color: getSentimentColor(item.sentiment),
                                fontWeight: '600'
                            }}>
                                {getSentimentIcon(item.sentiment)} {item.sentiment.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {item.timestamp}
                            </span>
                        </div>
                    </div>
                    <div style={{
                        fontSize: '13px',
                        color: '#fff',
                        lineHeight: '1.4',
                        fontWeight: '500'
                    }}>
                        {item.title}
                    </div>
                </div>
            ))}

            {news.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>No recent news available</p>
                    <p style={{ fontSize: '12px', marginTop: '8px' }}>
                        Configure CryptoPanic API key for live news
                    </p>
                </div>
            )}
        </div>
    );
};

export default NewsFeed;
