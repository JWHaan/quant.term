import React, { useEffect, useState } from 'react';

interface ChromiumMemoryInfo {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
}

type PerformanceWithMemory = Performance & { memory?: ChromiumMemoryInfo };

export const MemoryProfiler: React.FC = () => {
    const [memory, setMemory] = useState<{ used: number; total: number; limit: number } | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            // performance.memory is a Chrome-specific extension
            const mem = (performance as PerformanceWithMemory).memory;
            if (mem) {
                setMemory({
                    used: mem.usedJSHeapSize,
                    total: mem.totalJSHeapSize,
                    limit: mem.jsHeapSizeLimit
                });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    if (!memory) return null;

    const usedMB = (memory.used / 1024 / 1024).toFixed(1);
    const limitMB = (memory.limit / 1024 / 1024).toFixed(1);
    const percent = ((memory.used / memory.limit) * 100).toFixed(1);
    const isWarning = (memory.used / memory.limit) > 0.8;

    return (
        <div style={{
            position: 'fixed',
            // Sits above the status rail so it never covers footer readouts.
            bottom: 36,
            right: 10,
            background: 'rgba(0,0,0,0.85)',
            color: isWarning ? '#ff6673' : '#36c98f',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            zIndex: 9999,
            pointerEvents: 'none',
            border: '1px solid var(--border-strong)'
        }}>
            MEM: {usedMB}MB / {limitMB}MB ({percent}%)
        </div>
    );
};
