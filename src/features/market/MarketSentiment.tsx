import { useEffect, useState } from 'react';
import fetchFearGreedIndex, { getSentimentColor, getSentimentLabel, FearGreedResponse } from '@/services/sentimentService';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

/**
 * MarketSentiment - Displays real Fear & Greed Index from Alternative.me
 * Updates daily, cached for 1 hour
 */
export const MarketSentiment = () => {
    const [sentiment, setSentiment] = useState<FearGreedResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadSentiment();
        // Refresh every hour
        const interval = setInterval(loadSentiment, 3600000);
        return () => clearInterval(interval);
    }, []);

    async function loadSentiment() {
        try {
            setLoading(true);
            const data = await fetchFearGreedIndex();
            if (data) {
                setSentiment(data);
                setError(null);
            } else {
                setError('No data available');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }

    if (loading && !sentiment) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <div className="skeleton" style={{ width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto' }} />
                <div className="skeleton" style={{ width: '80px', height: '20px', margin: '12px auto' }} />
            </div>
        );
    }

    if (error || !sentiment) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--accent-danger)' }}>
                <p>Sentiment data unavailable</p>
                <button
                    onClick={loadSentiment}
                    style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '11px'
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    const { current, history } = sentiment;
    const color = getSentimentColor(current.value);
    const label = getSentimentLabel(current.value);

    // Calculate trend (vs yesterday)
    const yesterday = history[1]?.value || current.value;
    const change = current.value - yesterday;
    const isUp = change > 0;

    return (
        <div style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%',
            justifyContent: 'center'
        }}>
            {/* Radial Gauge */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
                <svg width="140" height="140" viewBox="0 0 140 140">
                    {/* Background circle */}
                    <circle
                        cx="70"
                        cy="70"
                        r="60"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="12"
                    />
                    {/* Progress circle */}
                    <circle
                        cx="70"
                        cy="70"
                        r="60"
                        fill="none"
                        stroke={color}
                        strokeWidth="12"
                        strokeDasharray={`${(current.value / 100) * 377} 377`}
                        strokeDashoffset="94.25"
                        transform="rotate(-90 70 70)"
                        style={{
                            filter: `drop-shadow(0 0 8px ${color})`,
                            transition: 'stroke-dasharray 0.5s ease'
                        }}
                    />
                </svg>
                {/* Center value */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center'
                }}>
                    <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        fontFamily: 'var(--font-mono)',
                        color
                    }}>
                        {current.value}
                    </div>
                    <div style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        marginTop: '2px'
                    }}>
                        / 100
                    </div>
                </div>
            </div>

            {/* Label */}
            <div style={{
                fontSize: '18px',
                fontWeight: '600',
                color,
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
            }}>
                {label}
            </div>

            {/* Change indicator */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: isUp ? 'var(--accent-primary)' : 'var(--accent-danger)'
            }}>
                {isUp ? <TrendingUp size={14} /> : change < 0 ? <TrendingDown size={14} /> : <Activity size={14} />}
                {change !== 0 ? `${isUp ? '+' : ''}${change} vs yesterday` : 'No change'}
            </div>

            {/* Mini chart */}
            <div style={{ marginTop: '16px', width: '100%' }}>
                <div style={{
                    fontSize: '9px',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                    textAlign: 'center'
                }}>
                    LAST 30 DAYS
                </div>
                <div style={{
                    display: 'flex',
                    gap: '2px',
                    height: '30px',
                    alignItems: 'flex-end',
                    justifyContent: 'center'
                }}>
                    {history.slice(0, 14).reverse().map((day, i) => (
                        <div
                            key={i}
                            style={{
                                width: '6px',
                                height: `${(day.value / 100) * 30}px`,
                                background: getSentimentColor(day.value),
                                borderRadius: '2px 2px 0 0',
                                opacity: 0.7
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Source */}
            <div style={{
                marginTop: 'auto',
                fontSize: '9px',
                color: 'var(--text-muted)',
                textAlign: 'center'
            }}>
                Source: Alternative.me • Updates Daily
            </div>
        </div>
    );
};

export default MarketSentiment;
