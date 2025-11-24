import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const OptionCalculator = () => {
    const [params, setParams] = useState({
        spot: 98000,
        strike: 100000,
        time: 30, // days
        volatility: 60, // %
        rate: 5 // %
    });

    const [results, setResults] = useState({ call: 0, put: 0, d1: 0, d2: 0 });

    // Black-Scholes Formula
    const calculateBS = useCallback(() => {
        const S = parseFloat(String(params.spot));
        const K = parseFloat(String(params.strike));
        const T = parseFloat(String(params.time)) / 365;
        const v = parseFloat(String(params.volatility)) / 100;
        const r = parseFloat(String(params.rate)) / 100;

        const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
        const d2 = d1 - v * Math.sqrt(T);

        const cnd = (x: number) => {
            const a1 = 0.31938153, a2 = -0.356563782, a3 = 1.781477937, a4 = -1.821255978, a5 = 1.330274429;
            const p = 0.2316419;
            const k = 1 / (1 + p * Math.abs(x));
            const t = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x) *
                (a1 * k + a2 * Math.pow(k, 2) + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));
            return x < 0 ? 1 - t : t;
        };

        const call = S * cnd(d1) - K * Math.exp(-r * T) * cnd(d2);
        const put = K * Math.exp(-r * T) * cnd(-d2) - S * cnd(-d1);

        setResults({
            call: isNaN(call) ? 0 : call,
            put: isNaN(put) ? 0 : put,
            d1: isNaN(d1) ? 0 : d1,
            d2: isNaN(d2) ? 0 : d2
        });
    }, [params]);

    useEffect(() => {
        const timeoutId = setTimeout(() => calculateBS(), 0);
        return () => clearTimeout(timeoutId);
    }, [calculateBS]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setParams(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div style={{ height: '100%', padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                <InputGroup label="Spot Price ($)" name="spot" value={params.spot} onChange={handleChange} />
                <InputGroup label="Strike Price ($)" name="strike" value={params.strike} onChange={handleChange} />
                <InputGroup label="Time (Days)" name="time" value={params.time} onChange={handleChange} />
                <InputGroup label="Volatility (%)" name="volatility" value={params.volatility} onChange={handleChange} />
                <InputGroup label="Risk-Free Rate (%)" name="rate" value={params.rate} onChange={handleChange} />
            </div>

            <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                <ResultCard
                    label="CALL PRICE"
                    value={results.call.toFixed(2)}
                    color="var(--accent-primary)"
                    icon={<TrendingUp size={16} />}
                />
                <ResultCard
                    label="PUT PRICE"
                    value={results.put.toFixed(2)}
                    color="var(--accent-danger)"
                    icon={<TrendingDown size={16} />}
                />
            </div>
        </div>
    );
};

interface InputGroupProps {
    label: string;
    name: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputGroup: React.FC<InputGroupProps> = ({ label, name, value, onChange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{label}</label>
        <input
            type="number"
            name={name}
            value={value}
            onChange={onChange}
            style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                outline: 'none'
            }}
        />
    </div>
);

interface ResultCardProps {
    label: string;
    value: string | number;
    color: string;
    icon: React.ReactNode;
}

const ResultCard: React.FC<ResultCardProps> = ({ label, value, color, icon }) => (
    <div style={{
        backgroundColor: 'var(--bg-tertiary)',
        padding: 'var(--spacing-md)',
        borderRadius: '4px',
        border: `1px solid ${color}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: color, fontSize: '12px', fontWeight: 'bold' }}>
            {icon} {label}
        </div>
        <div style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            ${value}
        </div>
    </div>
);

export default OptionCalculator;
