import React from 'react';
import { Github, Maximize2, Minimize2, Moon, Search, Sun, Wifi, WifiOff } from 'lucide-react';
import { ThemeContext } from './ThemeProvider';

interface AppHeaderProps {
    isGlobalConnected: boolean;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    onOpenCommandPalette: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    isGlobalConnected,
    isFullscreen,
    onToggleFullscreen,
    onOpenCommandPalette
}) => {
    const { theme, toggleTheme } = React.useContext(ThemeContext);
    const connectionState = isGlobalConnected ? 'connected' : 'offline';

    return (
        <header className="app-header" aria-label="Application command bar">
            <div className="logo-section">
                <div className="brand-mark" aria-hidden="true">QT</div>
                <div className="logo-text">
                    <h1>quant<span>.term</span></h1>
                    <span className="version">Crypto market intelligence</span>
                </div>
            </div>

            <div className="header-controls">
                <button
                    type="button"
                    className="command-trigger"
                    onClick={onOpenCommandPalette}
                    aria-label="Search markets and open the command palette"
                    aria-keyshortcuts="Meta+K Control+K"
                >
                    <Search size={14} aria-hidden="true" />
                    <span className="command-trigger__label">Search markets &amp; commands</span>
                    <kbd aria-hidden="true">⌘K</kbd>
                </button>

                <div className="header-tool-group" aria-label="Display controls">
                    <button
                        type="button"
                        className="header-icon-button"
                        onClick={toggleTheme}
                        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
                    >
                        {theme === 'dark'
                            ? <Sun size={14} aria-hidden="true" />
                            : <Moon size={14} aria-hidden="true" />}
                    </button>

                    <button
                        type="button"
                        className="header-icon-button"
                        onClick={onToggleFullscreen}
                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        aria-pressed={isFullscreen}
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen
                            ? <Minimize2 size={14} aria-hidden="true" />
                            : <Maximize2 size={14} aria-hidden="true" />}
                    </button>

                    <a
                        className="header-icon-button"
                        href="https://github.com/JWHaan/quant.term"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View quant.term source on GitHub (opens in a new tab)"
                        title="GitHub"
                    >
                        <Github size={14} aria-hidden="true" />
                    </a>
                </div>

                <div
                    className="connection-status"
                    data-state={connectionState}
                    role="status"
                    aria-live="polite"
                    aria-label={isGlobalConnected ? 'At least one live market data feed is connected' : 'Live market data feeds are offline'}
                    title={isGlobalConnected ? 'Live market data available' : 'Live market data unavailable'}
                >
                    <span className="status-dot" aria-hidden="true" />
                    {isGlobalConnected
                        ? <Wifi size={12} aria-hidden="true" />
                        : <WifiOff size={12} aria-hidden="true" />}
                    <span>{isGlobalConnected ? 'LIVE' : 'OFFLINE'}</span>
                </div>

                <div className="user-profile" aria-label="Read-only market data terminal">
                    <div className="avatar">READ ONLY</div>
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
