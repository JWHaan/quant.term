import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

/**
 * Statistical Arbitrage Panel
 * Mean reversion, z-score analysis, and pair trading signals
 */
export const StatisticalArbitrage = ({ returns = [], price = 0 }) => {
    const analysis = useMemo(() => {
        if (!returns || returns.length < 20) {
            return {
                zscore: 0,
                mean: 0,
                stdDev: 0,
                signal: 'INSUFFICIENT_DATA',
                halfLife: 0,
                meanReversionStrength: 0,
                autocorrelation: 0
            };
        }

        // Calculate statistics
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        // Current z-score
        const currentReturn = returns[returns.length - 1];
        const zscore = stdDev > 0 ? (currentReturn - mean) / stdDev : 0;

        // Ornstein-Uhlenbeck mean reversion test
        // Calculate half-life of mean reversion
        let sumLagProduct = 0;
        let sumLagSquared = 0;

        for (let i = 1; i < returns.length; i++) {
            const lag = returns[i - 1];
            const current = returns[i];
            sumLagProduct += lag * current;
            sumLagSquared += lag * lag;
        }

        const theta = sumLagSquared > 0 ? -Math.log(sumLagProduct / sumLagSquared) : 0;
        const halfLife = theta > 0 ? Math.log(2) / theta : 0;

        // Mean reversion strength (0-1)
        const autocorr = sumLagSquared > 0 ? sumLagProduct / sumLagSquared : 0;
        const meanReversionStrength = Math.max(0, Math.min(1, 1 - Math.abs(autocorr)));

        // Generate signal
        let signal = 'NEUTRAL';
        if (zscore > 2.5) signal = 'STRONG_SELL';
        else if (zscore > 1.5) signal = 'SELL';
        else if (zscore < -2.5) signal = 'STRONG_BUY';
        else if (zscore < -1.5) signal = 'BUY';

        return {
            zscore: isFinite(zscore) ? zscore : 0,
            mean: isFinite(mean) ? mean : 0,
            stdDev: isFinite(stdDev) ? stdDev : 0,
            signal,
            halfLife: isFinite(halfLife) ? Math.min(halfLife, 100) : 0, // Cap at 100 periods
            meanReversionStrength: isFinite(meanReversionStrength) ? meanReversionStrength : 0,
            autocorrelation: isFinite(autocorr) ? autocorr : 0
        };
    }, [returns]);

    const getSignalColor = (signal) => {
        if (signal.includes('BUY')) return 'var(--accent-primary)';
        if (signal.includes('SELL')) return 'var(--accent-danger)';
        return 'var(--text-muted)';
    };

    const getZScoreColor = (z) => {
        const abs = Math.abs(z);
        if (abs > 2.5) return 'var(--accent-danger)';
        if (abs > 1.5) return 'var(--accent-warning)';
        return 'var(--accent-primary)';
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px' }}>
            {/* Main Signal */}
            <div style={{
                textAlign: 'center',
                marginBottom: '16px',
                padding: '16px',
                background: `linear-gradient(135deg, ${getSignalColor(analysis.signal)}15 0%, ${getSignalColor(analysis.signal)}05 100%)`,
                border: `1px solid ${getSignalColor(analysis.signal)}40`,
                borderRadius: '8px'
            }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    MEAN REVERSION SIGNAL
                </div>
                <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: getSignalColor(analysis.signal),
                    marginBottom: '4px'
                }}>
                    {analysis.signal.replace('_', ' ')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Strength: {(analysis.meanReversionStrength * 100).toFixed(0)}%
                </div>
            </div>

            {/* Z-Score Gauge */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    textAlign: 'center'
                }}>
                    Z-SCORE (STANDARD DEVIATIONS)
                </div>
                <div style={{
                    height: '50px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Colored zones */}
                    <div style={{
                        position: 'absolute',
                        left: '0%',
                        width: '10%',
                        top: 0,
                        bottom: 0,
                        background: 'rgba(255,0,85,0.2)'
                    }} />
                    <div style={{
                        position: 'absolute',
                        left: '10%',
                        width: '15%',
                        top: 0,
                        bottom: 0,
                        background: 'rgba(255,170,0,0.15)'
                    }} />
                    <div style={{
                        position: 'absolute',
                        right: '10%',
                        width: '15%',
                        top: 0,
                        bottom: 0,
                        background: 'rgba(255,170,0,0.15)'
                    }} />
                    <div style={{
                        position: 'absolute',
                        right: '0%',
                        width: '10%',
                        top: 0,
                        bottom: 0,
                        background: 'rgba(255,0,85,0.2)'
                    }} />

                    {/* Center line at 0 */}
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        background: 'rgba(255,255,255,0.3)',
                        transform: 'translateX(-50%)'
                    }} />

                    {/* Z-score indicator */}
                    <div style={{
                        position: 'absolute',
                        left: `${50 + (analysis.zscore / 5) * 50}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getZScoreColor(analysis.zscore),
                        boxShadow: `0 0 12px ${getZScoreColor(analysis.zscore)}`,
                        border: '2px solid #fff'
                    }} />

                    {/* Value display */}
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: '5px',
                        transform: 'translateX(-50%)',
                        fontSize: '16px',
                        fontWeight: '700',
                        fontFamily: 'var(--font-mono)',
                        color: getZScoreColor(analysis.zscore),
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}>
                        {analysis.zscore.toFixed(2)}σ
                    </div>
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9px',
                    color: 'var(--text-muted)',
                    marginTop: '4px'
                }}>
                    <span>-3σ</span>
                    <span>0</span>
                    <span>+3σ</span>
                </div>
            </div>

            {/* Statistics Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '12px'
            }}>
                <StatCard
                    label="Mean Return"
                    value={`${(analysis.mean * 100).toFixed(3)}%`}
                    color="var(--text-primary)"
                />
                <StatCard
                    label="Std Dev"
                    value={`${(analysis.stdDev * 100).toFixed(3)}%`}
                    color="var(--text-primary)"
                />
                <StatCard
                    label="Half-Life"
                    value={`${analysis.halfLife.toFixed(1)} periods`}
                    color="var(--accent-primary)"
                />
                <StatCard
                    label="Autocorr"
                    value={analysis.autocorrelation.toFixed(3)}
                    color={analysis.autocorrelation > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}
                />
            </div>

            {/* Trading Rules */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '10px',
                color: 'var(--text-muted)'
            }}>
                <div style={{ fontWeight: '600', marginBottom: '6px', color: '#fff' }}>
                    STRATEGY RULES
                </div>
                <div style={{ marginBottom: '3px' }}>• STRONG BUY: Z &lt; -2.5σ (Oversold)</div>
                <div style={{ marginBottom: '3px' }}>• BUY: Z &lt; -1.5σ</div>
                <div style={{ marginBottom: '3px' }}>• SELL: Z &gt; +1.5σ</div>
                <div>• STRONG SELL: Z &gt; +2.5σ (Overbought)</div>
            </div>

            {/* Info */}
            <div style={{
                marginTop: 'auto',
                fontSize: '9px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '8px'
            }}>
                Ornstein-Uhlenbeck Mean Reversion Model
            </div>
        </div>
    );
};

function StatCard({ label, value, color }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '10px'
        }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {label}
            </div>
            <div style={{
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: 'var(--font-mono)',
                color
            }}>
                {value}
            </div>
        </div>
    );
}

export default StatisticalArbitrage;
