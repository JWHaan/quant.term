import React, { useEffect, useState } from 'react';
import { useConnectionStore } from '@/stores/connectionStore';
import { Activity } from 'lucide-react';

const PerformancePanel: React.FC = () => {
    const [fps, setFps] = useState(0);
    const [lastTime, setLastTime] = useState(() => performance.now());
    const [frames, setFrames] = useState(0);
    const connections = useConnectionStore(state => state.connections);

    // Simulated Risk Metrics (Placeholder for real backtest engine)
    const [metrics, setMetrics] = useState({
        sharpe: 2.45,
        sortino: 3.12,
        maxDD: -4.2,
        dailyPnL: 1.25
    });

    // Calculate FPS using requestAnimationFrame
    useEffect(() => {
        let animationFrameId: number;
        const tick = () => {
            const now = performance.now();
            const delta = now - lastTime;
            if (delta >= 1000) {
                setFps(Math.round((frames * 1000) / delta));
                setFrames(0);
                setLastTime(now);

                // Jitter metrics slightly for "live" feel
                setMetrics(prev => ({
                    sharpe: +(prev.sharpe + (Math.random() - 0.5) * 0.01).toFixed(2),
                    sortino: +(prev.sortino + (Math.random() - 0.5) * 0.01).toFixed(2),
                    maxDD: +(prev.maxDD + (Math.random() - 0.5) * 0.05).toFixed(2),
                    dailyPnL: +(prev.dailyPnL + (Math.random() - 0.5) * 0.02).toFixed(2)
                }));
            } else {
                setFrames(prev => prev + 1);
            }
            animationFrameId = requestAnimationFrame(tick);
        };
        animationFrameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animationFrameId);
    }, [lastTime, frames]);

    // Determine overall connection status
    const isGlobalConnected = Object.values(connections).every(status => status === 'connected');

    return (
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '100%' }}>
            {/* FPS & System Status */}
            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: isGlobalConnected ? 'var(--accent-primary)' : 'var(--accent-danger)',
                    backgroundColor: isGlobalConnected ? 'rgba(0,255,157,0.05)' : 'rgba(255,59,48,0.05)',
                    padding: '2px 6px',
                    border: `1px solid ${isGlobalConnected ? 'rgba(0,255,157,0.2)' : 'rgba(255,59,48,0.2)'}`,
                    borderRadius: '2px'
                }}
            >
                <Activity size={10} />
                <span>FPS: {fps}</span>
            </div>

            {/* Risk Metrics Divider */}
            <div style={{ width: '1px', height: '12px', background: 'var(--border-color)' }} />

            {/* Risk Metrics */}
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} title="Sharpe Ratio">
                    <span style={{ color: 'var(--text-muted)' }}>SHARPE</span>
                    <span style={{ color: metrics.sharpe > 2 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {metrics.sharpe.toFixed(2)}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} title="Sortino Ratio">
                    <span style={{ color: 'var(--text-muted)' }}>SORTINO</span>
                    <span style={{ color: metrics.sortino > 3 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {metrics.sortino.toFixed(2)}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} title="Max Drawdown">
                    <span style={{ color: 'var(--text-muted)' }}>MAX DD</span>
                    <span style={{ color: metrics.maxDD < -5 ? 'var(--accent-danger)' : 'var(--accent-warning)' }}>
                        {metrics.maxDD.toFixed(1)}%
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} title="Daily P&L">
                    <span style={{ color: 'var(--text-muted)' }}>DAY</span>
                    <span style={{ color: metrics.dailyPnL > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
                        {metrics.dailyPnL > 0 ? '+' : ''}{metrics.dailyPnL.toFixed(2)}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default PerformancePanel;
