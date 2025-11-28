import React, { Suspense, useRef, useMemo, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useMarketStore } from './stores/marketStore';
import { useConnectionStore } from './stores/connectionStore';
import DashboardPanel from './ui/DashboardPanel';
import MarketGrid from './features/market/MarketGrid';
import LoadingSpinner from './ui/LoadingSpinner';
import PanelErrorBoundary from './ui/PanelErrorBoundary';
import { Wifi, WifiOff, Newspaper, Calendar, BarChart2, Flame, Activity, Search, Keyboard, Globe } from 'lucide-react';
import ThemeProvider from './ui/ThemeProvider';
import ErrorBoundary from './ui/ErrorBoundary';
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

const ChartContainer = React.lazy(() => import('./features/charts/ChartContainer'));

import PerformancePanel from './features/trading/PerformancePanel';
// Lazy Load Secondary/Heavy Analytics
const QuantSignalEngine = React.lazy(() => import('./features/analytics/QuantSignalEngine'));

import { useConnectionLatency } from './hooks/useConnectionLatency';
import CommandPalette from './features/command-palette/CommandPalette';
import MacroAnalysisModal from './features/macro/MacroAnalysisModal';

const App: React.FC = () => {
    const { selectedSymbol, setSymbol } = useMarketStore();
    const connections = useConnectionStore(state => state.connections);
    const { latency, quality, updatesPerSecond } = useConnectionLatency();

    // Panel refs for keyboard focus
    const marketWatchRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const alphaRef = useRef<HTMLDivElement>(null);
    const newsRef = useRef<HTMLDivElement>(null);

    // Command Palette State
    const [showCommandPalette, setShowCommandPalette] = React.useState(false);
    const [showMacroModal, setShowMacroModal] = React.useState(false);



    // Global keyboard listener for Command Palette (Cmd+K)
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

    // Calculate overall status
    const isGlobalConnected = Object.values(connections).every(status => status === 'connected');

    // Keyboard shortcuts
    const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts({
        shortcuts: [
            {
                key: '1',
                ctrl: true,
                description: 'Focus Market Watch',
                action: () => marketWatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                category: 'panels'
            },
            {
                key: '2',
                ctrl: true,
                description: 'Focus Chart',
                action: () => chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                category: 'panels'
            },
            {
                key: '3',
                ctrl: true,
                description: 'Focus Alpha Panel',
                action: () => alphaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                category: 'panels'
            },
            {
                key: '4',
                ctrl: true,
                description: 'Focus News',
                action: () => newsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                category: 'panels'
            }
        ]
    });

    // Command Palette Items
    const commands = useMemo(() => [
        {
            id: 'open-macro',
            label: 'Open Macro Analysis',
            description: 'View GDP, CPI, and Fed Rates (OpenBB)',
            icon: <Globe size={16} />,
            action: () => setShowMacroModal(true),
            category: 'Analysis'
        },
        {
            id: 'focus-market',
            label: 'Focus Market Watch',
            description: 'Navigate to the market watch panel',
            icon: <Activity size={16} />,
            action: () => marketWatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
            category: 'Navigation'
        },
        {
            id: 'focus-chart',
            label: 'Focus Chart',
            description: 'Navigate to the main chart',
            icon: <BarChart2 size={16} />,
            action: () => chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
            category: 'Navigation'
        },
        {
            id: 'focus-alpha',
            label: 'Focus Alpha Panel',
            description: 'Navigate to alpha factors',
            icon: <Flame size={16} />,
            action: () => alphaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
            category: 'Navigation'
        },
        {
            id: 'focus-news',
            label: 'Focus News',
            description: 'Navigate to news feed',
            icon: <Newspaper size={16} />,
            action: () => newsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
            category: 'Navigation'
        },
        {
            id: 'toggle-help',
            label: 'Show Keyboard Shortcuts',
            description: 'View all available keyboard shortcuts',
            icon: <Keyboard size={16} />,
            action: () => setShowHelp(true),
            category: 'Help'
        },
        {
            id: 'analyze-btc',
            label: 'Analyze BTCUSDT',
            description: 'Switch symbol to Bitcoin',
            icon: <Activity size={16} />,
            action: () => setSymbol('BTCUSDT'),
            category: 'Actions'
        },
        {
            id: 'analyze-eth',
            label: 'Analyze ETHUSDT',
            description: 'Switch symbol to Ethereum',
            icon: <Activity size={16} />,
            action: () => setSymbol('ETHUSDT'),
            category: 'Actions'
        },
        {
            id: 'analyze-sol',
            label: 'Analyze SOLUSDT',
            description: 'Switch symbol to Solana',
            icon: <Activity size={16} />,
            action: () => setSymbol('SOLUSDT'),
            category: 'Actions'
        }
    ], [setSymbol, setShowHelp]);

    const getQualityColor = (q: string) => {
        switch (q) {
            case 'Excellent': return 'var(--accent-primary)'; // Green
            case 'Good': return '#FFD700'; // Gold
            case 'Fair': return '#FFA500'; // Orange
            case 'Poor': return 'var(--accent-danger)'; // Red
            default: return 'var(--text-muted)';
        }
    };

    return (
        <ThemeProvider>
            <ErrorBoundary>
                <div className="app-container">
                    {/* Header */}
                    <header className="app-header">
                        <div className="logo-section">
                            <div className="logo-text">
                                <h1>quant.term</h1>
                                <span className="version">Quantitative Terminal</span>
                            </div>
                        </div>

                        <div className="header-controls">
                            <div
                                className="command-trigger"
                                onClick={() => setShowCommandPalette(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 12px',
                                    background: 'var(--bg-panel)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    marginRight: '16px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
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
                                {isGlobalConnected ?
                                    <Wifi size={12} /> :
                                    <WifiOff size={12} />
                                }
                                <span style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
                                    {isGlobalConnected ? 'LIVE' : 'OFFLINE'}
                                </span>
                            </div>
                            <div className="user-profile">
                                <div className="avatar">TRADER</div>
                            </div>
                        </div>
                    </header>

                    {/* News Ticker */}
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
                                    {/* Top: Main Chart (50%) */}
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

                                    {/* Middle: Quant Signals (25%) */}
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

                                    {/* Bottom: Order Book & Liquidations (25%) */}
                                    <Panel defaultSize={25}>
                                        <DashboardPanel title="Market Depth">
                                            <PanelErrorBoundary>
                                                <TabPanel
                                                    tabs={useMemo(() => [
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
                                                    ], [selectedSymbol])}
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
                                    {/* Top: Alpha Factors (50%) */}
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

                                    {/* Bottom: News & Calendar (50%) */}
                                    <Panel defaultSize={50}>
                                        <div ref={newsRef} style={{ height: '100%' }}>
                                            <DashboardPanel title="Market Intelligence">
                                                <PanelErrorBoundary>
                                                    <TabPanel
                                                        tabs={useMemo(() => [
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
                                                        ], [selectedSymbol])}
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

                    {/* Footer Status Bar */}
                    <footer className="app-footer">
                        <div className="status-item">
                            <span className="label">LATENCY</span>
                            <span className="value" style={{ color: getQualityColor(quality) }}>
                                {latency}ms ({quality})
                            </span>
                        </div>
                        <div className="status-item">
                            <span className="label">DATA RATE</span>
                            <span className="value">{updatesPerSecond} msg/s</span>
                        </div>
                        <div className="status-item">
                            <span className="label">STATUS</span>
                            <span className="value good">CONNECTED</span>
                        </div>
                        <div className="status-item">
                            <span className="label">EXCHANGE</span>
                            <span className="value">BINANCE FUTURES</span>
                        </div>
                        <div className="status-item">
                            <span className="label">SYMBOL</span>
                            <span className="value">{selectedSymbol}</span>
                        </div>
                        <div className="status-item right">
                            <span className="value">UTC {new Date().toISOString().slice(11, 19)}</span>
                        </div>
                        <PerformancePanel />
                    </footer>

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
                    <MemoryProfiler />
                </div >
            </ErrorBoundary >
        </ThemeProvider >
    );
};

export default App;
