import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AppFooter from '@/ui/AppFooter';
import AppHeader from '@/ui/AppHeader';
import CommandPalette from '@/features/command-palette/CommandPalette';
import ErrorBoundary from '@/ui/ErrorBoundary';
import KeyboardShortcutsModal from '@/ui/KeyboardShortcutsModal';
import MobileGate from '@/ui/MobileGate';
import MonitorWorkspace from '@/app/MonitorWorkspace';
import StrategyFooter from '@/ui/StrategyFooter';
import StrategyLab from '@/features/backtest/StrategyLab';
import ThemeProvider from '@/ui/ThemeProvider';
import { MemoryProfiler } from '@/features/debug/MemoryProfiler';
import { buildCommands } from '@/features/command-palette/commands';
import { useConnectionLatency } from '@/hooks/useConnectionLatency';
import { useConnectionStore } from '@/stores/connectionStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useMarketStore } from '@/stores/marketStore';
import type { BacktestResult } from '@/backtest/types';
import type { WorkspaceMode } from '@/types/workspace';

const WORKSPACE_STORAGE_KEY = 'quant-term-workspace';

const getInitialWorkspace = (): WorkspaceMode => {
    if (typeof window === 'undefined') return 'monitor';
    try {
        return window.localStorage.getItem(WORKSPACE_STORAGE_KEY) === 'strategy-lab'
            ? 'strategy-lab'
            : 'monitor';
    } catch {
        return 'monitor';
    }
};

const App: React.FC = () => {
    const { selectedSymbol, setSymbol } = useMarketStore();
    const connections = useConnectionStore((state) => state.connections);
    const { latency, quality, updatesPerSecond } = useConnectionLatency(selectedSymbol);
    const [workspace, setWorkspace] = useState<WorkspaceMode>(getInitialWorkspace);
    const [lastBacktestResult, setLastBacktestResult] = useState<BacktestResult | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showCommandPalette, setShowCommandPalette] = useState(false);

    const isGlobalConnected = useMemo(
        () => connections.binance === 'connected' && connections.marketData === 'connected',
        [connections],
    );

    useEffect(() => {
        try {
            window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace);
        } catch {
            // Workspace persistence is an optional browser convenience.
        }
    }, [workspace]);

    useEffect(() => {
        const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    const toggleFullscreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                setShowCommandPalette((open) => !open);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const focusElement = useCallback((id: string) => {
        const element = document.getElementById(id);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element?.focus({ preventScroll: true });
    }, []);

    const openWorkspace = useCallback((nextWorkspace: WorkspaceMode, focusId?: string) => {
        setWorkspace(nextWorkspace);
        window.setTimeout(
            () => focusElement(focusId ?? (
                nextWorkspace === 'monitor' ? 'terminal-workspace' : 'strategy-lab-workspace'
            )),
            0,
        );
    }, [focusElement]);

    const scrollToMarket = useCallback(
        () => openWorkspace('monitor', 'panel-market-watch'),
        [openWorkspace],
    );
    const scrollToChart = useCallback(
        () => openWorkspace('monitor', 'panel-chart'),
        [openWorkspace],
    );
    const scrollToAlpha = useCallback(
        () => openWorkspace('monitor', 'panel-research'),
        [openWorkspace],
    );
    const scrollToNews = useCallback(
        () => openWorkspace('monitor', 'panel-intelligence'),
        [openWorkspace],
    );

    const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts({
        shortcuts: [
            { key: '1', ctrl: true, description: 'Focus Market Watch', action: scrollToMarket, category: 'panels' },
            { key: '2', ctrl: true, description: 'Focus Chart', action: scrollToChart, category: 'panels' },
            { key: '3', ctrl: true, description: 'Focus Alpha Panel', action: scrollToAlpha, category: 'panels' },
            { key: '4', ctrl: true, description: 'Focus News', action: scrollToNews, category: 'panels' },
            {
                key: '5',
                ctrl: true,
                description: 'Open Strategy Lab',
                action: () => openWorkspace('strategy-lab'),
                category: 'navigation',
            },
        ],
    });

    const commands = useMemo(() => buildCommands({
        setShowHelp,
        setSymbol,
        openMonitor: () => openWorkspace('monitor'),
        openStrategyLab: () => openWorkspace('strategy-lab'),
        scrollToMarket,
        scrollToChart,
        scrollToAlpha,
        scrollToNews,
    }), [
        openWorkspace,
        scrollToAlpha,
        scrollToChart,
        scrollToMarket,
        scrollToNews,
        setShowHelp,
        setSymbol,
    ]);

    const skipTarget = workspace === 'monitor' ? '#terminal-workspace' : '#strategy-lab-workspace';
    const skipLabel = workspace === 'monitor' ? 'Skip to market workspace' : 'Skip to Strategy Lab';

    return (
        <ThemeProvider>
            <ErrorBoundary>
                <MobileGate>
                    <div className="app-container">
                        <a className="skip-link" href={skipTarget}>{skipLabel}</a>
                        <AppHeader
                            isGlobalConnected={isGlobalConnected}
                            isFullscreen={isFullscreen}
                            workspace={workspace}
                            onWorkspaceChange={(nextWorkspace) => openWorkspace(nextWorkspace)}
                            onToggleFullscreen={toggleFullscreen}
                            onOpenCommandPalette={() => setShowCommandPalette(true)}
                        />

                        {workspace === 'monitor' ? (
                            <MonitorWorkspace
                                selectedSymbol={selectedSymbol}
                                isGlobalConnected={isGlobalConnected}
                                onSelectSymbol={setSymbol}
                            />
                        ) : (
                            <StrategyLab onResult={setLastBacktestResult} />
                        )}

                        {workspace === 'monitor' ? (
                            <AppFooter
                                latency={latency}
                                quality={quality}
                                updatesPerSecond={updatesPerSecond}
                                isGlobalConnected={isGlobalConnected}
                                selectedSymbol={selectedSymbol}
                            />
                        ) : (
                            <StrategyFooter result={lastBacktestResult} />
                        )}

                        <KeyboardShortcutsModal
                            shortcuts={shortcuts}
                            isOpen={showHelp}
                            onClose={() => setShowHelp(false)}
                        />

                        <CommandPalette
                            isOpen={showCommandPalette}
                            onClose={() => setShowCommandPalette(false)}
                            commands={commands}
                        />

                        {import.meta.env.DEV && <MemoryProfiler />}
                    </div>
                </MobileGate>
            </ErrorBoundary>
        </ThemeProvider>
    );
};

export default App;
