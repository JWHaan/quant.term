import React from 'react';
import { Wifi, WifiOff, Search, Sun, Moon, Maximize2, Github } from 'lucide-react';
import { ThemeContext } from './ThemeProvider';

interface AppHeaderProps {
    isGlobalConnected: boolean;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    onOpenCommandPalette: () => void;
}

const iconButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s',
};

function onHoverEnter(e: React.MouseEvent<HTMLElement>) {
    e.currentTarget.style.borderColor = 'var(--accent-primary)';
    e.currentTarget.style.color = 'var(--accent-primary)';
}

function onHoverLeave(e: React.MouseEvent<HTMLElement>) {
    e.currentTarget.style.borderColor = 'var(--border-color)';
    e.currentTarget.style.color = 'var(--text-secondary)';
}

const AppHeader: React.FC<AppHeaderProps> = ({
    isGlobalConnected,
    isFullscreen,
    onToggleFullscreen,
    onOpenCommandPalette
}) => {
    const { theme, toggleTheme } = React.useContext(ThemeContext);

    return (
        <header className="app-header">
            <div className="logo-section">
                <div className="logo-text">
                    <h1>quant.term</h1>
                    <span className="version">Quantitative Terminal</span>
                </div>
            </div>

            <div className="header-controls">
                {/* Command Palette Trigger */}
                <div
                    className="command-trigger"
                    onClick={onOpenCommandPalette}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginRight: '8px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={onHoverEnter}
                    onMouseLeave={onHoverLeave}
                    role="button"
                    tabIndex={0}
                    aria-label="Open command palette"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenCommandPalette();
                        }
                    }}
                >
                    <Search size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                        Search...
                    </span>
                    <kbd style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: 'var(--bg-app)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)'
                    }}>⌘K</kbd>
                </div>

                {/* Icon Button Group */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '12px' }}>
                    <button
                        onClick={toggleTheme}
                        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
                        style={iconButtonStyle}
                        onMouseEnter={onHoverEnter}
                        onMouseLeave={onHoverLeave}
                    >
                        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    </button>

                    <button
                        onClick={onToggleFullscreen}
                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        style={iconButtonStyle}
                        onMouseEnter={onHoverEnter}
                        onMouseLeave={onHoverLeave}
                    >
                        <Maximize2 size={14} />
                    </button>

                    <a
                        href="https://github.com/JWHaan/quant.term"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View source on GitHub"
                        title="GitHub"
                        style={{ ...iconButtonStyle, textDecoration: 'none' }}
                        onMouseEnter={onHoverEnter}
                        onMouseLeave={onHoverLeave}
                    >
                        <Github size={14} />
                    </a>
                </div>

                {/* Connection Status */}
                <div className="connection-status" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    height: '32px',
                    background: isGlobalConnected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${isGlobalConnected ? 'var(--accent-primary)' : 'var(--accent-danger)'}`,
                    borderRadius: '8px',
                    color: isGlobalConnected ? 'var(--accent-primary)' : 'var(--accent-danger)'
                }}>
                    {isGlobalConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
                        {isGlobalConnected ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>

                <div className="user-profile">
                    <div className="avatar">TRADER</div>
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
