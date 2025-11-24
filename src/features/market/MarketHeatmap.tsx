import React, { useMemo, useState, useEffect, useRef } from 'react';
import { generateTreeMap, TreeMapItem } from '@/utils/treemap';
import { TOP_CRYPTOS } from '@/data/cryptoAssets';
import { multiAssetWS } from '@/services/multiAssetWebSocket';

/**
 * Market Heatmap - TreeMap visualization
 * Size = Market Cap (approximated by volume/price or static weight)
 * Color = 24h Change
 */
interface MarketHeatmapProps {
    onSelectSymbol?: (symbol: string) => void;
}

const MarketHeatmap: React.FC<MarketHeatmapProps> = ({ onSelectSymbol }) => {
    const [marketData, setMarketData] = useState<Map<string, any>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Subscribe to data
    useEffect(() => {
        const symbols = TOP_CRYPTOS.map(c => c.symbol);

        const handleUpdate = ({ symbol, data }: { symbol: string, data: any }) => {
            setMarketData(prev => {
                const next = new Map(prev);
                next.set(symbol, { ...data, symbol });
                return next;
            });
        };

        multiAssetWS.subscribe(symbols, handleUpdate);
        return () => multiAssetWS.unsubscribe(symbols, handleUpdate);
    }, []);

    // Handle resize
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
            if (!entries[0]) return;
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Generate TreeMap layout
    const items = useMemo(() => {
        if (dimensions.width === 0 || dimensions.height === 0) return [];

        // Prepare data
        const data = TOP_CRYPTOS.map(crypto => {
            const liveData = marketData.get(crypto.symbol);
            // Use quote volume as proxy for market cap/importance if real mcap not available
            // Or use a static weight based on rank if no data yet
            const value = liveData?.quoteVolume || (1000000000 / (TOP_CRYPTOS.indexOf(crypto) + 1));
            const change = liveData?.priceChangePercent || 0;

            return {
                id: crypto.symbol,
                label: crypto.symbol.replace('USDT', ''),
                value,
                change,
                category: crypto.category
            };
        });

        return generateTreeMap(data, dimensions.width, dimensions.height);
    }, [marketData, dimensions]);

    const getColor = (change: number) => {
        if (change === 0) return '#2a2a2a';

        // Green for positive, Red for negative
        // Intensity based on magnitude
        const absChange = Math.min(Math.abs(change), 10); // Cap at 10%
        const intensity = (absChange / 10); // 0 to 1

        if (change > 0) {
            // Dark green to bright green
            return `rgba(0, 255, 157, ${0.2 + intensity * 0.8})`;
        } else {
            // Dark red to bright red
            return `rgba(255, 0, 85, ${0.2 + intensity * 0.8})`;
        }
    };

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
            {items.map((item: TreeMapItem) => (
                <div
                    key={item.id}
                    style={{
                        position: 'absolute',
                        left: item.x,
                        top: item.y,
                        width: (item.w || 0) - 1, // Gap
                        height: (item.h || 0) - 1, // Gap
                        background: getColor(item.change),
                        border: '1px solid rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'background 0.3s'
                    }}
                    onClick={() => onSelectSymbol && onSelectSymbol(item.id)}
                    title={`${item.label}: ${item.change.toFixed(2)}%`}
                >
                    {(item.w || 0) > 30 && (item.h || 0) > 20 && (
                        <>
                            <span style={{
                                fontSize: Math.min((item.w || 0) / 4, (item.h || 0) / 3, 14) + 'px',
                                fontWeight: 'bold',
                                color: '#fff',
                                textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                            }}>
                                {item.label}
                            </span>
                            {(item.h || 0) > 35 && (
                                <span style={{
                                    fontSize: Math.min((item.w || 0) / 5, (item.h || 0) / 4, 11) + 'px',
                                    color: 'rgba(255,255,255,0.9)',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                }}>
                                    {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                                </span>
                            )}
                        </>
                    )}
                </div>
            ))}
            {items.length === 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)'
                }}>
                    Loading Heatmap...
                </div>
            )}
        </div>
    );
};

export default MarketHeatmap;
