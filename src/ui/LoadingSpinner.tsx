
import { useState, useEffect } from 'react';

const LoadingSpinner = () => {
    const [frame, setFrame] = useState(0);
    const frames = ['|', '/', '-', '\\'];
    // Alternative: const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

    useEffect(() => {
        const interval = setInterval(() => {
            setFrame(f => (f + 1) % frames.length);
        }, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            color: 'var(--accent-primary)',
            fontSize: '14px',
            fontFamily: 'var(--font-mono)',
            flexDirection: 'column',
            gap: '8px',
            background: 'var(--bg-panel)'
        }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                [{frames[frame]}]
            </div>
            <span className="cursor-blink">INITIALIZING...</span>
        </div>
    );
};

export default LoadingSpinner;
