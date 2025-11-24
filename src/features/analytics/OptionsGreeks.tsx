import React, { useState, useMemo } from 'react';

/**
 * Options Greeks Calculator
 * Estimates option Greeks for educational purposes
 * Using simplified Black-Scholes approximations
 */
interface OptionsGreeksProps {
    currentPrice?: number;
    volatility?: number;
}

export const OptionsGreeks: React.FC<OptionsGreeksProps> = ({ currentPrice = 0, volatility = 0.3 }) => {
    const [strike, setStrike] = useState(currentPrice);
    const [daysToExpiry, setDaysToExpiry] = useState(30);
    const [optionType, setOptionType] = useState('call');

    const greeks = useMemo(() => {
        if (!currentPrice || currentPrice <= 0) {
            return { delta: 0, gamma: 0, theta: 0, vega: 0, premium: 0 };
        }

        const S = currentPrice; // Spot price
        const K = strike || S; // Strike
        const T = daysToExpiry / 365; // Time to expiry in years
        const sigma = Math.max(0.1, Math.min(2.0, volatility || 0.3)); // Volatility
        const r = 0.05; // Risk-free rate (5%)

        // Simplified Black-Scholes (no dividends)
        const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);

        // Standard normal CDF approximation
        const N = (x: number) => {
            const t = 1 / (1 + 0.2316419 * Math.abs(x));
            const d = 0.3989423 * Math.exp(-x * x / 2);
            const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
            return x > 0 ? 1 - prob : prob;
        };

        // Standard normal PDF
        const n = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);

        // Calculate Greeks
        let delta, gamma, theta, vega, premium;

        if (optionType === 'call') {
            delta = N(d1);
            premium = S * N(d1) - K * Math.exp(-r * T) * N(d2);
        } else {
            delta = N(d1) - 1;
            premium = K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
        }

        gamma = n(d1) / (S * sigma * Math.sqrt(T));
        theta = -(S * n(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(optionType === 'call' ? d2 : -d2);
        theta = theta / 365; // Per day
        vega = S * n(d1) * Math.sqrt(T) / 100; // Per 1% volatility change

        return {
            delta: isFinite(delta) ? delta : 0,
            gamma: isFinite(gamma) ? gamma : 0,
            theta: isFinite(theta) ? theta : 0,
            vega: isFinite(vega) ? vega : 0,
            premium: isFinite(premium) ? Math.max(0, premium) : 0
        };
    }, [currentPrice, strike, daysToExpiry, optionType, volatility]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'auto' }}>
            {/* Input controls */}
            <div style={{ marginBottom: '16px' }}>
                {/* Option type */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        OPTION TYPE
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {['call', 'put'].map(type => (
                            <button
                                key={type}
                                onClick={() => setOptionType(type)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: optionType === type ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                    border: '1px solid ' + (optionType === type ? 'var(--accent-primary)' : 'var(--border-color)'),
                                    borderRadius: '4px',
                                    color: optionType === type ? '#000' : 'var(--text-primary)',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Strike price */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        STRIKE PRICE
                    </label>
                    <input
                        type="number"
                        value={strike}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStrike(parseFloat(e.target.value) || currentPrice)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '14px',
                            fontFamily: 'var(--font-mono)'
                        }}
                    />
                </div>

                {/* Days to expiry */}
                <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        DAYS TO EXPIRY: {daysToExpiry}
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="365"
                        value={daysToExpiry}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDaysToExpiry(parseInt(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* Premium */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(0,255,157,0.15) 0%, rgba(0,255,157,0.05) 100%)',
                border: '1px solid rgba(0,255,157,0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    ESTIMATED PREMIUM
                </div>
                <div style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-primary)'
                }}>
                    ${greeks.premium.toFixed(2)}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Spot: ${currentPrice.toFixed(2)} | IV: {(volatility * 100).toFixed(1)}%
                </div>
            </div>

            {/* Greeks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <GreekCard
                    name="Delta"
                    value={greeks.delta}
                    description="Price sensitivity"
                    format={(v) => v.toFixed(4)}
                    color={greeks.delta >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}
                />
                <GreekCard
                    name="Gamma"
                    value={greeks.gamma}
                    description="Delta change rate"
                    format={(v) => v.toFixed(5)}
                    color="var(--accent-warning)"
                />
                <GreekCard
                    name="Theta"
                    value={greeks.theta}
                    description="Time decay / day"
                    format={(v) => v.toFixed(3)}
                    color="var(--accent-danger)"
                />
                <GreekCard
                    name="Vega"
                    value={greeks.vega}
                    description="Volatility sensitivity"
                    format={(v) => v.toFixed(3)}
                    color="#00ccff"
                />
            </div>

            {/* Info */}
            <div style={{
                marginTop: '16px',
                fontSize: '9px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '8px',
                background: 'rgba(255,200,0,0.1)',
                border: '1px solid rgba(255,200,0,0.3)',
                borderRadius: '4px'
            }}>
                ⚠️ Simplified Black-Scholes model for educational purposes only.
                Not suitable for actual trading decisions.
            </div>
        </div>
    );
};

interface GreekCardProps {
    name: string;
    value: number;
    description: string;
    format: (v: number) => string;
    color: string;
}

function GreekCard({ name, value, description, format, color }: GreekCardProps) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '12px'
        }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {name.toUpperCase()}
            </div>
            <div style={{
                fontSize: '18px',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)',
                color,
                marginBottom: '4px'
            }}>
                {format(value)}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                {description}
            </div>
        </div>
    );
}

export default OptionsGreeks;
