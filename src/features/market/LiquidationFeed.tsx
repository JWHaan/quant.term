import React, { useState, useEffect, useRef } from 'react';
import { subscribeLiquidations, type Liquidation as StreamLiquidation, type LiquidationSubscription } from '@/integrations/binance/liquidations';
import { TrendingDown, TrendingUp, Droplets } from 'lucide-react';
import { formatPrice } from '@/utils/format';
import {
    getBinanceFuturesContract,
    normalizeBinanceFuturesPrice,
    normalizeBinanceFuturesQuantity,
} from '@/integrations/binance/contracts';

interface LiquidationFeedProps {
    symbol?: string;
}

interface Liquidation {
    id: string;
    time: number;
    side: 'LONG' | 'SHORT';
    price: number;
    amount: number;
    value: number;
    symbol: string;
}

interface LiquidationStats {
    totalVol: number;
    longVol: number;
    shortVol: number;
}

/**
 * Liquidation Feed (The "Rekt" Tape)
 * Terminal-style liquidation feed
 */
const LiquidationFeed: React.FC<LiquidationFeedProps> = ({ symbol = 'BTCUSDT' }) => {
    const contract = getBinanceFuturesContract(symbol);
    const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
    const [stats, setStats] = useState<LiquidationStats>({ totalVol: 0, longVol: 0, shortVol: 0 });
    const subscriptionRef = useRef<LiquidationSubscription | null>(null);

    useEffect(() => {
        const handleLiquidation = (liq: StreamLiquidation) => {
            if (liq.symbol !== contract.futuresSymbol) return;

            const normalizedPrice = normalizeBinanceFuturesPrice(liq.price, contract.multiplier);
            const normalizedQuantity = normalizeBinanceFuturesQuantity(liq.quantity, contract.multiplier);

            const newLiq: Liquidation = {
                id: `${liq.symbol}-${liq.time}-${liq.side}`,
                time: liq.time,
                side: liq.isBuy ? 'SHORT' : 'LONG', // BUY order = short squeeze, SELL order = long liquidation
                price: normalizedPrice,
                amount: normalizedQuantity,
                value: liq.value,
                symbol: contract.spotSymbol,
            };

            setLiquidations(prev => [newLiq, ...prev].slice(0, 50));

            setStats(prev => ({
                totalVol: prev.totalVol + liq.value,
                longVol: !liq.isBuy ? prev.longVol + liq.value : prev.longVol,
                shortVol: liq.isBuy ? prev.shortVol + liq.value : prev.shortVol
            }));
        };

        subscriptionRef.current = subscribeLiquidations(handleLiquidation);

        return () => {
            subscriptionRef.current?.close();
            subscriptionRef.current = null;
        };
    }, [contract.futuresSymbol, contract.multiplier, contract.spotSymbol]);

    const formatValue = (val: number) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
        return `$${val.toFixed(0)}`;
    };

    const formatTime = (ts: number) => {
        const date = new Date(ts);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    };

    return (
        <div className="tape">
            {/* Header Stats */}
            <div className="tape-stats">
                <div className="tape-stat" style={{ color: 'var(--accent-danger)' }}>
                    <TrendingDown size={12} />
                    <span>SESSION LONG LIQS: {formatValue(stats.longVol)}</span>
                </div>
                <div className="tape-stat" style={{ color: 'var(--accent-success)' }}>
                    <TrendingUp size={12} />
                    <span>SESSION SHORT LIQS: {formatValue(stats.shortVol)}</span>
                </div>
            </div>

            {/* Column Headers */}
            <div className="tape-cols">
                <div>TIME</div>
                <div>PRICE</div>
                <div>VAL</div>
                <div>TYPE</div>
            </div>

            {/* List */}
            <div className="tape-body no-scrollbar">
                {liquidations.length === 0 ? (
                    <div className="tape-empty">
                        <Droplets size={24} />
                        <span>SCANNING_FOR_LIQUIDATIONS...</span>
                        <small>[TARGET: {contract.futuresSymbol} · !forceOrder@arr]</small>
                    </div>
                ) : (
                    liquidations.map(liq => (
                        <div
                            key={liq.id}
                            className={`tape-row tape-row--${liq.side.toLowerCase()}${liq.value > 10000 ? ' tape-row--big' : ''}`}
                        >
                            <div className="tape-row__time tnum">{formatTime(liq.time)}</div>
                            <div className="tape-row__price tnum">{formatPrice(liq.price)}</div>
                            <div className="tnum" style={{ fontWeight: liq.value > 10000 ? 'bold' : 'normal' }}>
                                {formatValue(liq.value)}
                            </div>
                            <div className="tape-row__type">
                                {liq.side === 'LONG' ? '[LONG]' : '[SHRT]'}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default LiquidationFeed;
