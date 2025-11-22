import React, { useState, useMemo } from 'react';
import { Shield, DollarSign, Percent, TrendingUp } from 'lucide-react';

/**
 * Risk Analytics - Position sizing, Kelly Criterion, VaR Calculator
 */
export const RiskAnalytics = ({ price = 0, volatility = 0.3, returns = [] }) => {
    const [capital, setCapital] = useState(10000);
    const [riskPercent, setRiskPercent] = useState(2);
    const [stopLossPercent, setStopLossPercent] = useState(5);
    const [winRate, setWinRate] = useState(55);
    const [avgWin, setAvgWin] = useState(1.5);
    const [avgLoss, setAvgLoss] = useState(1);

    const analytics = useMemo(() => {
        // Kelly Criterion: f* = (bp - q) / b
        // where b = avg win/loss ratio, p = win rate, q = loss rate
        const p = winRate / 100;
        const q = 1 - p;
        const b = avgWin / avgLoss;
        const kellyFraction = (b * p - q) / b;
        const kellyPercent = Math.max(0, Math.min(100, kellyFraction * 100));

        // Position Size based on risk
        const riskAmount = (capital * riskPercent) / 100;
        const stopLossAmount = (price * stopLossPercent) / 100;
        const positionSize = stopLossAmount > 0 ? riskAmount / stopLossAmount : 0;

        // Value at Risk (95% confidence)
        const varDaily = price * volatility * 1.65 / Math.sqrt(252); // 95% VaR
        const var95 = positionSize * varDaily;

        // Expected value
        const expectancy = (p * avgWin) - (q * avgLoss);

        // Risk-Reward Ratio
        const riskRewardRatio = avgWin / avgLoss;

        // Recommended position size
        const conservativeSize = Math.min(
            positionSize,
            (capital * kellyPercent / 100) / price,
            capital * 0.25 / price // Never more than 25% of capital
        );

        return {
            kellyPercent,
            positionSize,
            conservativeSize,
            var95,
            varPercent: (var95 / capital) * 100,
            expectancy,
            riskRewardRatio,
            maxLoss: positionSize * stopLossAmount,
            potentialGain: positionSize * price * (avgWin / 100)
        };
    }, [capital, riskPercent, stopLossPercent, winRate, avgWin, avgLoss, price, volatility]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'auto' }}>
            {/* Input Controls */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '12px'
            }}>
                <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '10px', color: '#fff' }}>
                    PORTFOLIO SETTINGS
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Capital: ${capital.toLocaleString()}
                    </label>
                    <input
                        type="range"
                        min="1000"
                        max="100000"
                        step="1000"
                        value={capital}
                        onChange={(e) => setCapital(parseInt(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            Risk per Trade: {riskPercent}%
                        </label>
                        <input
                            type="range"
                            min="0.5"
                            max="10"
                            step="0.5"
                            value={riskPercent}
                            onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            Stop Loss: {stopLossPercent}%
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            step="0.5"
                            value={stopLossPercent}
                            onChange={(e) => setStopLossPercent(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            Win Rate: {winRate}%
                        </label>
                        <input
                            type="range"
                            min="30"
                            max="80"
                            step="1"
                            value={winRate}
                            onChange={(e) => setWinRate(parseInt(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            Avg Win: {avgWin}%
                        </label>
                        <input
                            type="range"
                            min="0.5"
                            max="5"
                            step="0.1"
                            value={avgWin}
                            onChange={(e) => setAvgWin(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            Avg Loss: {avgLoss}%
                        </label>
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={avgLoss}
                            onChange={(e) => setAvgLoss(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            {/* Kelly Criterion */}
            <div style={{
                background: `linear-gradient(135deg, ${analytics.kellyPercent > 0 ? 'rgba(0,255,157,0.1)' : 'rgba(255,0,85,0.1)'} 0%, transparent 100%)`,
                border: `1px solid ${analytics.kellyPercent > 0 ? 'rgba(0,255,157,0.3)' : 'rgba(255,0,85,0.3)'}`,
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    KELLY CRITERION (Optimal Bet Size)
                </div>
                <div style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    fontFamily: 'var(--font-mono)',
                    color: analytics.kellyPercent > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'
                }}>
                    {analytics.kellyPercent.toFixed(1)}%
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    of total capital per trade
                </div>
            </div>

            {/* Position Sizing */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginBottom: '12px'
            }}>
                <RiskCard
                    icon={<DollarSign size={14} />}
                    label="Position Size"
                    value={analytics.conservativeSize.toFixed(4)}
                    subtitle={`$${(analytics.conservativeSize * price).toFixed(0)}`}
                    color="var(--accent-primary)"
                />
                <RiskCard
                    icon={<Shield size={14} />}
                    label="Max Loss (VaR 95%)"
                    value={`$${analytics.var95.toFixed(2)}`}
                    subtitle={`${analytics.varPercent.toFixed(2)}% of capital`}
                    color="var(--accent-danger)"
                />
                <RiskCard
                    icon={<TrendingUp size={14} />}
                    label="Expectancy"
                    value={analytics.expectancy.toFixed(3)}
                    subtitle={`${analytics.expectancy >= 0 ? 'Positive' : 'Negative'} Edge`}
                    color={analytics.expectancy >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}
                />
                <RiskCard
                    icon={<Percent size={14} />}
                    label="R:R Ratio"
                    value={`1:${analytics.riskRewardRatio.toFixed(2)}`}
                    subtitle={analytics.riskRewardRatio >= 2 ? 'Good' : 'Improve'}
                    color={analytics.riskRewardRatio >= 2 ? 'var(--accent-primary)' : 'var(--accent-warning)'}
                />
            </div>

            {/* Guidelines */}
            <div style={{
                background: 'rgba(255,200,0,0.1)',
                border: '1px solid rgba(255,200,0,0.3)',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '9px',
                color: 'var(--text-muted)'
            }}>
                <div style={{ fontWeight: '600', marginBottom: '6px', color: '#FFC800' }}>
                    RISK MANAGEMENT RULES
                </div>
                <div>• Never risk more than 2% per trade</div>
                <div>• Use 25-50% of Kelly for safety</div>
                <div>• Min R:R ratio: 1:1.5, Target: 1:2+</div>
                <div>• VaR should be &lt; 3% of total capital</div>
            </div>

            {/* Footer */}
            <div style={{
                marginTop: 'auto',
                fontSize: '9px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '8px'
            }}>
                Price: ${price.toFixed(2)} | IV: {(volatility * 100).toFixed(1)}%
            </div>
        </div>
    );
};

function RiskCard({ icon, label, value, subtitle, color }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '10px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '6px',
                color: 'var(--text-muted)',
                fontSize: '9px'
            }}>
                {icon}
                <span>{label}</span>
            </div>
            <div style={{
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)',
                color,
                marginBottom: '2px'
            }}>
                {value}
            </div>
            <div style={{
                fontSize: '9px',
                color: 'var(--text-muted)'
            }}>
                {subtitle}
            </div>
        </div>
    );
}

export default RiskAnalytics;
