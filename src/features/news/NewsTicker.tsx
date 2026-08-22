import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchCryptoNews, getTimeAgo, startNewsPolling } from '@/integrations/news/client';

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
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* News-wire indicator */}
            <div className="news-ticker__brand">
                <span className="cursor-blink news-ticker__dot">●</span>
                <span className="news-ticker__label">NEWSWIRE</span>
                <span style={{ color: 'var(--border-color)' }}>&gt;&gt;</span>
            </div>

            {/* Scrolling news */}
            <div className={`news-ticker__track${isPaused ? ' is-paused' : ''}`}>
                {/* Duplicate news for seamless loop */}
                {isLoading ? (
                    <div className="news-ticker__msg">
                        INITIALIZING NEWS FEED...
                    </div>
                ) : news.length ? (
                    [...news, ...news].map((item, index) => (
                        <a
                            key={`${item.id}-${index}`}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="news-ticker__item"
                            style={{ color: getSentimentColor(item.sentiment) }}
                            title="Click to read full article"
                        >
                            <span className="news-ticker__bracket">[</span>
                            {getSentimentIcon(item.sentiment)}
                            <span className="news-ticker__bracket">]</span>
                            <span className="news-ticker__src">
                                {item.source.toUpperCase()}
                            </span>
                            <span className="news-ticker__headline">
                                {item.headline.toUpperCase()}
                            </span>
                            <span className="news-ticker__time">
                                :: {item.time}
                            </span>
                        </a>
                    ))
                ) : (
                    <div className="news-ticker__msg">NEWS WIRE UNAVAILABLE · MARKET DATA REMAINS LIVE</div>
                )}
            </div>

            {/* Right fade */}
            <div className="news-ticker__fade" />
        </div>
    );
};

export default NewsTicker;
