import React, { useEffect, useState } from 'react';

export const MemoryProfiler: React.FC = () => {
    const [memory, setMemory] = useState<{ used: number; total: number; limit: number } | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            // performance.memory is a Chrome-specific extension
            if ((performance as any).memory) {
                const mem = (performance as any).memory;
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
            bottom: 10,
            right: 10,
            background: 'rgba(0,0,0,0.8)',
            color: isWarning ? '#ff3b30' : '#00ff9d',
            padding: '5px 10px',
            borderRadius: '4px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            zIndex: 9999,
            pointerEvents: 'none',
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
            MEM: {usedMB}MB / {limitMB}MB ({percent}%)
        </div>
    );
};
