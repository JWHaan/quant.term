import React from 'react';
import {
    Beaker,
    Github,
    Maximize2,
    Minimize2,
    Monitor,
    Moon,
    Search,
    Sun,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { ThemeContext } from './ThemeProvider';
import type { WorkspaceMode } from '@/types/workspace';

interface AppHeaderProps {
    isGlobalConnected: boolean;
    isFullscreen: boolean;
    workspace: WorkspaceMode;
    onWorkspaceChange: (workspace: WorkspaceMode) => void;
    onToggleFullscreen: () => void;
    onOpenCommandPalette: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    isGlobalConnected,
    isFullscreen,
    workspace,
    onWorkspaceChange,
    onToggleFullscreen,
    onOpenCommandPalette
}) => {
    const { theme, toggleTheme } = React.useContext(ThemeContext);
    const isStrategyLab = workspace === 'strategy-lab';
    const connectionState = isStrategyLab ? 'replay' : isGlobalConnected ? 'connected' : 'offline';
    const statusLabel = isStrategyLab ? 'LAB' : isGlobalConnected ? 'LIVE' : 'OFFLINE';
    const statusDescription = isStrategyLab
        ? 'Deterministic research workspace is active'
        : isGlobalConnected
            ? 'Primary market data feeds are live'
            : 'A primary market data feed is unavailable';

    return (
        <header className="app-header" aria-label="Application command bar">
            <div className="logo-section">
                <div className="brand-mark" aria-hidden="true">QT</div>
                <div className="logo-text">
                    <h1>quant<span>.term</span></h1>
                    <span className="version">Crypto market intelligence</span>
                </div>
            </div>

            <nav className="workspace-nav" aria-label="Workspace">
                <button
                    type="button"
                    aria-current={workspace === 'monitor' ? 'page' : undefined}
                    onClick={() => onWorkspaceChange('monitor')}
                >
                    <Monitor size={12} aria-hidden="true" />
                    Monitor
                </button>
                <button
                    type="button"
                    aria-current={isStrategyLab ? 'page' : undefined}
                    onClick={() => onWorkspaceChange('strategy-lab')}
                >
                    <Beaker size={12} aria-hidden="true" />
                    Strategy Lab
                </button>
            </nav>

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
                    aria-label={statusDescription}
                    title={statusDescription}
                >
                    <span className="status-dot" aria-hidden="true" />
                    {isStrategyLab
                        ? <Beaker size={12} aria-hidden="true" />
                        : isGlobalConnected
                        ? <Wifi size={12} aria-hidden="true" />
                        : <WifiOff size={12} aria-hidden="true" />}
                    <span>{statusLabel}</span>
                </div>

                <div className="user-profile" aria-label="Read-only research terminal">
                    <div className="avatar">READ ONLY</div>
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
