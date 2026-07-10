import React, { Suspense, useRef, useMemo, useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useMarketStore } from './stores/marketStore';
import { useConnectionStore } from './stores/connectionStore';
import DashboardPanel from './ui/DashboardPanel';
import MarketGrid from './features/market/MarketGrid';
import LoadingSpinner from './ui/LoadingSpinner';
import PanelErrorBoundary from './ui/PanelErrorBoundary';
import { Newspaper, Calendar, BarChart2, Flame, Activity } from 'lucide-react';
import ThemeProvider from './ui/ThemeProvider';
import ErrorBoundary from './ui/ErrorBoundary';
import MobileGate from './ui/MobileGate';
import AlphaPanel from './features/analytics/AlphaPanel';
import NewsTicker from './features/news/NewsTicker';
import NewsFeed from './features/news/NewsFeed';
import EconomicCalendar from './features/news/EconomicCalendar';
import TabPanel from './ui/TabPanel';
import OrderBookDOM from './features/market/OrderBookDOM';
import LiquidationFeed from './features/market/LiquidationFeed';
import OnChainPanel from './features/news/OnChainPanel';
import KeyboardShortcutsModal from './ui/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { MemoryProfiler } from './features/debug/MemoryProfiler';
import AppHeader from './ui/AppHeader';
import AppFooter from './ui/AppFooter';
import { buildCommands } from './features/command-palette/commands';

const ChartContainer = React.lazy(() => import('./features/charts/ChartContainer'));
const QuantSignalEngine = React.lazy(() => import('./features/analytics/QuantSignalEngine'));

import PerformancePanel from './features/trading/PerformancePanel';
import { useConnectionLatency } from './hooks/useConnectionLatency';
import CommandPalette from './features/command-palette/CommandPalette';
import MacroAnalysisModal from './features/macro/MacroAnalysisModal';

const App: React.FC = () => {
    const { selectedSymbol, setSymbol } = useMarketStore();
    const connections = useConnectionStore(state => state.connections);
    const { latency, quality, updatesPerSecond } = useConnectionLatency();
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Panel refs for keyboard focus
    const marketWatchRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const alphaRef = useRef<HTMLDivElement>(null);
    const newsRef = useRef<HTMLDivElement>(null);

    // Modal state
    const [showCommandPalette, setShowCommandPalette] = React.useState(false);
    const [showMacroModal, setShowMacroModal] = React.useState(false);

    // Memoized connection status — avoids recomputing every render
    const isGlobalConnected = useMemo(
        () => Object.values(connections).every(status => status === 'connected'),
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
    const scrollToMarket = () => marketWatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const scrollToChart = () => chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const scrollToAlpha = () => alphaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const scrollToNews = () => newsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
        setShowMacroModal,
        setShowHelp,
        setSymbol,
        scrollToMarket,
        scrollToChart,
        scrollToAlpha,
        scrollToNews
    }), [setSymbol, setShowHelp]);

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
            content: <LiquidationFeed symbol={selectedSymbol} />
        }
    ], [selectedSymbol]);

    const intelligenceTabs = useMemo(() => [
        {
            id: 'onchain',
            label: 'On-Chain',
            icon: <Activity size={12} />,
            content: <OnChainPanel />
        },
        {
            id: 'news',
            label: 'News Feed',
            icon: <Newspaper size={12} />,
            content: <NewsFeed symbol={selectedSymbol} />
        },
        {
            id: 'calendar',
            label: 'Economic Calendar',
            icon: <Calendar size={12} />,
            content: <EconomicCalendar />
        }
    ], [selectedSymbol]);

    return (
        <ThemeProvider>
            <ErrorBoundary>
                <MobileGate>
                    <div className="app-container">
                        <AppHeader
                            isGlobalConnected={isGlobalConnected}
                            isFullscreen={isFullscreen}
                            onToggleFullscreen={toggleFullscreen}
                            onOpenCommandPalette={() => setShowCommandPalette(true)}
                        />

                        <NewsTicker />

                        {/* Main Content Grid - 3 Column Layout */}
                        <div className="main-content">
                            <PanelGroup direction="horizontal">

                                {/* COLUMN 1: Market Watch (15%) */}
                                <Panel defaultSize={15} minSize={10} maxSize={20} collapsible>
                                    <div ref={marketWatchRef} style={{ height: '100%' }}>
                                        <DashboardPanel title="Market Watch">
                                            <PanelErrorBoundary>
                                                <MarketGrid onSelectSymbol={setSymbol} />
                                            </PanelErrorBoundary>
                                        </DashboardPanel>
                                    </div>
                                </Panel>

                                <PanelResizeHandle className="resize-handle" />

                                {/* COLUMN 2: Chart, Quant Signals & OrderBook (55%) */}
                                <Panel defaultSize={55} minSize={40}>
                                    <PanelGroup direction="vertical">
                                        <Panel defaultSize={50}>
                                            <div ref={chartRef} style={{ height: '100%' }}>
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

                                        <Panel defaultSize={25}>
                                            <DashboardPanel title="Quant Signal Engine">
                                                <PanelErrorBoundary>
                                                    <Suspense fallback={<LoadingSpinner />}>
                                                        <QuantSignalEngine />
                                                    </Suspense>
                                                </PanelErrorBoundary>
                                            </DashboardPanel>
                                        </Panel>

                                        <PanelResizeHandle className="resize-handle" />

                                        <Panel defaultSize={25}>
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

                                {/* COLUMN 3: Alpha & News (30%) */}
                                <Panel defaultSize={30} minSize={20} maxSize={35}>
                                    <PanelGroup direction="vertical">
                                        <Panel defaultSize={50}>
                                            <div ref={alphaRef} style={{ height: '100%' }}>
                                                <DashboardPanel title="Alpha Factors">
                                                    <PanelErrorBoundary>
                                                        <AlphaPanel symbol={selectedSymbol} />
                                                    </PanelErrorBoundary>
                                                </DashboardPanel>
                                            </div>
                                        </Panel>

                                        <PanelResizeHandle className="resize-handle" />

                                        <Panel defaultSize={50}>
                                            <div ref={newsRef} style={{ height: '100%' }}>
                                                <DashboardPanel title="Market Intelligence">
                                                    <PanelErrorBoundary>
                                                        <TabPanel
                                                            tabs={intelligenceTabs}
                                                            defaultTab="onchain"
                                                        />
                                                    </PanelErrorBoundary>
                                                </DashboardPanel>
                                            </div>
                                        </Panel>
                                    </PanelGroup>
                                </Panel>

                            </PanelGroup>
                        </div>

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

                        <MacroAnalysisModal
                            isOpen={showMacroModal}
                            onClose={() => setShowMacroModal(false)}
                        />

                        {import.meta.env.DEV && <MemoryProfiler />}
                    </div>
                </MobileGate>
            </ErrorBoundary>
        </ThemeProvider>
    );
};

export default App;
