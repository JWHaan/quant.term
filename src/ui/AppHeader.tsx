import React from 'react';
import {
    Beaker,
    Maximize2,
    Minimize2,
    Monitor,
    Moon,
    Sun,
    Wifi,
    WifiOff,
} from 'lucide-react';
import CommandLine from './CommandLine';
import { ThemeContext } from './ThemeProvider';
import type { Command } from '@/features/command-palette/commands';
import type { WorkspaceMode } from '@/types/workspace';

interface AppHeaderProps {
    isGlobalConnected: boolean;
    isFullscreen: boolean;
    workspace: WorkspaceMode;
    onWorkspaceChange: (workspace: WorkspaceMode) => void;
    onToggleFullscreen: () => void;
    commands: Command[];
    onOpenCommandPalette: () => void;
    /** Optional symbol-argument handler so "TOP <sym>" can switch symbols directly. */
    onSymbolArg?: (symbol: string) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    isGlobalConnected,
    isFullscreen,
    workspace,
    onWorkspaceChange,
    onToggleFullscreen,
    commands,
    onOpenCommandPalette,
    onSymbolArg
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
                <CommandLine
                    commands={commands}
                    onOpenPalette={onOpenCommandPalette}
                    // exactOptionalPropertyTypes: only set the prop when provided.
                    {...(onSymbolArg === undefined ? {} : { onSymbolArg })}
                />

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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                        </svg>
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
