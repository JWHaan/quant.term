// PerformancePanel.jsx – displays live performance metrics
import React, { useEffect, useState } from 'react';
import { useConnectionStore } from '@/stores/connectionStore';

const PerformancePanel = () => {
    const [fps, setFps] = useState(0);
    const [lastTime, setLastTime] = useState(() => performance.now());
    const [frames, setFrames] = useState(0);
    const connections = useConnectionStore(state => state.connections);

    // Calculate FPS using requestAnimationFrame
    useEffect(() => {
        let animationFrameId;
        const tick = () => {
            const now = performance.now();
            const delta = now - lastTime;
            if (delta >= 1000) {
                setFps(Math.round((frames * 1000) / delta));
                setFrames(0);
                setLastTime(now);
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
        <div
            aria-live="polite"
            aria-atomic="true"
            style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: isGlobalConnected ? 'var(--accent-primary)' : 'var(--accent-danger)',
                backgroundColor: isGlobalConnected ? 'rgba(0,255,157,0.1)' : 'rgba(255,59,48,0.1)',
                padding: '4px 8px',
                border: `1px solid ${isGlobalConnected ? 'var(--accent-primary)' : 'var(--accent-danger)'}`,
                borderRadius: '4px'
            }}
        >
            <span>FPS: {fps}</span>
            <span>Connection: {isGlobalConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
    );
};

export default PerformancePanel;
