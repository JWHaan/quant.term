import React, { useMemo } from 'react';
import { TrendingUp, Award, AlertTriangle } from 'lucide-react';

/**
 * Backtesting Dashboard
 * Shows performance metrics for trading strategies
 */
export const BacktestingDashboard = ({ trades = [], initialCapital = 10000 }) => {
    const metrics = useMemo(() => {
        if (!trades || trades.length === 0) {
            return {
                totalReturn: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                winRate: 0,
                profitFactor: 0,
                avgWin: 0,
                avgLoss: 0,
                totalTrades: 0,
                expectancy: 0
            };
        }

        // Calculate returns
        const returns = trades.map(t => (t.pnl / initialCapital) * 100);
        const totalReturn = returns.reduce((sum, r) => sum + r, 0);

        // Sharpe Ratio (assuming 252 trading days, 0% risk-free rate)
        const meanReturn = totalReturn / trades.length;
        const stdDev = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / trades.length
        );
        const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

        // Max Drawdown
        let peak = initialCapital;
        let maxDrawdown = 0;
        let equity = initialCapital;

        trades.forEach(trade => {
            equity += trade.pnl;
            if (equity > peak) peak = equity;
            const drawdown = ((peak - equity) / peak) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });

        // Win rate and profit factor
        const wins = trades.filter(t => t.pnl > 0);
        const losses = trades.filter(t => t.pnl < 0);
        const winRate = (wins.length / trades.length) * 100;

        const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
        const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

        const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
        const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;

        // Expectancy
        const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

        return {
            totalReturn,
            sharpeRatio,
            maxDrawdown,
            winRate,
            profitFactor,
            avgWin,
            avgLoss,
            totalTrades: trades.length,
            expectancy,
            wins: wins.length,
            losses: losses.length
        };
    }, [trades, initialCapital]);

    const getRatingColor = (value, thresholds) => {
        if (value >= thresholds.good) return 'var(--accent-primary)';
        if (value >= thresholds.ok) return 'var(--accent-warning)';
        return 'var(--accent-danger)';
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'auto' }}>
            {/* Header Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '16px'
            }}>
                <MetricCard
                    label="Total Return"
                    value={`${metrics.totalReturn.toFixed(2)}%`}
                    color={metrics.totalReturn >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}
                    icon={<TrendingUp size={16} />}
                />
                <MetricCard
                    label="Sharpe Ratio"
                    value={metrics.sharpeRatio.toFixed(2)}
                    color={getRatingColor(metrics.sharpeRatio, { good: 2, ok: 1 })}
                    icon={<Award size={16} />}
                />
                <MetricCard
                    label="Max Drawdown"
                    value={`${metrics.maxDrawdown.toFixed(1)}%`}
                    color={getRatingColor(-metrics.maxDrawdown, { good: -10, ok: -20 })}
                    icon={<AlertTriangle size={16} />}
                />
            </div>

            {/* Performance Breakdown */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '14px',
                borderRadius: '8px',
                marginBottom: '12px'
            }}>
                <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#fff',
                    marginBottom: '12px'
                }}>
                    STRATEGY PERFORMANCE
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
                    <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Win Rate</div>
                        <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            fontFamily: 'var(--font-mono)',
                            color: getRatingColor(metrics.winRate, { good: 60, ok: 50 })
                        }}>
                            {metrics.winRate.toFixed(1)}%
                        </div>
                        <div style={{
                            fontSize: '9px',
                            color: 'var(--text-muted)',
                            marginTop: '2px'
                        }}>
                            {metrics.wins}W / {metrics.losses}L
                        </div>
                    </div>

                    <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Profit Factor</div>
                        <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            fontFamily: 'var(--font-mono)',
                            color: getRatingColor(metrics.profitFactor, { good: 2, ok: 1.5 })
                        }}>
                            {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
                        </div>
                        <div style={{
                            fontSize: '9px',
                            color: 'var(--text-muted)',
                            marginTop: '2px'
                        }}>
                            Win/Loss Ratio
                        </div>
                    </div>

                    <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Avg Win</div>
                        <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent-primary)'
                        }}>
                            ${metrics.avgWin.toFixed(2)}
                        </div>
                    </div>

                    <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Avg Loss</div>
                        <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent-danger)'
                        }}>
                            ${metrics.avgLoss.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expectancy */}
            <div style={{
                background: `linear-gradient(135deg, ${metrics.expectancy >= 0 ? 'rgba(0,255,157,0.1)' : 'rgba(255,0,85,0.1)'} 0%, transparent 100%)`,
                border: `1px solid ${metrics.expectancy >= 0 ? 'rgba(0,255,157,0.3)' : 'rgba(255,0,85,0.3)'}`,
                borderRadius: '8px',
                padding: '14px',
                textAlign: 'center',
                marginBottom: '12px'
            }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    EXPECTANCY (Expected $ per trade)
                </div>
                <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    fontFamily: 'var(--font-mono)',
                    color: metrics.expectancy >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'
                }}>
                    ${metrics.expectancy.toFixed(2)}
                </div>
            </div>

            {/* Rating Guide */}
            <div style={{
                background: 'rgba(255,200,0,0.1)',
                border: '1px solid rgba(255,200,0,0.3)',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '9px',
                color: 'var(--text-muted)'
            }}>
                <div style={{ fontWeight: '600', marginBottom: '6px', color: '#FFC800' }}>
                    PERFORMANCE BENCHMARKS
                </div>
                <div>• Sharpe &gt; 2: Excellent | 1-2: Good | &lt;1: Poor</div>
                <div>• Profit Factor &gt; 2: Strong | 1.5-2: Good | &lt;1.5: Weak</div>
                <div>• Max DD &lt; 10%: Excellent | 10-20%: Good | &gt;20%: High Risk</div>
            </div>

            {/* Footer */}
            <div style={{
                marginTop: 'auto',
                fontSize: '9px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '8px'
            }}>
                Based on {metrics.totalTrades} historical trades
            </div>
        </div>
    );
};

function MetricCard({ label, value, color, icon }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px'
            }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ color }}>{icon}</span>
            </div>
            <div style={{
                fontSize: '18px',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)',
                color
            }}>
                {value}
            </div>
        </div>
    );
}

export default BacktestingDashboard;
