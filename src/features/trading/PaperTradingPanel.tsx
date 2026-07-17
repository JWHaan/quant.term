import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, X } from 'lucide-react';
import { useMarketData, useMarketStore } from '@/stores/marketStore';
import { calculatePositionPnl, usePortfolioStore, type PaperSide } from '@/stores/portfolioStore';
import { formatPrice, formatVolume } from '@/utils/format';

interface PaperTradingPanelProps {
    symbol: string;
}

const PaperTradingPanel: React.FC<PaperTradingPanelProps> = ({ symbol }) => {
    const market = useMarketData(symbol);
    const marketData = useMarketStore((state) => state.marketData);
    const [quantity, setQuantity] = useState('0.01');
    const [leverage, setLeverage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const { startingBalance, realizedPnl, positions, trades, openPosition, closePosition, updatePrice } = usePortfolioStore();

    useEffect(() => {
        usePortfolioStore.getState().positions.forEach((position) => {
            const livePrice = marketData[position.symbol]?.price;
            if (livePrice && livePrice !== position.currentPrice) {
                updatePrice(position.symbol, livePrice);
            }
        });
    }, [marketData, updatePrice]);

    const unrealizedPnl = useMemo(
        () => positions.reduce((total, position) => total + calculatePositionPnl(position), 0),
        [positions]
    );
    const wins = trades.filter((trade) => trade.realizedPnl > 0).length;
    const equity = startingBalance + realizedPnl + unrealizedPnl;

    const submit = (side: PaperSide) => {
        setError(null);
        try {
            openPosition({
                symbol,
                side,
                quantity: Number(quantity),
                leverage,
                entryPrice: market?.price ?? 0,
            });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to create paper position');
        }
    };

    return (
        <section className="terminal-stack" aria-label="Paper trading portfolio">
            <div className="paper-disclaimer" role="note">
                <AlertTriangle size={12} /> SIMULATED EXECUTION · NO ORDERS ARE SENT
            </div>

            <div className="metric-grid metric-grid--four">
                <div className="metric"><span>Equity</span><strong>${formatVolume(equity)}</strong></div>
                <div className="metric"><span>Realized</span><strong className={realizedPnl >= 0 ? 'positive' : 'negative'}>${formatVolume(realizedPnl)}</strong></div>
                <div className="metric"><span>Unrealized</span><strong className={unrealizedPnl >= 0 ? 'positive' : 'negative'}>${formatVolume(unrealizedPnl)}</strong></div>
                <div className="metric"><span>Win rate</span><strong>{trades.length ? `${((wins / trades.length) * 100).toFixed(0)}%` : '—'}</strong></div>
            </div>

            <div className="ticket-row">
                <div className="ticket-price">
                    <span>{symbol.replace('USDT', '')}/USDT</span>
                    <strong>{market ? formatPrice(market.price) : 'WAITING…'}</strong>
                </div>
                <label>
                    <span>Quantity</span>
                    <input value={quantity} inputMode="decimal" onChange={(event) => setQuantity(event.target.value)} aria-label="Paper trade quantity" />
                </label>
                <label>
                    <span>Leverage</span>
                    <select value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} aria-label="Paper trade leverage">
                        {[1, 2, 5, 10].map((value) => <option key={value} value={value}>{value}×</option>)}
                    </select>
                </label>
                <button className="trade-button trade-button--long" disabled={!market?.price} onClick={() => submit('LONG')}>
                    <ArrowUpRight size={13} /> Long
                </button>
                <button className="trade-button trade-button--short" disabled={!market?.price} onClick={() => submit('SHORT')}>
                    <ArrowDownRight size={13} /> Short
                </button>
            </div>
            {error && <div className="inline-error" role="alert">{error}</div>}

            <div className="terminal-table-wrap">
                <table className="terminal-table">
                    <thead><tr><th>Position</th><th>Qty</th><th>Entry</th><th>Mark</th><th>P&amp;L</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                        {positions.map((position) => {
                            const pnl = calculatePositionPnl(position);
                            return (
                                <tr key={position.id}>
                                    <td><span className={position.side === 'LONG' ? 'positive' : 'negative'}>{position.side}</span> {position.symbol.replace('USDT', '')} <small>{position.leverage}×</small></td>
                                    <td>{position.quantity}</td>
                                    <td>{formatPrice(position.entryPrice)}</td>
                                    <td>{formatPrice(position.currentPrice)}</td>
                                    <td className={pnl >= 0 ? 'positive' : 'negative'}>${pnl.toFixed(2)}</td>
                                    <td><button className="icon-action" onClick={() => closePosition(position.id, position.currentPrice)} aria-label={`Close ${position.side} ${position.symbol} position at its latest recorded mark`}><X size={12} /></button></td>
                                </tr>
                            );
                        })}
                        {!positions.length && <tr><td colSpan={6} className="empty-cell">No open paper positions</td></tr>}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default PaperTradingPanel;
