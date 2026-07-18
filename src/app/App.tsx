import React, { Suspense, useCallback, useMemo, useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useMarketStore } from '@/stores/marketStore';
import { useConnectionStore } from '@/stores/connectionStore';
import DashboardPanel from '@/ui/DashboardPanel';
import MarketGrid from '@/features/market/MarketGrid';
import LoadingSpinner from '@/ui/LoadingSpinner';
import PanelErrorBoundary from '@/ui/PanelErrorBoundary';
import { Newspaper, BarChart2, Flame, Activity, Bell, BriefcaseBusiness, Radio, Waves } from 'lucide-react';
import ThemeProvider from '@/ui/ThemeProvider';
import ErrorBoundary from '@/ui/ErrorBoundary';
import MobileGate from '@/ui/MobileGate';
import AlphaPanel from '@/features/analytics/AlphaPanel';
import NewsTicker from '@/features/news/NewsTicker';
import NewsFeed from '@/features/news/NewsFeed';
import TabPanel from '@/ui/TabPanel';
import OrderBookDOM from '@/features/market/OrderBookDOM';
import LiquidationFeed from '@/features/market/LiquidationFeed';
import KeyboardShortcutsModal from '@/ui/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { MemoryProfiler } from '@/features/debug/MemoryProfiler';
import AppHeader from '@/ui/AppHeader';
import AppFooter from '@/ui/AppFooter';
import { buildCommands } from '@/features/command-palette/commands';
import MarketOverviewBar from '@/ui/MarketOverviewBar';
import PaperTradingPanel from '@/features/trading/PaperTradingPanel';
import DerivativesPanel from '@/features/market/DerivativesPanel';
import NetworkPulsePanel from '@/features/news/NetworkPulsePanel';
import AlertPanel from '@/features/market/AlertPanel';

const ChartContainer = React.lazy(() => import('@/features/charts/ChartContainer'));
const QuantSignalEngine = React.lazy(() => import('@/features/analytics/QuantSignalEngine'));

import { useConnectionLatency } from '@/hooks/useConnectionLatency';
import CommandPalette from '@/features/command-palette/CommandPalette';

