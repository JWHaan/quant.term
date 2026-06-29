
import { useState, useEffect } from 'react';

/**
 * LoadingSpinner
 *
 * Braille-pattern spinner with a status line — used as the Suspense fallback
 * for lazy-loaded chunks (chart, quant engine, etc.).
 *
 * The styling matches the terminal aesthetic: monospace, dimmed text,
 * primary-color spinner.
 */
const LoadingSpinner = ({ label = 'INITIALIZING' }: { label?: string }) => {
    const [frame, setFrame] = useState(0);
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

    useEffect(() => {
        const interval = setInterval(() => {
            setFrame(f => (f + 1) % frames.length);
        }, 80);
        return () => clearInterval(interval);
    }, [frames.length]);

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={`${label}…`}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                width: '100%',
                color: 'var(--accent-primary)',
                fontSize: '14px',
                fontFamily: 'var(--font-mono)',
                flexDirection: 'column',
                gap: '12px',
                background: 'var(--bg-panel)'
            }}
        >
            <div style={{ fontSize: '28px', fontWeight: 'bold', lineHeight: 1 }}>
                {frames[frame]}
            </div>
            <span className="cursor-blink" style={{ letterSpacing: '2px' }}>
                {label}…
            </span>
        </div>
    );
};

export default LoadingSpinner;
