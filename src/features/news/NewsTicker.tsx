import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchCryptoNews, getTimeAgo, startNewsPolling } from '@/services/cryptoPanicService';

interface NewsTickerItem {
    id: string;
    headline: string;
    source: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    time: string;
    url: string;
}

/**
 * News Ticker - Terminal-style scrolling headlines
 * Public crypto headlines from the CoinDesk and Cointelegraph news wire.
 */
const NewsTicker: React.FC = () => {
    const [news, setNews] = useState<NewsTickerItem[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch public news without shipping a secret API key.
    useEffect(() => {
        // Initial fetch
        const loadNews = async () => {
            setIsLoading(true);
            try {
                const articles = await fetchCryptoNews({ filter: 'trending', limit: 15 });
                if (articles.length > 0) {
                    setNews(articles.map(article => ({
                        id: String(article.id),
                        headline: article.headline,
                        source: article.source,
                        sentiment: article.sentiment,
                        time: getTimeAgo(article.published),
                        url: article.url
                    })));
                }
            } catch (error) {
                console.warn('[NewsTicker] Public feed unavailable.', error);
            }
            setIsLoading(false);
        };

        loadNews();

        // Poll for updates every five minutes.
        const cleanup = startNewsPolling((freshNews) => {
            setNews(freshNews.map(article => ({
                id: String(article.id),
                headline: article.headline,
                source: article.source,
                sentiment: article.sentiment as 'positive' | 'negative' | 'neutral',
                time: getTimeAgo(article.published),
                url: article.url
            })));
        }, 300000);

        return cleanup;
    }, []);

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return 'var(--accent-primary)';
            case 'negative': return 'var(--accent-danger)';
            default: return 'var(--text-secondary)';
        }
    };

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return <TrendingUp size={12} />;
            case 'negative': return <TrendingDown size={12} />;
            default: return <AlertCircle size={12} />;
        }
    };

    return (
        <div
            className="news-ticker"
            style={{
                width: '100%',
                height: '28px',
                background: 'var(--bg-app)',
                borderBottom: '1px solid var(--border-color)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'var(--font-mono)'
            }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* News-wire indicator */}
            <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '100px',
                background: 'var(--bg-app)',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '12px',
                gap: '6px',
                borderRight: '1px solid var(--border-subtle)'
            }}>
                <span className="cursor-blink" style={{
                    color: 'var(--accent-danger)',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }}>●</span>
                <span style={{
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: 'var(--accent-danger)',
                    letterSpacing: '1px'
                }}>
                    NEWSWIRE
                </span>
                <span style={{ color: 'var(--border-color)' }}>&gt;&gt;</span>
            </div>

            {/* Scrolling news */}
            <div
                style={{
                    display: 'flex',
                    gap: '32px',
                    paddingLeft: '110px',
                    animation: isPaused ? 'none' : 'scroll 60s linear infinite',
                    whiteSpace: 'nowrap'
                }}
            >
                {/* Duplicate news for seamless loop */}
                {isLoading ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        INITIALIZING NEWS FEED...
                    </div>
                ) : news.length ? (
                    [...news, ...news].map((item, index) => (
                        <a
                            key={`${item.id}-${index}`}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '11px',
                                color: getSentimentColor(item.sentiment),
                                cursor: 'pointer',
                                textDecoration: 'none'
                            }}
                            title="Click to read full article"
                        >
                            <span style={{ color: 'var(--text-muted)' }}>[</span>
                            {getSentimentIcon(item.sentiment)}
                            <span style={{ color: 'var(--text-muted)' }}>]</span>
                            <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>
                                {item.source.toUpperCase()}
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                                {item.headline.toUpperCase()}
                            </span>
                            <span style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                marginLeft: '4px'
                            }}>
                                :: {item.time}
                            </span>
                        </a>
                    ))
                ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>NEWS WIRE UNAVAILABLE · MARKET DATA REMAINS LIVE</div>
                )}
            </div>

            {/* Right fade */}
            <div style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '50px',
                background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, var(--bg-app) 100%)',
                pointerEvents: 'none'
            }} />

            <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
        </div>
    );
};

export default NewsTicker;