const App: React.FC = () => {
    const { selectedSymbol, setSymbol } = useMarketStore();
    const connections = useConnectionStore(state => state.connections);
    const { latency, quality, updatesPerSecond } = useConnectionLatency(selectedSymbol);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Modal state
    const [showCommandPalette, setShowCommandPalette] = React.useState(false);

    // The terminal is only globally live when both the selected chart and the
    // market-watch price feed are receiving data. An auxiliary socket alone
    // must never make the whole application appear healthy.
    const isGlobalConnected = useMemo(
        () => connections.binance === 'connected' && connections.marketData === 'connected',
        [connections]
    );

    // Track fullscreen state
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
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

    // Global keyboard listener for Command Palette (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowCommandPalette(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Scroll helpers
    const focusPanel = useCallback((id: string) => {
        const element = document.getElementById(id);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element?.focus({ preventScroll: true });
    }, []);
    const scrollToMarket = useCallback(() => focusPanel('panel-market-watch'), [focusPanel]);
    const scrollToChart = useCallback(() => focusPanel('panel-chart'), [focusPanel]);
    const scrollToAlpha = useCallback(() => focusPanel('panel-research'), [focusPanel]);
    const scrollToNews = useCallback(() => focusPanel('panel-intelligence'), [focusPanel]);

    // Keyboard shortcuts
    const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts({
        shortcuts: [
            { key: '1', ctrl: true, description: 'Focus Market Watch', action: scrollToMarket, category: 'panels' },
            { key: '2', ctrl: true, description: 'Focus Chart', action: scrollToChart, category: 'panels' },
            { key: '3', ctrl: true, description: 'Focus Alpha Panel', action: scrollToAlpha, category: 'panels' },
            { key: '4', ctrl: true, description: 'Focus News', action: scrollToNews, category: 'panels' }
        ]
    });

    // Command palette commands — extracted to commands.ts, built with useMemo
    const commands = useMemo(() => buildCommands({
        setShowHelp,
        setSymbol,
        scrollToMarket,
        scrollToChart,
        scrollToAlpha,
        scrollToNews
    }), [scrollToAlpha, scrollToChart, scrollToMarket, scrollToNews, setSymbol, setShowHelp]);

    // TabPanel tab configs — lifted out of JSX to fix useMemo-in-JSX violation
    const marketDepthTabs = useMemo(() => [
        {
            id: 'orderbook',
            label: 'Order Book',
            icon: <BarChart2 size={12} />,
            content: <OrderBookDOM symbol={selectedSymbol} />
        },
        {
            id: 'liquidations',
            label: 'Liquidations',
            icon: <Flame size={12} />,
            content: <LiquidationFeed key={selectedSymbol} symbol={selectedSymbol} />
        }
    ], [selectedSymbol]);

    const researchTabs = useMemo(() => [
        {
            id: 'signal',
            label: 'Signal',
            icon: <Activity size={12} />,
            content: (
                <Suspense fallback={<LoadingSpinner />}>
                    <QuantSignalEngine key={selectedSymbol} />
                </Suspense>
            )
        },
        {
            id: 'factors',
            label: 'Factors',
            icon: <Waves size={12} />,
            content: <AlphaPanel key={selectedSymbol} symbol={selectedSymbol} />
        }
    ], [selectedSymbol]);

    const intelligenceTabs = useMemo(() => [
        {
            id: 'derivatives',
            label: 'Perps',
            icon: <Radio size={12} />,
            content: <DerivativesPanel symbol={selectedSymbol} />
        },
        {
            id: 'portfolio',
            label: 'Paper',
            icon: <BriefcaseBusiness size={12} />,
            content: <PaperTradingPanel symbol={selectedSymbol} />
        },
        {
            id: 'network',
            label: 'Network',
            icon: <Activity size={12} />,
            content: <NetworkPulsePanel />
        },
        {
            id: 'alerts',
            label: 'Alerts',
            icon: <Bell size={12} />,
            content: <AlertPanel symbol={selectedSymbol} />
        },
        {
            id: 'news',
            label: 'News Feed',
            icon: <Newspaper size={12} />,
            content: <NewsFeed symbol={selectedSymbol} />
        },
    ], [selectedSymbol]);

    return (
        <ThemeProvider>
            <ErrorBoundary>
                <MobileGate>
                    <div className="app-container">
                        <a className="skip-link" href="#terminal-workspace">Skip to market workspace</a>
                        <AppHeader
                            isGlobalConnected={isGlobalConnected}
                            isFullscreen={isFullscreen}
                            onToggleFullscreen={toggleFullscreen}
                            onOpenCommandPalette={() => setShowCommandPalette(true)}
                        />

                        <MarketOverviewBar symbol={selectedSymbol} isConnected={isGlobalConnected} />
                        <NewsTicker />

                        {/* Main Content Grid - 3 Column Layout */}
                        <main className="main-content" id="terminal-workspace">
                            <PanelGroup direction="horizontal">

                                {/* COLUMN 1: Market Watch */}
                                <Panel defaultSize={18} minSize={14} maxSize={25} collapsible>
                                    <div id="panel-market-watch" tabIndex={-1} style={{ height: '100%' }}>
                                        <DashboardPanel title="Market Watch">
                                            <PanelErrorBoundary>
                                                <MarketGrid onSelectSymbol={setSymbol} />
                                            </PanelErrorBoundary>
                                        </DashboardPanel>
                                    </div>
                                </Panel>

                                <PanelResizeHandle className="resize-handle" />

                                {/* COLUMN 2: Primary market workspace */}
                                <Panel defaultSize={57} minSize={42}>
                                    <PanelGroup direction="vertical">
                                        <Panel defaultSize={68} minSize={45}>
                                            <div id="panel-chart" tabIndex={-1} style={{ height: '100%' }}>
                                                <DashboardPanel title={`Chart - ${selectedSymbol}`}>
                                                    <PanelErrorBoundary>
                                                        <Suspense fallback={<LoadingSpinner />}>
                                                            <ChartContainer symbol={selectedSymbol} />
                                                        </Suspense>
                                                    </PanelErrorBoundary>
                                                </DashboardPanel>
                                            </div>
                                        </Panel>

                                        <PanelResizeHandle className="resize-handle" />

                                        <Panel defaultSize={32} minSize={20}>
                                            <DashboardPanel title="Market Depth">
                                                <PanelErrorBoundary>
                                                    <TabPanel
                                                        tabs={marketDepthTabs}
                                                        defaultTab="orderbook"
                                                    />
                                                </PanelErrorBoundary>
                                            </DashboardPanel>
                                        </Panel>
                                    </PanelGroup>
                                </Panel>

                                <PanelResizeHandle className="resize-handle" />

                                {/* COLUMN 3: Research & intelligence */}
                                <Panel defaultSize={25} minSize={20} maxSize={35}>
                                    <PanelGroup direction="vertical">
                                        <Panel defaultSize={52}>
                                            <div id="panel-research" tabIndex={-1} style={{ height: '100%' }}>
                                                <DashboardPanel title="Research Monitor">
                                                    <PanelErrorBoundary>
                                                        <TabPanel tabs={researchTabs} defaultTab="signal" />
                                                    </PanelErrorBoundary>
                                                </DashboardPanel>
                                            </div>
                                        </Panel>

                                        <PanelResizeHandle className="resize-handle" />

                                        <Panel defaultSize={48}>
                                            <div id="panel-intelligence" tabIndex={-1} style={{ height: '100%' }}>
                                                <DashboardPanel title="Market Intelligence">
                                                    <PanelErrorBoundary>
                                                        <TabPanel
                                                            tabs={intelligenceTabs}
                                                            defaultTab="derivatives"
                                                        />
                                                    </PanelErrorBoundary>
                                                </DashboardPanel>
                                            </div>
                                        </Panel>
                                    </PanelGroup>
                                </Panel>

                            </PanelGroup>
                        </main>

                        <AppFooter
                            latency={latency}
                            quality={quality}
                            updatesPerSecond={updatesPerSecond}
                            isGlobalConnected={isGlobalConnected}
                            selectedSymbol={selectedSymbol}
                        />

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
