import React, { useEffect, useState } from 'react';

/**
 * MobileGate
 *
 * The quant.term terminal is a desktop-first professional application that
 * relies on multi-column resizable panels, dense data grids, and WebSocket
 * streams that are too heavy for typical mobile browsers.
 *
 * This component detects narrow viewports and shows a friendly fallback
 * message instead of letting the UI render as a broken, unusable mess.
 *
 * It does NOT block tablets in landscape mode (>= 1024px) which can run
 * the terminal acceptably.
 */
const DESKTOP_MIN_WIDTH = 1024;

const MobileGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isTooNarrow, setIsTooNarrow] = useState(false);

    useEffect(() => {
        const check = () => {
            setIsTooNarrow(window.innerWidth < DESKTOP_MIN_WIDTH);
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    if (!isTooNarrow) return <>{children}</>;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px',
                background: 'var(--bg-app, #09090b)',
                color: 'var(--text-primary, #f4f4f5)',
                fontFamily: 'var(--font-ui, system-ui, sans-serif)',
                textAlign: 'center',
                zIndex: 99999,
            }}
        >
            <div style={{ maxWidth: '420px' }}>
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        marginBottom: '20px',
                        fontSize: '32px',
                    }}
                >
                    🖥️
                </div>
                <h1
                    style={{
                        margin: '0 0 8px 0',
                        fontSize: '22px',
                        fontWeight: 600,
                        letterSpacing: '-0.5px',
                    }}
                >
                    quant.term requires a desktop
                </h1>
                <p
                    style={{
                        margin: '0 0 24px 0',
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: 'var(--text-secondary, #a1a1aa)',
                    }}
                >
                    This is a professional trading terminal with multi-panel layouts, real-time
                    WebSocket streams, and dense data grids optimized for screens at least
                    {' '}{DESKTOP_MIN_WIDTH}px wide.
                </p>
                <p
                    style={{
                        margin: '0 0 24px 0',
                        fontSize: '13px',
                        color: 'var(--text-muted, #52525b)',
                        fontFamily: 'var(--font-mono, monospace)',
                    }}
                >
                    Please open on a desktop, laptop, or tablet in landscape mode.
                </p>
                <a
                    href="https://github.com/JWHaan/quant.term"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-block',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--accent-primary, #3b82f6)',
                        textDecoration: 'none',
                        border: '1px solid var(--border-color, #27272a)',
                        borderRadius: '8px',
                        background: 'var(--bg-panel, #18181b)',
                    }}
                >
                    View project on GitHub →
                </a>
            </div>
        </div>
    );
};

export default MobileGate;
